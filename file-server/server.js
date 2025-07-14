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

// Lade Umgebungsvariablen
dotenv.config();

const app = express();
const PORT = process.env.FILE_SERVER_PORT || 3002;
const HOST = process.env.FILE_SERVER_HOST || '0.0.0.0';

// Logging
app.use(morgan('combined'));

// Sicherheits-Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ?
        process.env.ALLOWED_ORIGINS.split(',') :
        ['http://localhost:4055', 'https://localhost:4055', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate Limiting
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Minuten
    max: 1000, // Max 1000 Requests pro 15 Minuten
    message: { error: 'Zu viele Anfragen. Bitte versuchen Sie es später erneut.' }
});

const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 Minuten
    max: 50, // Max 50 Uploads pro 15 Minuten
    message: { error: 'Zu viele Upload-Versuche. Bitte versuchen Sie es später erneut.' }
});

app.use(generalLimiter);
app.use('/api/upload', uploadLimiter);

// JSON Parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File Storage Configuration
const STORAGE_BASE_DIR = process.env.STORAGE_BASE_DIR || path.join(process.cwd(), 'storage');
const TEMP_DIR = path.join(STORAGE_BASE_DIR, 'temp');

// Verzeichnisse sicherstellen
await fs.ensureDir(STORAGE_BASE_DIR);
await fs.ensureDir(TEMP_DIR);

console.log(`📁 Storage-Verzeichnis: ${STORAGE_BASE_DIR}`);
console.log(`🔧 Temporäres Verzeichnis: ${TEMP_DIR}`);

// Multer Configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, `temp-${uniqueSuffix}${extension}`);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
        'application/msword', // .doc
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'text/plain',
        'application/zip'
    ];

    console.log(`📄 Upload-Versuch: ${file.originalname} (${file.mimetype})`);

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        const error = new Error(`Dateityp nicht erlaubt: ${file.mimetype}. Erlaubte Typen: ${allowedTypes.join(', ')}`);
        cb(error, false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB pro Datei
        files: 10 // Max 10 Dateien gleichzeitig
    }
});

// Utility Functions
function createStoragePath(documentType, kuerzel) {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    // Tag-Ebene entfernt - nur noch Jahr/Monat

    const typeFolder = {
        'bautagesbericht': 'bautagesberichte',
        'regiebericht': 'regieberichte',
        'regieantrag': 'regieantraege',
        'document': 'documents'
    }[documentType] || 'documents';

    // Ohne Tag-Ebene: berichte/bautagesberichte/2025/07/
    return path.join('berichte', typeFolder, year.toString(), month);
}

function generateFileName(originalName, documentType, kuerzel) {
    const currentDate = new Date();
    const dateStr = currentDate.toISOString().split('T')[0].replace(/-/g, '_');
    const timeStr = currentDate.toTimeString().split(' ')[0].replace(/:/g, '_');
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);

    const prefix = {
        'bautagesbericht': 'BTB',
        'regiebericht': 'REG',
        'regieantrag': 'RGA'
    }[documentType] || 'DOC';

    const safeKuerzel = (kuerzel || 'MISC').replace(/[^a-zA-Z0-9]/g, '');
    return `${prefix}_${safeKuerzel}_${dateStr}_${timeStr}_${baseName}${extension}`;
}

// Routes

// Health Check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'Berichte File Server',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        storage: STORAGE_BASE_DIR,
        port: PORT
    });
});

// Server Info
app.get('/api/info', (req, res) => {
    res.json({
        name: 'Berichte File Server',
        version: '1.0.0',
        endpoints: {
            upload: '/api/upload',
            download: '/files/{path}',
            delete: '/api/files/{path}',
            list: '/api/files/{path}',
            health: '/health'
        },
        limits: {
            maxFileSize: '100MB',
            maxFiles: 10,
            allowedTypes: ['.docx', '.doc', '.pdf', '.jpg', '.png', '.gif', '.txt', '.zip']
        }
    });
});

