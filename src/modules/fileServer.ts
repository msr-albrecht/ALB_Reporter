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
        this.httpsAgent = new https.Agent({ rejectUnauthorized: false, requestCert: false });
    }

    async uploadFile(filePath: string, fileName: string, documentType: string = 'document', kuerzel: string, arbeitsdatum: string): Promise<UploadResult> {
        try {
            const formData = new FormData();
            formData.append('files', fs.createReadStream(filePath));
            formData.append('documentType', documentType);
            formData.append('kuerzel', kuerzel);
            formData.append('originalFileName', fileName);
            formData.append('arbeitsdatum', arbeitsdatum);
            const axiosConfig: any = {
                headers: { ...formData.getHeaders() },
                timeout: 30000
            };
            if (this.baseUrl.startsWith('https://')) {
                axiosConfig.httpsAgent = this.httpsAgent;
            }
            const response = await axios.post(`${this.baseUrl}/api/upload`, formData, axiosConfig);
            if (response.data.success && response.data.files && response.data.files.length > 0) {
                const uploadedFile = response.data.files[0];
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                return {
                    success: true,
                    fileUrl: uploadedFile.downloadUrl,
                    localPath: uploadedFile.storagePath
                };
            } else {
                throw new Error('File-Server-Antwort ungültig');
            }
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Upload-Fehler'
            };
        }
    }

    async deleteFile(fileName: string): Promise<{ success: boolean; message?: string; error?: string }> {
        try {
            const axiosConfig: any = { timeout: 10000 };
            if (this.baseUrl.startsWith('https://')) {
                axiosConfig.httpsAgent = this.httpsAgent;
            }
            const response = await axios.delete(`${this.baseUrl}/api/delete/${fileName}`, axiosConfig);
            if (response.data.success) {
                return { success: true, message: 'Datei erfolgreich vom File-Server gelöscht' };
            } else {
                return { success: false, error: response.data.error || 'Unbekannter Fehler beim Löschen' };
            }
        } catch (error) {
            if (error && typeof error === 'object' && 'response' in error) {
                const axiosError = error as any;
                if (axiosError.response?.status === 404) {
                    return { success: true, message: 'Datei war bereits nicht mehr auf dem File-Server vorhanden' };
                }
            }
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Delete-Request fehlgeschlagen'
            };
        }
    }
}
