import express from 'express';
import multer from 'multer';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import morgan from 'morgan';
import dotenv from 'dotenv';
import https from 'https';
import forge from 'node-forge';

dotenv.config();

const app = express();
const PORT = process.env.FILE_SERVER_PORT || 3003;
const HOST = process.env.FILE_SERVER_HOST || '0.0.0.0';

function createSelfSignedCertificate() {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    const attrs = [
        { name: 'countryName', value: 'DE' },
        { name: 'organizationName', value: 'File Server' },
        { name: 'commonName', value: '139.162.154.60' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
    cert.setExtensions([
        { name: 'basicConstraints', cA: true },
        { name: 'keyUsage', keyCertSign: true, digitalSignature: true, nonRepudiation: true, keyEncipherment: true, dataEncipherment: true },
        { name: 'subjectAltName', altNames: [ { type: 2, value: 'localhost' }, { type: 7, ip: '127.0.0.1' }, { type: 7, ip: '139.162.154.60' } ] }
    ]);
    cert.sign(keys.privateKey);
    return { key: forge.pki.privateKeyToPem(keys.privateKey), cert: forge.pki.certificateToPem(cert) };
}

app.use(morgan('combined'));
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:4055', 'https://localhost:4055', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

const generalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 1000 });
const uploadLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 50 });
app.use(generalLimiter);
app.use('/api/upload', uploadLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const STORAGE_BASE_DIR = process.env.STORAGE_BASE_DIR || path.join(process.cwd(), 'storage');
await fs.ensureDir(STORAGE_BASE_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { documentType, kuerzel } = req.body;
        let targetDir = STORAGE_BASE_DIR;
        if (documentType && kuerzel) {
            targetDir = path.join(STORAGE_BASE_DIR, 'berichte', kuerzel, documentType);
            fs.ensureDirSync(targetDir);
        }
        cb(null, targetDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, `${uniqueSuffix}${extension}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'text/plain',
        'application/zip'
    ];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`Dateityp nicht erlaubt: ${file.mimetype}`), false);
    }
};

const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 100 * 1024 * 1024, files: 10 } });

function createStoragePath(documentType, kuerzel, arbeitsdatum) {
    const dateObj = arbeitsdatum ? new Date(arbeitsdatum) : new Date();
    const year = dateObj.getFullYear();
    function getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
    }
    const kalenderwoche = getWeekNumber(dateObj);
    const safeKuerzel = kuerzel ? kuerzel.replace(/[^a-zA-Z0-9]/g, '') : 'MISC';
    const typeFolder = {
        'bautagesbericht': 'bautagesberichte',
        'regiebericht': 'regieberichte',
        'regieantrag': 'regieantraege',
        'document': 'documents'
    }[documentType] || 'documents';
    return path.join('berichte', safeKuerzel, typeFolder, year.toString(), kalenderwoche.toString());
}

function generateFileName(originalName, documentType, kuerzel, arbeitsdatum) {
    const dateObj = arbeitsdatum ? new Date(arbeitsdatum) : new Date();
    const dateStr = dateObj.toISOString().split('T')[0].replace(/-/g, '_');
    const timeStr = dateObj.toTimeString().split(' ')[0].replace(/:/g, '_');
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    const prefix = {
        'bautagesbericht': 'BTB',
        'regiebericht': 'REG',
        'regieantrag': 'RGA'
    }[documentType] || 'DOC';
    const safeKuerzel = kuerzel ? kuerzel.replace(/[^a-zA-Z0-9]/g, '') : 'MISC';
    return `${prefix}_${safeKuerzel}_${dateStr}_${timeStr}_${baseName}${extension}`;
}

app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'Berichte File Server', version: '1.0.0', timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()), storage: STORAGE_BASE_DIR, port: PORT });
});

app.get('/api/info', (req, res) => {
    res.json({ name: 'Berichte File Server', version: '1.0.0', endpoints: { upload: '/api/upload', download: '/files/{path}', delete: '/api/files/{path}', list: '/api/files/{path}', health: '/health' }, limits: { maxFileSize: '100MB', maxFiles: 10, allowedTypes: ['.docx', '.doc', '.pdf', '.jpg', '.png', '.gif', '.txt', '.zip'] } });
});

app.post('/api/upload', upload.array('files', 10), async (req, res) => {
    try {
        const { documentType, kuerzel, customPath, originalFileName, arbeitsdatum } = req.body;
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, error: 'Keine Dateien hochgeladen' });
        }
        const uploadedFiles = [];
        for (const file of req.files) {
            try {
                const storagePath = customPath || createStoragePath(documentType, kuerzel, arbeitsdatum);
                const targetDir = path.join(STORAGE_BASE_DIR, storagePath);
                await fs.ensureDir(targetDir);
                const fileName = originalFileName || generateFileName(file.originalname, documentType, kuerzel, arbeitsdatum);
                const targetPath = path.join(targetDir, fileName);
                await fs.move(file.path, targetPath);
                try { await fs.chmod(targetPath, 0o644); } catch {}
                const relativePath = path.join(storagePath, fileName).replace(/\\/g, '/');
                const serverUrl = process.env.PUBLIC_FILE_SERVER_URL || process.env.FILE_SERVER_URL || `http://localhost:${PORT}`;
                const downloadUrl = `${serverUrl}/files/${relativePath}`;
                const fileInfo = { id: uuidv4(), originalName: file.originalname, fileName: fileName, size: file.size, mimetype: file.mimetype, storagePath: targetPath, relativePath: relativePath, downloadUrl: downloadUrl, uploadedAt: new Date().toISOString() };
                uploadedFiles.push(fileInfo);
            } catch (fileError) {
                try { if (await fs.pathExists(file.path)) { await fs.remove(file.path); } } catch {}
                return res.status(500).json({ success: false, error: `Fehler bei Datei ${file.originalname}: ${fileError.message}` });
            }
        }
        res.json({ success: true, message: `${uploadedFiles.length} Datei(en) erfolgreich hochgeladen`, files: uploadedFiles, uploadedAt: new Date().toISOString() });
    } catch (error) {
        if (req.files) {
            for (const file of req.files) {
                try { if (await fs.pathExists(file.path)) { await fs.remove(file.path); } } catch {}
            }
        }
        res.status(500).json({ success: false, error: error.message || 'Unbekannter Upload-Fehler' });
    }
});