// File Upload
app.post('/api/upload', upload.array('files', 10), async (req, res) => {
    try {
        const { documentType, kuerzel, customPath } = req.body;

        console.log(`📤 Upload-Request: documentType=${documentType}, kuerzel=${kuerzel}, files=${req.files?.length || 0}`);

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Keine Dateien hochgeladen'
            });
        }

        const uploadedFiles = [];

        for (const file of req.files) {
            try {
                // Bestimme Speicherpfad
                const storagePath = customPath || createStoragePath(documentType, kuerzel);
                const targetDir = path.join(STORAGE_BASE_DIR, storagePath);

                // Verzeichnis erstellen
                await fs.ensureDir(targetDir);

                // Dateiname generieren
                const fileName = generateFileName(file.originalname, documentType, kuerzel);
                const targetPath = path.join(targetDir, fileName);

                // Datei verschieben
                await fs.move(file.path, targetPath);

                // Berechtigungen setzen (falls Linux/Unix)
                try {
                    await fs.chmod(targetPath, 0o644);
                } catch (chmodError) {
                    console.warn('⚠️ Konnte Dateiberechtigungen nicht setzen:', chmodError.message);
                }

                // Download-URL erstellen
                const relativePath = path.join(storagePath, fileName).replace(/\\/g, '/');
                // Verwende PUBLIC_FILE_SERVER_URL für externe Downloads, fallback auf FILE_SERVER_URL
                const serverUrl = process.env.PUBLIC_FILE_SERVER_URL || process.env.FILE_SERVER_URL || `http://localhost:${PORT}`;
                const downloadUrl = `${serverUrl}/files/${relativePath}`;

                const fileInfo = {
                    id: uuidv4(),
                    originalName: file.originalname,
                    fileName: fileName,
                    size: file.size,
                    mimetype: file.mimetype,
                    storagePath: targetPath,
                    relativePath: relativePath,
                    downloadUrl: downloadUrl,
                    uploadedAt: new Date().toISOString()
                };

                uploadedFiles.push(fileInfo);

                console.log(`✅ Datei gespeichert: ${fileName} -> ${targetPath}`);
                console.log(`🔗 Download-URL: ${downloadUrl}`);

            } catch (fileError) {
                console.error(`❌ Fehler bei Datei ${file.originalname}:`, fileError);

                // Temporäre Datei löschen falls noch vorhanden
                try {
                    if (await fs.pathExists(file.path)) {
                        await fs.remove(file.path);
                    }
                } catch (cleanupError) {
                    console.warn('⚠️ Konnte temporäre Datei nicht löschen:', cleanupError.message);
                }

                return res.status(500).json({
                    success: false,
                    error: `Fehler bei Datei ${file.originalname}: ${fileError.message}`
                });
            }
        }

        res.json({
            success: true,
            message: `${uploadedFiles.length} Datei(en) erfolgreich hochgeladen`,
            files: uploadedFiles,
            uploadedAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Upload-Fehler:', error);

        // Alle temporären Dateien löschen
        if (req.files) {
            for (const file of req.files) {
                try {
                    if (await fs.pathExists(file.path)) {
                        await fs.remove(file.path);
                    }
                } catch (cleanupError) {
                    console.warn('⚠️ Konnte temporäre Datei nicht löschen:', cleanupError.message);
                }
            }
        }

        res.status(500).json({
            success: false,
            error: error.message || 'Unbekannter Upload-Fehler'
        });
    }
});

// Static File Server für Downloads
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

