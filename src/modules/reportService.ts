import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager, ReportData } from './database';
import { BautagesberichtGenerator } from './BautagesberichtGenerator';
import { RegieGenerator } from './RegieGenerator';
import { CloudStorageService } from './cloudStorageOneDrive';
import * as fs from 'fs';
import * as path from 'path';

export interface CreateReportRequest {
    documentType: 'bautagesbericht' | 'regiebericht' | 'regieantrag';
    kuerzel: string;
    kunde: string;
    strasseKunde: string;
    ortKunde: string;
    baustelle: string;
    strasseBaustelle: string;
    ortBaustelle: string;
    auftragsNr: string;
    vergNr: string;
    mitarbeiter: Array<{name: string, qualifikation: string}>;
    arbeitsdatum: string;
    arbeitszeit: string;
    zusatzInformationen?: string;
    individualDates?: {[employeeName: string]: string};
    individualTimes?: {[employeeName: string]: string};
    materials?: Array<{menge: string, einheit: string, beschreibung: string}>; // Neue Eigenschaft hinzufügen
    wzData?: {[employeeName: string]: {includeWZ: boolean, kuerzel: string}}; // WZ-Daten hinzufügen
    regieTextData?: {behinderungen: string, regieleistungen: string, bedenkanmeldung: string}; // Neue Regie-Textfelder
}

export interface CreateReportResponse {
    success: boolean;
    message: string;
    reportData?: ReportData;
    downloadUrl?: string;
}

export interface GetReportsResponse {
    success: boolean;
    reports: ReportData[];
    count: number;
}

export class ReportService {
    private dbManager: DatabaseManager;
    private bautagesberichtGenerator: BautagesberichtGenerator;
    private regieGenerator: RegieGenerator;
    private cloudStorage: CloudStorageService;

    constructor() {
        this.dbManager = new DatabaseManager();
        this.cloudStorage = new CloudStorageService();

        // Ensure output directories exist with proper permissions
        this.ensureDirectoryExists('./generated_reports/bautagesberichte');
        this.ensureDirectoryExists('./generated_reports/regieberichte');

        this.bautagesberichtGenerator = new BautagesberichtGenerator({
            outputDir: './generated_reports/bautagesberichte'
        });
        this.regieGenerator = new RegieGenerator({
            outputDir: './generated_reports/regieberichte'
        });
    }

