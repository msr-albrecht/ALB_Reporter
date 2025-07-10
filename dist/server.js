"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const node_forge_1 = __importDefault(require("node-forge"));
const routes_1 = require("./modules/routes");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4055;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
const staticPath = path_1.default.join(__dirname, '../src');
app.use(express_1.default.static(staticPath));
app.use('/api', routes_1.reportRouter);
app.get('/', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../src/index.html'));
});
app.get('/report-detail', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, '../src/report-detail.html'));
});
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route nicht gefunden'
    });
});
app.use((err, req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Interner Serverfehler'
    });
});
function createSelfSignedCertificate() {
    console.log('Erstelle neue SSL-Zertifikate mit node-forge...');
    const keys = node_forge_1.default.pki.rsa.generateKeyPair(2048);
    const cert = node_forge_1.default.pki.createCertificate();
    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
    const attrs = [
        { name: 'countryName', value: 'DE' },
        { name: 'organizationName', value: 'Berichte Generator' },
        { name: 'commonName', value: 'localhost' }
    ];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);
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
    cert.sign(keys.privateKey);
    const privateKeyPem = node_forge_1.default.pki.privateKeyToPem(keys.privateKey);
    const certificatePem = node_forge_1.default.pki.certificateToPem(cert);
    return {
        key: privateKeyPem,
        cert: certificatePem
    };
}
const sslPath = path_1.default.join(__dirname, '../ssl');
let httpsOptions = null;
try {
    httpsOptions = {
        key: fs_1.default.readFileSync(path_1.default.join(sslPath, 'key.pem'), 'utf8'),
        cert: fs_1.default.readFileSync(path_1.default.join(sslPath, 'cert.pem'), 'utf8')
    };
    console.log('Vorhandene SSL-Zertifikate geladen.');
}
catch (error) {
    console.log('Keine SSL-Zertifikate gefunden. Erstelle neue selbstsignierte Zertifikate...');
    if (!fs_1.default.existsSync(sslPath)) {
        fs_1.default.mkdirSync(sslPath, { recursive: true });
    }
    const certificates = createSelfSignedCertificate();
    fs_1.default.writeFileSync(path_1.default.join(sslPath, 'key.pem'), certificates.key);
    fs_1.default.writeFileSync(path_1.default.join(sslPath, 'cert.pem'), certificates.cert);
    httpsOptions = certificates;
    console.log('Neue selbstsignierte SSL-Zertifikate erstellt und gespeichert.');
}
if (httpsOptions) {
    https_1.default.createServer(httpsOptions, app).listen(PORT, () => {
        console.log(`🔒 HTTPS Server läuft auf Port ${PORT}`);
        console.log(`🌐 Frontend: https://localhost:${PORT}`);
        console.log(`🔌 API: https://localhost:${PORT}/api`);
        console.log('⚠️  Hinweis: Bei selbstsignierten Zertifikaten wird der Browser eine Sicherheitswarnung anzeigen.');
        console.log('   Klicken Sie auf "Erweitert" und dann "Weiter zu localhost (unsicher)"');
    });
}
else {
    console.error('❌ Fehler beim Laden der SSL-Zertifikate. Fallback zu HTTP...');
    app.listen(PORT, () => {
        console.log(`🔓 HTTP Server läuft auf Port ${PORT} (HTTPS-Fallback)`);
        console.log(`🌐 Frontend: http://localhost:${PORT}`);
        console.log(`🔌 API: http://localhost:${PORT}/api`);
    });
}
//# sourceMappingURL=server.js.map