// File Info API
app.get('/api/files/*', async (req, res) => {
    try {
        const requestedPath = req.params[0];
        const fullPath = path.join(STORAGE_BASE_DIR, requestedPath);

        if (!await fs.pathExists(fullPath)) {
            return res.status(404).json({
                success: false,
                error: 'Datei oder Ordner nicht gefunden'
            });
        }

        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
            // Ordner-Listing
            const items = await fs.readdir(fullPath);
            const itemInfos = [];

            for (const item of items) {
                const itemPath = path.join(fullPath, item);
                const itemStats = await fs.stat(itemPath);

                itemInfos.push({
                    name: item,
                    type: itemStats.isDirectory() ? 'directory' : 'file',
                    size: itemStats.isFile() ? itemStats.size : null,
                    modified: itemStats.mtime,
                    downloadUrl: itemStats.isFile() ? `/files/${path.join(requestedPath, item).replace(/\\/g, '/')}` : null
                });
            }

            res.json({
                success: true,
                type: 'directory',
                path: requestedPath,
                items: itemInfos,
                count: itemInfos.length
            });

        } else {
            // Datei-Info
            const mimeType = mime.lookup(fullPath) || 'application/octet-stream';

            res.json({
                success: true,
                type: 'file',
                name: path.basename(fullPath),
                size: stats.size,
                mimetype: mimeType,
                created: stats.birthtime,
                modified: stats.mtime,
                downloadUrl: `/files/${requestedPath}`
            });
        }

    } catch (error) {
        console.error('❌ File-Info-Fehler:', error);
        res.status(500).json({
            success: false,
            error: 'Fehler beim Abrufen der Datei-Informationen'
        });
    }
});

// File Delete API
app.delete('/api/files/*', async (req, res) => {
    try {
        const requestedPath = req.params[0];
        const fullPath = path.join(STORAGE_BASE_DIR, requestedPath);

        if (!await fs.pathExists(fullPath)) {
            return res.status(404).json({
                success: false,
                error: 'Datei nicht gefunden'
            });
        }

        const stats = await fs.stat(fullPath);

        if (stats.isDirectory()) {
            await fs.remove(fullPath);
            console.log(`🗑️ Ordner gelöscht: ${fullPath}`);
            res.json({
                success: true,
                message: `Ordner ${path.basename(fullPath)} wurde erfolgreich gelöscht`
            });
        } else {
            await fs.remove(fullPath);
            console.log(`🗑️ Datei gelöscht: ${fullPath}`);
            res.json({
                success: true,
                message: `Datei ${path.basename(fullPath)} wurde erfolgreich gelöscht`
            });
        }

    } catch (error) {
        console.error('❌ Lösch-Fehler:', error);
        res.status(500).json({
            success: false,
            error: 'Fehler beim Löschen'
        });
    }
});

// Error Handler
app.use((error, req, res, next) => {
    console.error('❌ Server-Fehler:', error);

    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                error: 'Datei zu groß. Maximum: 100MB'
            });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
                success: false,
                error: 'Zu viele Dateien. Maximum: 10 Dateien'
            });
        }
    }

    res.status(500).json({
        success: false,
        error: error.message || 'Interner Server-Fehler'
    });
});

// 404 Handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        error: `Endpoint nicht gefunden: ${req.method} ${req.originalUrl}`
    });
});

// Server starten
app.listen(PORT, HOST, () => {
    const serverUrl = process.env.FILE_SERVER_URL || `http://${HOST}:${PORT}`;
    console.log('');
    console.log('🚀 ===============================================');
    console.log('🗂️  BERICHTE FILE SERVER GESTARTET');
    console.log('🚀 ===============================================');
    console.log(`🌐 Server-URL: ${serverUrl}`);
    console.log(`🏠 Host: ${HOST}`);
    console.log(`🔌 Port: ${PORT}`);
    console.log(`📁 Storage: ${STORAGE_BASE_DIR}`);
    console.log(`🔗 Health Check: ${serverUrl}/health`);
    console.log(`📊 Info: ${serverUrl}/api/info`);
    console.log(`📤 Upload: ${serverUrl}/api/upload`);
    console.log(`📥 Files: ${serverUrl}/files/`);
    console.log('🚀 ===============================================');
    console.log('');
});

export default app;
