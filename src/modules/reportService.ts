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

        // OneDrive ist ZWINGEND erforderlich - keine lokalen Ausgabeverzeichnisse mehr
        if (!this.cloudStorage.isEnabled()) {
            throw new Error('OneDrive-Konfiguration ist zwingend erforderlich. Bitte überprüfen Sie Ihre .env-Datei und stellen Sie sicher, dass ONEDRIVE_SHARE_URL gesetzt ist.');
        }

        // Verwende temporäre Verzeichnisse nur für die Dokumentenerstellung
        const tempDir = '/tmp/berichte_temp';
        this.ensureDirectoryExists(tempDir + '/bautagesberichte');
        this.ensureDirectoryExists(tempDir + '/regieberichte');

        this.bautagesberichtGenerator = new BautagesberichtGenerator({
            outputDir: tempDir + '/bautagesberichte'
        });
        this.regieGenerator = new RegieGenerator({
            outputDir: tempDir + '/regieberichte'
        });

        console.log('OneDrive-Integration aktiviert - Alle Berichte werden ausschließlich in OneDrive gespeichert');
    }

    private ensureDirectoryExists(dirPath: string): void {
        try {
            const fullPath = path.resolve(dirPath);

            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true, mode: 0o777 });
                console.log(`Temporäres Verzeichnis erstellt: ${fullPath}`);
            }

            // Test write permissions
            const testFile = path.join(fullPath, '.write_test_' + Date.now());
            try {
                fs.writeFileSync(testFile, 'test', { mode: 0o666 });
                fs.unlinkSync(testFile);
                console.log(`Schreibberechtigung bestätigt für temporäres Verzeichnis: ${fullPath}`);
            } catch (testError) {
                console.error(`Schreibtest fehlgeschlagen für ${fullPath}:`, testError);
                throw new Error(`Kann nicht in temporäres Verzeichnis schreiben: ${fullPath}`);
            }
        } catch (error) {
            console.error(`Fehler beim Erstellen des temporären Verzeichnisses ${dirPath}:`, error);
            throw error;
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

            // Prüfe OneDrive-Verfügbarkeit VOR der Berichterstellung
            if (!this.cloudStorage.isEnabled()) {
                return {
                    success: false,
                    message: '❌ OneDrive-Speicherung ist zwingend erforderlich, aber nicht verfügbar!\n\n' +
                            'Mögliche Ursachen:\n' +
                            '• ONEDRIVE_SHARE_URL ist nicht in der .env-Datei konfiguriert\n' +
                            '• OneDrive-Service ist nicht erreichbar\n' +
                            '• Netzwerkverbindung zu OneDrive fehlgeschlagen\n\n' +
                            'Bitte überprüfen Sie Ihre OneDrive-Konfiguration und versuchen Sie es erneut.'
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

            // Dokument temporär generieren
            console.log('Erstelle Dokument temporär für OneDrive-Upload...');
            const { filePath, fileName } = await generator.generateWordDocument(savedReport, request);

            // OneDrive-Upload ist ZWINGEND erforderlich
            console.log('Uploade Bericht in OneDrive (ZWINGEND erforderlich)...');
            const uploadResult = await this.cloudStorage.uploadFile(filePath, fileName, request.documentType);

            if (!uploadResult.success) {
                // Lösche die temporäre Datei
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }

                // Lösche den Datenbank-Eintrag wieder
                await this.dbManager.deleteReport(reportId);

                return {
                    success: false,
                    message: `❌ OneDrive-Upload fehlgeschlagen - Bericht konnte nicht gespeichert werden!\n\n` +
                            `Fehlerdetails: ${uploadResult.error || 'Unbekannter Fehler'}\n\n` +
                            `Mögliche Lösungen:\n` +
                            `• Überprüfen Sie Ihre Internetverbindung\n` +
                            `• Stellen Sie sicher, dass die OneDrive Share-URL korrekt konfiguriert ist\n` +
                            `• Prüfen Sie die OneDrive-Berechtigungen\n` +
                            `• Versuchen Sie es in einigen Minuten erneut\n\n` +
                            `Der Bericht wurde NICHT gespeichert, da OneDrive-Speicherung zwingend erforderlich ist.`
                };
            }

            // Lösche die temporäre Datei nach erfolgreichem Upload
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Temporäre Datei gelöscht: ${filePath}`);
            }

            // Speichere finale Report-Daten mit OneDrive-Informationen
            const finalReportData = {
                ...reportData,
                fileName,
                filePath: '', // Keine lokale Datei mehr
                cloudUrl: uploadResult.fileUrl!,
                cloudKey: uploadResult.localPath || uploadResult.fileUrl!,
                isCloudStored: true
            };

            // Report mit finalen Daten speichern
            await this.dbManager.deleteReport(reportId);
            const finalReport = await this.dbManager.saveReport(finalReportData);

            console.log('✅ Bericht erfolgreich in OneDrive gespeichert:', uploadResult.fileUrl);

            return {
                success: true,
                message: `✅ ${documentName} #${finalReport.reportNumber.toString().padStart(4, '0')} wurde erfolgreich erstellt und in OneDrive gespeichert!\n\n` +
                        `📁 OneDrive-Link: ${uploadResult.fileUrl}\n` +
                        `📄 Dateiname: ${fileName}`,
                reportData: finalReport,
                downloadUrl: `/api/reports/${finalReport.id}/download`
            };

        } catch (error) {
            return {
                success: false,
                message: `❌ Unerwarteter Fehler beim Erstellen des Berichts!\n\n` +
                        `Fehlerdetails: ${(error as Error).message}\n\n` +
                        `Falls dieser Fehler weiterhin auftritt, wenden Sie sich an den Administrator.`
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