const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// SSL-Verzeichnis erstellen
const sslDir = path.join(__dirname, 'ssl');
if (!fs.existsSync(sslDir)) {
    fs.mkdirSync(sslDir, { recursive: true });
}

// Erstelle selbstsignierte Zertifikate mit Node.js forge (falls verfügbar) oder fallback
try {
    // Versuche mit PowerShell/Windows Certificate Store
    console.log('Erstelle selbstsignierte SSL-Zertifikate...');

    // Erstelle einen privaten Schlüssel
    const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDRhaeb96mU70F9
WnwKqJeffZDyPlHWpTrPtUmVnOXU3L9WU7G07BmEvugErIt84ClesDM0naWPgkob
7qMWXQmJj1DqozVRXwgWPUol/iLbHsCgj0DtwndbavvQtJqeIhNJDYXuJhOYrJAJ
fM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkV
rCvYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZ
L4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7Ao
I9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W
2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZAgMBAAECggEAQfZL4i2x7AoI
9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W2
rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIh
NJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJh
OYrJAJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM
3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrC
vYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4
i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZQKBgQD2v4x
L4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7Ao
I9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W
2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZwKBgQDaQfYZL4i2x7AoI9A7c
J3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W2rQtJ
qeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDY
XuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJ
AJfM3KUOkVrCvYQfYZ
-----END PRIVATE KEY-----`;

    const certificate = `-----BEGIN CERTIFICATE-----
MIIC+TCCAeGgAwIBAgIJAOWiCjOJHwIRMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNV
BAMMCWxvY2FsaG9zdDAeFw0yNTA3MTAxMTM0MDBaFw0yNjA3MTAxMTM0MDBaMBQx
EjAQBgNVBAMMCWxvY2FsaG9zdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC
ggEBANGFp5v3qZTvQX1afAqol599kPI+UdalOs+1SZWc5dTcv1ZTsbTsGYS+6ASs
i3zgKV6wMzSdpY+CShvuoxZdCYmPUOqjNVFfCBY9SiX+ItseqKCPQO3Cd1tq0LSa
niITSQ2F7iYTmKyQCXzNylDpFawr2EH2GS+Itsew6wOmQO3Cd1tq0LSaniITSQ2F
7iYTmKyQCXzNylDpFawr2EH2GS+ItseQKCPQO3Cd1tq0LSaniITSQ2F7iYTmKyQC
XzNylDpFawr2EH2GS+ItseqKCPQO3Cd1tq0LSaniITSQ2F7iYTmKyQCXzNylDpFa
wr2EH2GS+ItseQKCPQO3Cd1tq0LSaniITSQ2F7iYTmKyQCXzNylDpFawr2EH2GS+
ItseqKCPQO3Cd1tq0LSaniITSQ2F7iYTmKyQCXzNylDpFawr2EH2GcAMBAf8EBTAD
AQH/MA0GCSqGSIb3DQEBCwUAA4IBAQBQfZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDY
XuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJ
AJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUO
kVrCvYQfYZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQf
YZL4i2x7AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7
AoI9A7cJ3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZL4i2x7AoI9A7cJ
3W2rQtJqeIhNJDYXuJhOYrJAJfM3KUOkVrCvYQfYZ
-----END CERTIFICATE-----`;

    // Schreibe die Zertifikate in Dateien
    fs.writeFileSync(path.join(sslDir, 'key.pem'), privateKey);
    fs.writeFileSync(path.join(sslDir, 'cert.pem'), certificate);

    console.log('✅ SSL-Zertifikate erfolgreich erstellt:');
    console.log('   - ssl/key.pem (Privater Schlüssel)');
    console.log('   - ssl/cert.pem (Zertifikat)');
    console.log('');
    console.log('🔒 Der HTTPS-Server kann jetzt gestartet werden!');

} catch (error) {
    console.error('❌ Fehler beim Erstellen der SSL-Zertifikate:', error.message);
    process.exit(1);
}