app.use('/files', express.static(STORAGE_BASE_DIR, {
    setHeaders: (res, filePath) => {
        const fileName = path.basename(filePath);
        const mimeType = mime.lookup(filePath) || 'application/octet-stream';
        res.setHeader('Content-Type', mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Access-Control-Allow-Origin', '*');
    }
}));

app.get('/api/files/*', async (req, res) => {
    try {
        const requestedPath = req.params[0];
        const fullPath = path.join(STORAGE_BASE_DIR, requestedPath);
        if (!await fs.pathExists(fullPath)) {
            return res.status(404).json({ success: false, error: 'Datei oder Ordner nicht gefunden' });
        }
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
            const items = await fs.readdir(fullPath);
            const itemInfos = [];
            for (const item of items) {
                const itemPath = path.join(fullPath, item);
                const itemStats = await fs.stat(itemPath);
                itemInfos.push({ name: item, type: itemStats.isDirectory() ? 'directory' : 'file', size: itemStats.isFile() ? itemStats.size : null, modified: itemStats.mtime, downloadUrl: itemStats.isFile() ? `/files/${path.join(requestedPath, item).replace(/\\/g, '/')}` : null });
            }
            res.json({ success: true, type: 'directory', path: requestedPath, items: itemInfos, count: itemInfos.length });
        } else {
            const mimeType = mime.lookup(fullPath) || 'application/octet-stream';
            res.json({ success: true, type: 'file', name: path.basename(fullPath), size: stats.size, mimetype: mimeType, created: stats.birthtime, modified: stats.mtime, downloadUrl: `/files/${requestedPath}` });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: 'Fehler beim Abrufen der Datei-Informationen' });
    }
});

app.delete('/api/files/*', async (req, res) => {
    try {
        const requestedPath = req.params[0];
        const fullPath = path.join(STORAGE_BASE_DIR, requestedPath);
        if (!await fs.pathExists(fullPath)) {
            return res.status(404).json({ success: false, error: 'Datei nicht gefunden' });
        }
        const stats = await fs.stat(fullPath);
        if (stats.isDirectory()) {
            return res.status(400).json({ success: false, error: 'Ordner-Löschung nicht erlaubt über diese API' });
        }
        await fs.remove(fullPath);
        res.json({ success: true, message: 'Datei erfolgreich gelöscht', deletedPath: requestedPath, deletedAt: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Fehler beim Löschen der Datei' });
    }
});

app.delete('/api/delete/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const searchDirs = [ 'berichte/bautagesberichte', 'berichte/regieberichte', 'berichte/regieantraege', 'berichte', 'documents' ];
        let foundPath = null;
        for (const searchDir of searchDirs) {
            const searchPath = path.join(STORAGE_BASE_DIR, searchDir);
            if (await fs.pathExists(searchPath)) {
                const found = await searchFileRecursively(searchPath, filename);
                if (found) { foundPath = found; break; }
            }
        }
        if (!foundPath) {
            return res.status(404).json({ success: false, error: 'Datei nicht gefunden' });
        }
        await fs.remove(foundPath);
        res.json({ success: true, message: 'Datei erfolgreich gelöscht', deletedPath: foundPath, filename: filename, deletedAt: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message || 'Fehler beim Löschen der Datei' });
    }
});

async function searchFileRecursively(dir, filename) {
    try {
        const items = await fs.readdir(dir);
        for (const item of items) {
            const fullPath = path.join(dir, item);
            const stats = await fs.stat(fullPath);
            if (stats.isDirectory()) {
                const result = await searchFileRecursively(fullPath, filename);
                if (result) return result;
            } else if (item === filename) {
                return fullPath;
            }
        }
    } catch {}
    return null;
}

app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, error: 'Datei zu groß. Maximum: 100MB' });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({ success: false, error: 'Zu viele Dateien. Maximum: 10 Dateien' });
        }
    }
    res.status(500).json({ success: false, error: error.message || 'Interner Server-Fehler' });
});

app.use('*', (req, res) => {
    res.status(404).json({ success: false, error: `Endpoint nicht gefunden: ${req.method} ${req.originalUrl}` });
});

const httpsPort = PORT;
const sslOptions = createSelfSignedCertificate();
https.createServer(sslOptions, app).listen(httpsPort, HOST, () => {
    const serverUrl = process.env.PUBLIC_FILE_SERVER_URL || `https://${HOST}:${httpsPort}`;
    console.log(`HTTPS Server läuft auf Port ${httpsPort}`);
});

export default app;
