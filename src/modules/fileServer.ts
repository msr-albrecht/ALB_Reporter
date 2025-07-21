import * as fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';
import https from 'https';

export interface UploadResult {
    success: boolean;
    fileUrl?: string;
    error?: string;
    localPath?: string;
}

export class FileServerService {
    private baseUrl: string;
    private httpsAgent: https.Agent;

    constructor() {
        this.baseUrl = process.env.FILE_SERVER_URL || 'http://localhost:3003';

        // HTTPS Agent für selbstsignierte Zertifikate (nur für lokale Entwicklung)
        this.httpsAgent = new https.Agent({
            rejectUnauthorized: false, // Akzeptiere selbstsignierte Zertifikate
            requestCert: false
        });

        console.log('📁 File-Server-Integration aktiviert');
        console.log(`🌐 File-Server-URL: ${this.baseUrl}`);
        if (this.baseUrl.startsWith('https://localhost')) {
            console.log('🔓 SSL-Verifikation für localhost deaktiviert (selbstsignierte Zertifikate)');
        }
    }

    async uploadFile(filePath: string, fileName: string, documentType: string = 'document', kuerzel: string): Promise<UploadResult> {
        try {
            const formData = new FormData();
            formData.append('files', fs.createReadStream(filePath));
            formData.append('documentType', documentType);
            formData.append('kuerzel', kuerzel); // Projektkürzel übergeben
            formData.append('originalFileName', fileName); // Sende den gewünschten Dateinamen

            console.log(`📤 Sende Datei an File-Server: ${fileName}`);

            const axiosConfig: any = {
                headers: {
                    ...formData.getHeaders()
                },
                timeout: 30000
            };

            // Verwende HTTPS Agent nur für HTTPS URLs
            if (this.baseUrl.startsWith('https://')) {
                axiosConfig.httpsAgent = this.httpsAgent;
            }

            const response = await axios.post(`${this.baseUrl}/api/upload`, formData, axiosConfig);

            if (response.data.success && response.data.files && response.data.files.length > 0) {
                const uploadedFile = response.data.files[0];

                // Lösche temporäre Datei
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Temporäre Datei gelöscht: ${filePath}`);
                }

                console.log(`💾 Datei erfolgreich hochgeladen: ${uploadedFile.fileName}`);
                console.log(`🔗 Download-URL: ${uploadedFile.downloadUrl}`);

                return {
                    success: true,
                    fileUrl: uploadedFile.downloadUrl,
                    localPath: uploadedFile.storagePath
                };
            } else {
                throw new Error('File-Server-Antwort ungültig');
            }

        } catch (error) {
            console.error('Fehler beim Upload:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Upload-Fehler'
            };
        }
    }

    async deleteFile(fileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
            console.log(`🗑️ Sende Delete-Request an File-Server für: ${fileName}`);

            const axiosConfig: any = {
                timeout: 10000
            };

            // Verwende HTTPS Agent nur für HTTPS URLs
            if (this.baseUrl.startsWith('https://')) {
                axiosConfig.httpsAgent = this.httpsAgent;
            }

            const response = await axios.delete(`${this.baseUrl}/api/delete/${fileName}`, axiosConfig);

            if (response.data.success) {
                console.log(`✅ Datei erfolgreich vom File-Server gelöscht: ${fileName}`);
                console.log(`📁 Gelöschter Pfad: ${response.data.deletedPath}`);

                return {
                    success: true,
                    message: 'Datei erfolgreich vom File-Server gelöscht'
                };
            } else {
                console.warn(`⚠️ File-Server konnte Datei nicht löschen: ${response.data.error}`);
                return {
                    success: false,
                    error: response.data.error || 'Unbekannter Fehler beim Löschen'
                };
            }

        } catch (error) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as any;
                if (axiosError.response?.status === 404) {
                    console.log(`📁 Datei nicht auf File-Server gefunden: ${fileName}`);
                    return {
                        success: true, // Behandle als erfolgreich, da Datei bereits weg ist
                        message: 'Datei war bereits nicht mehr auf dem File-Server vorhanden'
                    };
                }
            }

            console.error('❌ Fehler beim Delete-Request an File-Server:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Delete-Request fehlgeschlagen'
            };
        }
    }
}