    private ensureDirectoryExists(dirPath: string): void {
        try {
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true, mode: 0o755 });
                console.log(`Verzeichnis erstellt: ${dirPath}`);
            }

            // Test write permissions
            const testFile = path.join(dirPath, '.write_test');
            fs.writeFileSync(testFile, 'test');
            fs.unlinkSync(testFile);
            console.log(`Schreibberechtigung bestätigt für: ${dirPath}`);
        } catch (error) {
            console.error(`Fehler beim Erstellen/Testen des Verzeichnisses ${dirPath}:`, error);

            // Try alternative approach - create in current working directory
            const alternativePath = path.join(process.cwd(), dirPath);
            try {
                if (!fs.existsSync(alternativePath)) {
                    fs.mkdirSync(alternativePath, { recursive: true, mode: 0o755 });
                    console.log(`Alternatives Verzeichnis erstellt: ${alternativePath}`);
                }
            } catch (altError) {
                console.error(`Fehler beim Erstellen des alternativen Verzeichnisses:`, altError);
            }
        }
    }

    async createReport(request: CreateReportRequest): Promise<CreateReportResponse> {
        try {
            if (!request.kuerzel?.trim()) {
                return {
                    success: false,
                    message: 'Kürzel ist ein Pflichtfeld'
                };
            }

            const reportId = uuidv4();
            const createdAt = new Date().toISOString();

            const reportData: Omit<ReportData, 'reportNumber'> = {
                id: reportId,
                documentType: request.documentType,
                kuerzel: request.kuerzel.trim(),
                mitarbeiter: JSON.stringify(request.mitarbeiter),
                createdAt,
                fileName: '',
                filePath: '',
                arbeitsdatum: request.arbeitsdatum,
                arbeitszeit: request.arbeitszeit,
                ...(request.zusatzInformationen && { zusatzInformationen: request.zusatzInformationen })
            };

            const savedReport = await this.dbManager.saveReport(reportData);

            let generator;
            let documentName;
            switch (request.documentType) {
                case 'bautagesbericht':
                    generator = this.bautagesberichtGenerator;
                    documentName = 'Bautagesbericht';
                    break;
                case 'regiebericht':
                case 'regieantrag':
                    generator = this.regieGenerator;
                    documentName = request.documentType === 'regieantrag' ? 'Regieantrag' : 'Regiebericht';
                    break;
                default:
                    generator = this.bautagesberichtGenerator;
                    documentName = 'Bautagesbericht';
            }

            // Dokument lokal generieren
            const { filePath, fileName } = await generator.generateWordDocument(savedReport, request);

            // Versuche Cloud-Upload
            let finalReportData = {
                ...reportData,
                fileName,
                filePath,
                isCloudStored: false
            };

            if (this.cloudStorage.isEnabled()) {
                console.log('Uploade Bericht in die Cloud...');
                const uploadResult = await this.cloudStorage.uploadFile(filePath, fileName, request.documentType);

                if (uploadResult.success && uploadResult.fileUrl) {
                    finalReportData = {
                        ...finalReportData,
                        cloudUrl: uploadResult.fileUrl,
                        cloudKey: uploadResult.localPath || uploadResult.fileUrl, // Verwende localPath oder fileUrl als cloudKey
                        isCloudStored: true,
                        filePath: uploadResult.localPath || filePath // Verwende localPath falls verfügbar
                    };
                    console.log('Cloud-Upload erfolgreich:', uploadResult.fileUrl);
                    if (uploadResult.localPath) {
                        console.log('Datei in lokalen OneDrive-Ordner kopiert:', uploadResult.localPath);
                    }
                } else {
                    console.warn('Cloud-Upload fehlgeschlagen, verwende lokalen Speicher:', uploadResult.error);
                }
            } else {
                console.log('Cloud-Speicher nicht verfügbar, verwende lokalen Speicher');
            }

            // Report mit finalen Daten speichern
            await this.dbManager.deleteReport(reportId);
            const finalReport = await this.dbManager.saveReport(finalReportData);

            const storageInfo = finalReport.isCloudStored ? 'in der Cloud' : 'lokal';

            return {
                success: true,
                message: `${documentName} #${finalReport.reportNumber.toString().padStart(4, '0')} wurde erfolgreich erstellt und ${storageInfo} gespeichert`,
                reportData: finalReport,
                downloadUrl: `/api/reports/${finalReport.id}/download`
            };

        } catch (error) {
            return {
                success: false,
                message: 'Fehler beim Erstellen des Berichts: ' + (error as Error).message
            };
        }
    }

    async getAllReports(): Promise<GetReportsResponse> {
        try {
            const reports = await this.dbManager.getAllReports();
            return {
                success: true,
                reports,
                count: reports.length
            };
        } catch (error) {
            return {
                success: false,
                reports: [],
                count: 0
            };
        }
    }

    async getReportById(id: string): Promise<ReportData | null> {
        try {
            return await this.dbManager.getReportById(id);
        } catch (error) {
            return null;
        }
    }

    async downloadReport(id: string): Promise<{ filePath?: string; fileName: string; downloadUrl?: string; isCloudStored?: boolean } | null> {
        try {
            const report = await this.dbManager.getReportById(id);
            if (!report) {
                return null;
            }

            // Wenn Cloud-gespeichert, generiere Download-URL
            if (report.isCloudStored && report.cloudKey && this.cloudStorage.isEnabled()) {
                const downloadResult = await this.cloudStorage.getDownloadUrl(report.cloudKey);

                if (downloadResult.success && downloadResult.downloadUrl) {
                    return {
                        fileName: report.fileName,
                        downloadUrl: downloadResult.downloadUrl,
                        isCloudStored: true
                    };
                } else {
                    console.error('Fehler beim Generieren der Cloud-Download-URL:', downloadResult.error);
                    return null;
                }
            }

            // Fallback auf lokale Datei
            if (!fs.existsSync(report.filePath)) {
                return null;
            }

            return {
                filePath: report.filePath,
                fileName: report.fileName,
                isCloudStored: false
            };
        } catch (error) {
            return null;
        }
    }

    async deleteReport(id: string): Promise<boolean> {
        try {
            const report = await this.dbManager.getReportById(id);
            if (!report) {
                return false;
            }

            // Cloud-Datei löschen falls vorhanden
            if (report.isCloudStored && report.cloudKey && this.cloudStorage.isEnabled()) {
                const cloudDeleted = await this.cloudStorage.deleteFile(report.cloudKey);
                if (!cloudDeleted) {
                    console.warn('Konnte Cloud-Datei nicht löschen:', report.cloudKey);
                }
            }

            // Lokale Datei löschen falls vorhanden
            if (fs.existsSync(report.filePath)) {
                fs.unlinkSync(report.filePath);
            }

            return await this.dbManager.deleteReport(id);
        } catch (error) {
            return false;
        }
    }

    close(): void {
        this.dbManager.close();
    }
}