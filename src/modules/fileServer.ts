import * as fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

export interface UploadResult {
    success: boolean;
    fileUrl?: string;
    error?: string;
    localPath?: string;
}

export class FileServerService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = process.env.FILE_SERVER_URL || 'http://localhost:3003';
        console.log('📁 File-Server-Integration aktiviert');
        console.log(`🌐 File-Server-URL: ${this.baseUrl}`);
    }

    async uploadFile(filePath: string, fileName: string, documentType: string = 'document'): Promise<UploadResult> {
        try {
            const formData = new FormData();
            formData.append('files', fs.createReadStream(filePath));
            formData.append('documentType', documentType);
            formData.append('kuerzel', 'AUTO');
            formData.append('originalFileName', fileName);

            console.log(`📤 Sende Datei an File-Server: ${fileName}`);

            const response = await axios.post(`${this.baseUrl}/api/upload`, formData, {
                headers: {
                    ...formData.getHeaders()
                },
                timeout: 30000
            });

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
}
