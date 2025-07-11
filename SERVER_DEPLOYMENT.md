# Server-Deployment Anleitung

## Übersicht
Diese Anwendung ist für den Betrieb auf einem Server konfiguriert, damit Nutzer von überall darauf zugreifen können.

## Server-Konfiguration

### 1. Umgebungsvariablen konfigurieren
Erstellen Sie eine `.env` Datei basierend auf `.env.example`:

```bash
# Kopieren Sie die Beispiel-Datei
cp .env.example .env
```

Bearbeiten Sie die `.env` Datei:
```env
# Ihre öffentliche Server-URL (WICHTIG!)
SERVER_URL=https://ihre-domain.de:4055

# Optional: Port ändern
PORT=4055
```

### 2. Docker-Compose anpassen
Bearbeiten Sie `docker-compose.yml` und setzen Sie die richtige `SERVER_URL`:

```yaml
environment:
  - SERVER_URL=https://ihre-domain.de:4055
```

### 3. Deployment starten

```bash
# Container bauen und starten
docker-compose up -d

# Logs überwachen
docker-compose logs -f
```

## Zugriff für Nutzer

Nach dem Deployment können Nutzer von überall auf die Anwendung zugreifen:

- **Frontend**: `https://ihre-domain.de:4055`
- **API**: `https://ihre-domain.de:4055/api`
- **Dateien**: `https://ihre-domain.de:4055/files/...`

## Dateistruktur auf dem Server

Alle Berichte werden automatisch organisiert:
```
files/
└── berichte/
    ├── bautagesberichte/
    │   └── 2025/
    │       └── 07/
    │           └── BTB_ABC_2025_07_10_001.docx
    └── regieberichte/
        └── 2025/
            └── 07/
                └── REG_ABC_2025_07_10_001.docx
```

## Persistent Volumes

Die folgenden Daten bleiben auch bei Container-Neustarts erhalten:
- `db-data`: SQLite-Datenbank
- `files-data`: Alle generierten Berichte
- `ssl-data`: SSL-Zertifikate

## SSL-Zertifikate

### Selbstsignierte Zertifikate (Standard)
- Werden automatisch erstellt
- Browser zeigt Sicherheitswarnung
- Für interne Nutzung geeignet

### Echte SSL-Zertifikate (Empfohlen für Produktion)
1. Platzieren Sie `key.pem` und `cert.pem` im `ssl/` Ordner
2. Container neu starten: `docker-compose restart`

## Firewall-Konfiguration

Stellen Sie sicher, dass Port 4055 (oder Ihr gewählter Port) in der Server-Firewall geöffnet ist:

```bash
# Ubuntu/Debian
sudo ufw allow 4055

# CentOS/RHEL
sudo firewall-cmd --permanent --add-port=4055/tcp
sudo firewall-cmd --reload
```

## Troubleshooting

### Container-Logs prüfen
```bash
docker-compose logs app
```

### Dateiberechtigungen prüfen
```bash
docker exec -it berichte_server_container ls -la /app/files
```

### Server-URL testen
```bash
curl -k https://ihre-domain.de:4055/api/health
```

## Backup

### Datenbank sichern
```bash
docker cp berichte_server_container:/app/db/reports.db ./backup_reports.db
```

### Alle Dateien sichern
```bash
docker run --rm -v berichte_files-data:/data -v $(pwd):/backup alpine tar czf /backup/files_backup.tar.gz -C /data .
```

## Updates

```bash
# Code aktualisieren
git pull

# Container neu bauen und starten
docker-compose up -d --build
```
