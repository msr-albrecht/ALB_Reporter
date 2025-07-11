import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import https from 'https';
import fs from 'fs';
import forge from 'node-forge';
import { reportRouter } from './modules/routes';

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
        { name: 'commonName', value: 'localhost' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    // Füge Erweiterungen hinzu
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
                { type: 7, ip: '127.0.0.1' }
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
const sslPath = path.join(__dirname, '../ssl');
let httpsOptions: { key: string; cert: string } | null = null;

try {
    // Versuche vorhandene Zertifikate zu laden
    httpsOptions = {
        key: fs.readFileSync(path.join(sslPath, 'key.pem'), 'utf8'),
        cert: fs.readFileSync(path.join(sslPath, 'cert.pem'), 'utf8')
    };
    console.log('Vorhandene SSL-Zertifikate geladen.');
} catch (error) {
    console.log('Keine SSL-Zertifikate gefunden. Erstelle neue selbstsignierte Zertifikate...');

    // Erstelle SSL-Verzeichnis falls es nicht existiert
    if (!fs.existsSync(sslPath)) {
        fs.mkdirSync(sslPath, { recursive: true });
    }

    // Erstelle neue selbstsignierte Zertifikate
    const certificates = createSelfSignedCertificate();

    // Speichere die Zertifikate
    fs.writeFileSync(path.join(sslPath, 'key.pem'), certificates.key);
    fs.writeFileSync(path.join(sslPath, 'cert.pem'), certificates.cert);

    httpsOptions = certificates;
    console.log('Neue selbstsignierte SSL-Zertifikate erstellt und gespeichert.');
}

// Starte HTTPS Server
if (httpsOptions) {
    https.createServer(httpsOptions, app).listen(PORT, () => {
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
} else {
    // Fallback zu HTTP wenn HTTPS nicht funktioniert
    const serverUrl = process.env.SERVER_URL || `http://localhost:${PORT}`;
    console.error('❌ Fehler beim Laden der SSL-Zertifikate. Fallback zu HTTP...');
    app.listen(PORT, () => {
        console.log(`🔓 HTTP Server läuft auf Port ${PORT} (HTTPS-Fallback)`);
        console.log(`🌐 Öffentliche URL: ${serverUrl}`);
        console.log(`🔌 API: ${serverUrl}/api`);
        console.log(`📁 Dateiserver: ${serverUrl}/files`);
    });
}
