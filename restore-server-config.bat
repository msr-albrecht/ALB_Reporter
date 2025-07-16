@echo off
echo ========================================
echo   ZURÜCK ZUR SERVER-KONFIGURATION
echo ========================================
echo.

REM Prüfen ob Backup existiert
if not exist .env.backup (
    echo ❌ Kein Backup gefunden! (.env.backup nicht vorhanden)
    echo    Die ursprüngliche Server-Konfiguration kann nicht wiederhergestellt werden.
    pause
    exit /b 1
)

REM Server-Konfiguration wiederherstellen
copy .env.backup .env >nul
echo ✓ Server-Konfiguration wiederhergestellt

REM File-Server Konfiguration wiederherstellen falls Backup vorhanden
if exist file-server\.env.backup (
    copy file-server\.env.backup file-server\.env >nul
    echo ✓ File-Server Konfiguration wiederhergestellt
) else (
    if exist file-server\.env (
        del file-server\.env >nul
        echo ✓ Lokale File-Server Konfiguration entfernt
    )
)

echo.
echo Konfiguration:
echo - Server: https://139.162.154.60:4055
echo - File-Server: https://139.162.154.60:3003
echo - Dateien werden auf dem Server gespeichert
echo.
echo ✓ Zurück zur ursprünglichen Server-Konfiguration
echo.
echo Hinweis: Starten Sie die Anwendung neu, damit die Änderungen wirksam werden.

pause
