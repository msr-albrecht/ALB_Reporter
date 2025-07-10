import * as fs from 'fs';
import * as path from 'path';

export interface OneDriveStorageConfig {
    shareUrl: string;
    folderPath?: string;
    localOneDrivePath?: string;
}

export interface UploadResult {
    success: boolean;
    fileUrl?: string;
    error?: string;
    localPath?: string;
}

export interface DownloadResult {
    success: boolean;
    downloadUrl?: string;
    error?: string;
}

export class CloudStorageService {
    private config: OneDriveStorageConfig | null = null;
    private enabled: boolean;

    constructor() {
        this.config = this.loadConfig();

        if (!this.config) {
            console.warn('OneDrive Konfiguration nicht gefunden. Lokaler Speicher wird verwendet.');
            this.enabled = false;
            return;
        }

        this.enabled = true;
        console.log('OneDrive Integration über Share-URL aktiviert');
        console.log(`OneDrive Ordner-Link: ${this.config.shareUrl}`);
    }

    private loadConfig(): OneDriveStorageConfig | null {
        const shareUrl = process.env.ONEDRIVE_SHARE_URL;

        if (!shareUrl) {
            console.warn('OneDrive Share-URL nicht konfiguriert. Setze ONEDRIVE_SHARE_URL in der .env-Datei.');
            return null;
        }

        // Für Docker: Verwende NIEMALS lokale Pfade, nur Share-URL
        const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV === 'true';
        let localOneDrivePath: string | undefined;

        if (!isDocker) {
            // Nur für lokale Entwicklung: Versuche lokale OneDrive-Pfade zu finden
            const userProfile = process.env.USERPROFILE || process.env.HOME;

            if (userProfile) {
                const possiblePaths = [
                    path.join(userProfile, 'OneDrive'),
                    path.join(userProfile, 'OneDrive - Personal'),
                    path.join(userProfile, 'OneDrive - Business'),
                ];

                for (const possiblePath of possiblePaths) {
                    if (fs.existsSync(possiblePath)) {
                        localOneDrivePath = possiblePath;
                        break;
                    }
                }
            }

            // Prüfe ob der OneDrive-Pfad existiert (nur für lokale Entwicklung)
            if (localOneDrivePath && !fs.existsSync(localOneDrivePath)) {
                console.warn(`OneDrive-Pfad nicht gefunden: ${localOneDrivePath}`);
                localOneDrivePath = undefined;
            }
        }

        const config: OneDriveStorageConfig = {
            shareUrl,
            folderPath: process.env.ONEDRIVE_FOLDER_PATH || 'Berichte'
        };

        if (localOneDrivePath && !isDocker) {
            config.localOneDrivePath = localOneDrivePath;
            console.log(`OneDrive lokaler Pfad gefunden: ${localOneDrivePath}`);
        } else {
            if (isDocker) {
                console.log('Docker-Umgebung erkannt: Verwende nur OneDrive Share-URL (kein lokaler Pfad)');
            } else {
                console.warn('Kein lokaler OneDrive-Pfad verfügbar. Nur Share-URL wird verwendet.');
            }
        }

        return config;
    }

    isEnabled(): boolean {
        return this.enabled;
    }

    private createFolderPath(documentType: string): string {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');

        const typeFolder = {
            'bautagesbericht': 'bautagesberichte',
            'regiebericht': 'regieberichte'
        }[documentType] || documentType;

        return path.join(this.config?.folderPath || 'Berichte', typeFolder, year.toString(), month);
    }

