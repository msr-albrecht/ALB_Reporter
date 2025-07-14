# Server URL Konfiguration für Deployment

## Problem
Die Download-URLs zeigen aktuell auf `localhost:3003` anstatt auf Ihre echte Server-Domain.

## Lösung

### 1. .env Datei anpassen
Ersetzen Sie in der `.env` Datei `your-domain.com` mit Ihrer echten Server-Domain/IP:

```env
# Beispiele:
PUBLIC_FILE_SERVER_URL=https://ihr-server.de:3003
SERVER_URL=https://ihr-server.de:4055

# Oder mit IP-Adresse:
PUBLIC_FILE_SERVER_URL=https://123.456.789.101:3003
SERVER_URL=https://123.456.789.101:4055
```

### 2. docker-compose.yml anpassen
Ersetzen Sie in der `docker-compose.yml` ebenfalls `your-domain.com`:

```yaml
environment:
  - PUBLIC_FILE_SERVER_URL=https://ihr-server.de:3003
  - SERVER_URL=https://ihr-server.de:4055
```

### 3. Container neu starten
Nach den Änderungen müssen die Container neu gebaut und gestartet werden:

```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 4. Download-URLs testen
Nach dem Neustart sollten die Download-URLs so aussehen:
```
https://ihr-server.de:3003/files/berichte/bautagesberichte/2025/07/BTB_AUTO_2025_07_14_09_27_48_BTB_BYS_2025_07_15_001.docx
```

## Wichtige Hinweise

- **FILE_SERVER_URL**: Bleibt `http://file-server:3003` (für interne Container-Kommunikation)
- **PUBLIC_FILE_SERVER_URL**: Muss auf Ihre echte Domain zeigen (für externe Downloads)
- **SERVER_URL**: Muss auf Ihre echte Domain zeigen (für das Hauptprogramm)

## SSL/HTTPS Konfiguration
Wenn Sie HTTPS verwenden, stellen Sie sicher, dass:
- Ihr Server ein gültiges SSL-Zertifikat hat
- Port 3003 und 4055 in der Firewall freigegeben sind
- DNS korrekt konfiguriert ist

## Troubleshooting
- Prüfen Sie die Container-Logs: `docker-compose logs -f`
- Testen Sie die Health-Checks: `https://ihr-server.de:3003/health`
- Überprüfen Sie die Firewall-Einstellungen
