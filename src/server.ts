import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import { reportRouter } from './modules/routes';
import { Server as SocketIOServer } from 'socket.io';
import { Socket } from 'socket.io';

const app = express();
const PORT = process.env.PORT || 4055;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const staticPath = path.join(__dirname, '../src');
app.use(express.static(staticPath));

// Statischer Dateiserver für hochgeladene Dateien
const filesPath = path.join(__dirname, '../files');
app.use('/files', express.static(filesPath, {
    setHeaders: (res, path, stat) => {
        // Setze Content-Disposition Header für Downloads
        const filename = path.split(/[\\/]/).pop();
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }
}));

app.use('/api', reportRouter);

app.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../src/index.html'));
});

app.get('/report-detail', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, '../src/report-detail.html'));
});

app.use('*', (req: Request, res: Response) => {
    res.status(404).json({
        success: false,
        message: 'Route nicht gefunden'
    });
});

app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Interner Serverfehler'
    });
});

// Funktion zum Erstellen selbstsignierter SSL-Zertifikate mit node-forge
function createSelfSignedCertificate(): { key: string; cert: string } {
    console.log('Erstelle neue SSL-Zertifikate mit node-forge...');

    // Erstelle Schlüsselpaar
    const keys = forge.pki.rsa.generateKeyPair(2048);

    // Erstelle Zertifikat
    const cert = forge.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    // Setze Zertifikat-Attribute
    const attrs = [
        { name: 'countryName', value: 'DE' },
        { name: 'organizationName', value: 'Berichte Generator' },
        { name: 'commonName', value: '139.162.154.60' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Füge Erweiterungen hinzu - WICHTIG: IP-Adresse als Subject Alternative Name
    cert.setExtensions([
        {
            name: 'basicConstraints',
            cA: true
        },
        {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
              nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true
        },
        {
            name: 'subjectAltName',
            altNames: [
                { type: 2, value: 'localhost' },
                { type: 7, ip: '127.0.0.1' },
                { type: 7, ip: '139.162.154.60' }  // Ihre Server-IP hinzugefügt
            ]
        }
    ]);

    // Signiere das Zertifikat
    cert.sign(keys.privateKey);

    // Konvertiere zu PEM-Format
    const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);
    const certificatePem = forge.pki.certificateToPem(cert);

    return {
        key: privateKeyPem,
        cert: certificatePem
    };
}

// SSL-Zertifikate laden oder erstellen
let httpsOptions: { key: string; cert: string } | null = null;
const sslPath = path.join(__dirname, '../ssl');
const keyPath = path.join(sslPath, 'key.pem');
const certPath = path.join(sslPath, 'cert.pem');

function isWritable(filePath: string) {
    try {
        fs.accessSync(filePath, fs.constants.W_OK);
        return true;
    } catch {
        return false;
    }
}

try {
    httpsOptions = {
        key: fs.readFileSync(keyPath, 'utf8'),
        cert: fs.readFileSync(certPath, 'utf8')
    };
    // Zertifikate existieren, prüfe Schreibrechte
    if (!isWritable(keyPath) || !isWritable(certPath)) {
        console.error('Zertifikate existieren, sind aber nicht beschreibbar! Bitte Dateirechte prüfen: ssl/key.pem und ssl/cert.pem');
        console.error('TIPP: Lösche die Dateien ssl/key.pem und ssl/cert.pem im Host-Ordner und starte den Container neu.');
        process.exit(1);
    }
} catch (error) {
    console.log('Keine SSL-Zertifikate gefunden. Erstelle neue selbstsignierte Zertifikate...');
    if (!fs.existsSync(sslPath)) {
        fs.mkdirSync(sslPath, { recursive: true });
    }
    const certificates = createSelfSignedCertificate();
    try {
        fs.writeFileSync(keyPath, certificates.key);
        fs.writeFileSync(certPath, certificates.cert);
        httpsOptions = certificates;
        console.log('Neue selbstsignierte SSL-Zertifikate erstellt und gespeichert.');
    } catch (err) {
        console.error('Fehler beim Schreiben der Zertifikate:', err);
        console.error('TIPP: Lösche die Dateien ssl/key.pem und ssl/cert.pem im Host-Ordner und starte den Container neu.');
        process.exit(1);
    }
}

// HTTPS-Server und Socket.IO
const httpsServer = https.createServer(httpsOptions, app);
const io = new SocketIOServer(httpsServer, {
    cors: {
        origin: '*',
    }
});

const CSV_PATH = path.join(__dirname, '../dummy.csv');
function readCSVFile() {
    const content = fs.readFileSync(CSV_PATH, 'utf8');
    return content.split('\n').map(row => row.split(','));
}
function writeCSVFile(data: string[][]) {
    const csvString = data.map(row => row.join(',')).join('\n');
    fs.writeFileSync(CSV_PATH, csvString, 'utf8');
}
io.on('connection', (socket: Socket) => {
    socket.on('get-csv', () => {
        const csvData = readCSVFile();
        socket.emit('csv-data', csvData);
    });
    socket.on('update-csv', (newData: string[][]) => {
        writeCSVFile(newData);
        io.emit('csv-update', newData);
    });
});

httpsServer.listen(PORT, () => {
    const serverUrl = process.env.SERVER_URL || `https://localhost:${PORT}`;
    console.log(`🔒 HTTPS Server läuft auf Port ${PORT}`);
    console.log(`🌐 Öffentliche URL: ${serverUrl}`);
    console.log(`🔌 API: ${serverUrl}/api`);
    console.log(`📁 Dateiserver: ${serverUrl}/files`);

    if (serverUrl.includes('localhost')) {
        console.log('⚠️  Hinweis: Bei selbstsignierten Zertifikaten wird der Browser eine Sicherheitswarnung anzeigen.');
        console.log('   Klicken Sie auf "Erweitert" und dann "Weiter zu localhost (unsicher)"');
    } else {
        console.log('✅ Server ist öffentlich erreichbar unter der konfigurierten URL');
    }
});