    async uploadFile(filePath: string, fileName: string, documentType: string = 'document'): Promise<UploadResult> {
        if (!this.enabled || !this.config) {
            return {
                success: false,
                error: 'OneDrive nicht konfiguriert'
            };
        }

        try {
            // Versuche zuerst OneDrive-Upload (falls verfügbar)
            if (this.config.localOneDrivePath) {
                const targetFolder = path.join(this.config.localOneDrivePath, this.createFolderPath(documentType));

                // Ordner erstellen falls nicht vorhanden
                if (!fs.existsSync(targetFolder)) {
                    fs.mkdirSync(targetFolder, { recursive: true });
                }

                const targetPath = path.join(targetFolder, fileName);
                fs.copyFileSync(filePath, targetPath);

                console.log(`Datei in lokalen OneDrive-Ordner kopiert: ${targetPath}`);

                // OneDrive-Upload erfolgreich - lösche die ursprüngliche Datei aus generated_reports
                if (fs.existsSync(filePath) && filePath.includes('generated_reports')) {
                    fs.unlinkSync(filePath);
                    console.log(`Ursprüngliche Datei aus generated_reports gelöscht: ${filePath}`);
                }

                return {
                    success: true,
                    fileUrl: this.config.shareUrl,
                    localPath: targetPath
                };
            }

            // Fallback: Nur Share-URL zurückgeben (Datei bleibt in generated_reports)
            console.log('OneDrive lokaler Pfad nicht verfügbar, Datei verbleibt in generated_reports');
            return {
                success: true,
                fileUrl: this.config.shareUrl
            };

        } catch (error) {
            console.error('Fehler beim Hochladen in OneDrive:', error);
            console.log('Datei verbleibt in generated_reports als Fallback');
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unbekannter Fehler'
            };
        }
    }

    async getDownloadUrl(_fileName: string, _documentType: string = 'document'): Promise<DownloadResult> {
        if (!this.enabled || !this.config) {
            return {
                success: false,
                error: 'OneDrive nicht konfiguriert'
            };
        }

        // Bei Share-URLs geben wir immer den Ordner-Link zurück
        return {
            success: true,
            downloadUrl: this.config.shareUrl
        };
    }

    async listFiles(documentType: string = 'document'): Promise<string[]> {
        if (!this.enabled || !this.config) {
            return [];
        }

        // Lokale Dateien auflisten falls OneDrive-Ordner verfügbar
        if (this.config.localOneDrivePath) {
            try {
                const targetFolder = path.join(this.config.localOneDrivePath, this.createFolderPath(documentType));

                if (fs.existsSync(targetFolder)) {
                    return fs.readdirSync(targetFolder).filter(file =>
                        file.endsWith('.docx') || file.endsWith('.pdf')
                    );
                }
            } catch (error) {
                console.error('Fehler beim Auflisten der Dateien:', error);
            }
        }

        return [];
    }

    getShareUrl(): string | null {
        return this.config?.shareUrl || null;
    }

    async deleteFile(filePathOrKey: string): Promise<boolean> {
        if (!this.enabled || !this.config) {
            return false;
        }

        try {
            // Versuche lokale Datei zu löschen falls sie existiert
            if (fs.existsSync(filePathOrKey)) {
                fs.unlinkSync(filePathOrKey);
                console.log(`Lokale OneDrive-Datei gelöscht: ${filePathOrKey}`);
                return true;
            }

            // Falls es sich um einen relativen Pfad handelt, versuche im OneDrive-Ordner
            if (this.config.localOneDrivePath && !path.isAbsolute(filePathOrKey)) {
                const fullPath = path.join(this.config.localOneDrivePath, filePathOrKey);
                if (fs.existsSync(fullPath)) {
                    fs.unlinkSync(fullPath);
                    console.log(`Lokale OneDrive-Datei gelöscht: ${fullPath}`);
                    return true;
                }
            }

            console.warn(`Datei nicht gefunden zum Löschen: ${filePathOrKey}`);
            return false;
        } catch (error) {
            console.error('Fehler beim Löschen der Datei:', error);
            return false;
        }
    }

    getStatus(): { enabled: boolean; configured: boolean; shareUrl?: string; localPath?: string } {
        const result: { enabled: boolean; configured: boolean; shareUrl?: string; localPath?: string } = {
            enabled: this.enabled,
            configured: this.config !== null
        };

        if (this.config?.shareUrl) {
            result.shareUrl = this.config.shareUrl;
        }

        if (this.config?.localOneDrivePath) {
            result.localPath = this.config.localOneDrivePath;
        }

        return result;
    }
}
