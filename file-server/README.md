# Berichte File-Server

Ein eigenständiger Node.js File-Server speziell für die Berichte-Anwendung.

## 🚀 Features

- **Eigenständiger Server** auf Port 3002
- **Upload & Download** von Dateien mit REST-API
- **Automatische Ordnerstruktur** nach Datum und Typ
- **Sicherheitsfeatures** (Rate Limiting, CORS, Helmet)
- **Health Checks** für Monitoring
- **Docker-Ready** mit persistentem Storage

## 📁 Dateistruktur

Der Server organisiert Dateien automatisch:
```
storage/
├── temp/                           # Temporäre Uploads
└── berichte/
    ├── bautagesberichte/
    │   └── 2025/07/10/ABC/
    │       └── BTB_ABC_2025_07_10_143022_dokument.docx
    ├── regieberichte/
    │   └── 2025/07/10/XYZ/
    │       └── REG_XYZ_2025_07_10_143045_bericht.docx
    └── documents/
        └── 2025/07/10/MISC/
            └── DOC_MISC_2025_07_10_143101_datei.pdf
```

## 🔧 Installation & Start

### Lokal
```bash
cd file-server
npm install
cp .env.example .env
npm start
```

### Mit Docker
```bash
cd file-server
docker-compose up -d
```

## 📡 API-Endpoints

### Upload
```bash
POST http://localhost:3002/api/upload
Content-Type: multipart/form-data

# Formular-Felder:
files: [Datei(en)] (max 10, je 100MB)
documentType: "bautagesbericht" | "regiebericht" | "regieantrag"
kuerzel: "ABC" (für Ordnerstruktur)
customPath: "optional/custom/path" (optional)
```

### Download
```bash
GET http://localhost:3002/files/{pfad}/{datei}
```

### Datei-Info
```bash
GET http://localhost:3002/api/files/{pfad}
```

### Datei löschen
```bash
DELETE http://localhost:3002/api/files/{pfad}/{datei}
```

### Health Check
```bash
GET http://localhost:3002/health
```

### Server-Info
```bash
GET http://localhost:3002/api/info
```

## 💡 Verwendung

### Einfacher Upload (cURL)
```bash
curl -X POST \
  -F "files=@dokument.docx" \
  -F "documentType=bautagesbericht" \
  -F "kuerzel=ABC" \
  http://localhost:3002/api/upload
```

### Upload mit JavaScript
```javascript
const formData = new FormData();
formData.append('files', file);
formData.append('documentType', 'bautagesbericht');
formData.append('kuerzel', 'ABC');

fetch('http://localhost:3002/api/upload', {
    method: 'POST',
    body: formData
})
.then(response => response.json())
.then(data => console.log(data));
```

## 🔒 Sicherheit

- **Rate Limiting**: 1000 Requests/15min, 50 Uploads/15min
- **Dateityp-Filter**: .docx, .doc, .pdf, .jpg, .png, .gif, .txt, .zip
- **Größenlimit**: 100MB pro Datei
- **CORS-Schutz**: Nur konfigurierte Origins
- **Helmet**: Standard-Sicherheits-Headers

## ⚙️ Konfiguration

Erstelle eine `.env` Datei:
```env
FILE_SERVER_PORT=3002
FILE_SERVER_HOST=0.0.0.0
FILE_SERVER_URL=http://localhost:3002
STORAGE_BASE_DIR=./storage
ALLOWED_ORIGINS=http://localhost:4055,https://localhost:4055
```

## 🐳 Docker

### Einzeln starten
```bash
docker-compose up -d
```

### Mit Haupt-Server verbinden
```yaml
# In der Haupt-docker-compose.yml
version: '3.8'
services:
  app:
    environment:
      - FILE_SERVER_URL=http://file-server:3002
    depends_on:
      - file-server
  
  file-server:
    build: ./file-server
    ports:
      - "3002:3002"
```

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:3002/health
```

### Logs anzeigen
```bash
docker-compose logs -f file-server
```

### Storage-Größe prüfen
```bash
docker exec berichte_file_server du -sh /app/storage
```

## 🔧 Troubleshooting

### Server startet nicht
```bash
# Logs prüfen
docker-compose logs file-server

# Port bereits verwendet?
netstat -an | findstr :3002
```

### Upload-Fehler
- Prüfe Dateigröße (max 100MB)
- Prüfe Dateityp (.docx, .doc, .pdf, .jpg, .png erlaubt)
- Prüfe CORS-Einstellungen

### Berechtigungen
```bash
# Storage-Berechtigungen prüfen
docker exec berichte_file_server ls -la /app/storage
```

## 🚀 Integration mit Haupt-Server

Der File-Server kann mit deinem Haupt-Server kommunizieren:

1. **Haupt-Server Konfiguration**:
   ```env
   FILE_SERVER_URL=http://localhost:3002
   ```

2. **Upload aus Haupt-Server**:
   ```javascript
   const response = await fetch('http://localhost:3002/api/upload', {
       method: 'POST',
       body: formData
   });
   ```

## 📝 Backup

### Storage sichern
```bash
docker run --rm -v file-server_file-storage:/data -v $(pwd):/backup alpine tar czf /backup/storage_backup.tar.gz -C /data .
```

### Storage wiederherstellen
```bash
docker run --rm -v file-server_file-storage:/data -v $(pwd):/backup alpine tar xzf /backup/storage_backup.tar.gz -C /data
```
