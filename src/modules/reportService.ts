import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager, ReportData } from './database';
import { BautagesberichtGenerator } from './BautagesberichtGenerator';
import { RegieGenerator } from './RegieGenerator';
import { FileServerService } from './fileServer';
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
    materials?: Array<{menge: string, einheit: string, beschreibung: string}>;
    wzData?: {[employeeName: string]: {includeWZ: boolean, kuerzel: string}};
    regieTextData?: {behinderungen?: string, regieleistungen?: string, bedenkanmeldung?: string, durchgefuehrte_arbeiten?: string};
    customReportNumber?: number; // Benutzerdefinierte Berichtsnummer
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
    private fileServer: FileServerService;

    constructor() {
        this.dbManager = new DatabaseManager();
        this.fileServer = new FileServerService();

        this.bautagesberichtGenerator = new BautagesberichtGenerator();
        this.regieGenerator = new RegieGenerator();

        console.log('✅ File-Server-Integration aktiviert');
    }

    private ensureDirectoryExists(dirPath: string): void {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
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

            // Kalenderwoche und Jahr berechnen
            const arbeitsDate = new Date(request.arbeitsdatum);
            const jahr = arbeitsDate.getFullYear();
            // Kalenderwoche berechnen
            function getWeekNumber(d: Date) {
                d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
                const dayNum = d.getUTCDay() || 7;
                d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
                return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
            }
            const kalenderwoche = getWeekNumber(arbeitsDate);
            const kuerzel = request.kuerzel.trim();
            // Pfad je nach Dokumenttyp generieren
            let subDir = '';
            switch (request.documentType) {
                case 'bautagesbericht':
                    subDir = 'bautagesberichte';
                    break;
                case 'regiebericht':
                    subDir = 'regieberichte';
                    break;
                case 'regieantrag':
                    subDir = 'regieantraege';
                    break;
                default:
                    subDir = 'berichte';
            }
            const savePath = path.join('berichte', `ASAM(${kuerzel})`, subDir, `${jahr}`, `${kalenderwoche}`);

            const reportData: Omit<ReportData, 'reportNumber'> = {
                id: reportId,
                documentType: request.documentType,
                kuerzel: kuerzel,
                mitarbeiter: JSON.stringify(request.mitarbeiter),
                createdAt,
                fileName: '',
                filePath: savePath,
                arbeitsdatum: request.arbeitsdatum,
                arbeitszeit: request.arbeitszeit,
                ...(request.zusatzInformationen && { zusatzInformationen: request.zusatzInformationen })
            };

            const savedReport = await this.dbManager.saveReport(reportData, request.customReportNumber);

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

            const { filePath, fileName } = await generator.generateWordDocument(savedReport, request);

            const uploadResult = await this.fileServer.uploadFile(filePath, fileName, request.documentType);

            if (!uploadResult.success) {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
                await this.dbManager.deleteReport(reportId);

                return {
                    success: false,
                    message: `Upload fehlgeschlagen: ${uploadResult.error || 'Unbekannter Fehler'}`
                };
            }

            const finalReportData = {
                ...reportData,
                fileName,
                filePath: uploadResult.localPath || '',
                fileUrl: uploadResult.fileUrl || ''
            };

            await this.dbManager.deleteReport(reportId);
            // Wichtig: Verwende die bereits vergebene Berichtsnummer vom ersten Speichervorgang
            const finalReport = await this.dbManager.saveReport(finalReportData, savedReport.reportNumber);

            return {
                success: true,
                message: 'Bericht erfolgreich erstellt',
                reportData: finalReport,
                downloadUrl: `/api/reports/${finalReport.id}/download`
            };

        } catch (error) {
            return {
                success: false,
                message: `Fehler beim Erstellen: ${(error as Error).message}`
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

    async downloadReport(id: string): Promise<{ filePath?: string; fileName: string; downloadUrl?: string } | null> {
        try {
            const report = await this.dbManager.getReportById(id);
            if (!report) {
                return null;
            }

            if (report.fileUrl) {
                return {
                    fileName: report.fileName,
                    downloadUrl: report.fileUrl
                };
            }

            if (fs.existsSync(report.filePath)) {
                return {
                    filePath: report.filePath,
                    fileName: report.fileName
                };
            }

            return null;
        } catch (error) {
            return null;
        }
    }

    async clearAllReports(): Promise<{ success: boolean; deletedCount?: number }> {
        try {
            const result = await this.dbManager.clearAllReports();
            return {
                success: true,
                deletedCount: result.deletedCount
            };
        } catch (error) {
            console.error('Fehler beim Leeren der Datenbank:', error);
            return {
                success: false
            };
        }
    }

    async deleteReport(id: string): Promise<{ success: boolean; message?: string }> {
        try {
            const report = await this.dbManager.getReportById(id);
            if (!report) {
                return {
                    success: false,
                    message: 'Bericht nicht gefunden'
                };
            }

            console.log(`🗑️ Lösche Bericht: ${report.fileName} (ID: ${id})`);

            // Versuche zuerst, die Datei über den File-Server zu löschen
            let fileDeleteSuccess = false;
            let fileDeleteMessage = '';

            if (report.fileName) {
                try {
                    const deleteResult = await this.fileServer.deleteFile(report.fileName);
                    fileDeleteSuccess = deleteResult.success;
                    fileDeleteMessage = deleteResult.message || deleteResult.error || '';

                    if (deleteResult.success) {
                        console.log(`✅ Datei erfolgreich über File-Server gelöscht: ${report.fileName}`);
                    } else {
                        console.warn(`⚠️ File-Server-Delete fehlgeschlagen: ${deleteResult.error}`);
                    }
                } catch (fileServerError) {
                    console.warn(`⚠️ Fehler beim File-Server-Delete:`, fileServerError);
                }
            }

            // Fallback: Versuche lokales Löschen falls File-Server-Delete fehlgeschlagen ist
            if (!fileDeleteSuccess && report.filePath) {
                // Versuche verschiedene Pfad-Varianten
                const possiblePaths = [];

                // 1. Der lokale Pfad aus der Datenbank
                if (report.filePath) {
                    possiblePaths.push(report.filePath);
                }

                // 2. Konstruiere den Storage-Pfad basierend auf dem Dateinamen
                if (report.fileName) {
                    // Extrahiere das Datum aus dem Dateinamen
                    const fileNameParts = report.fileName.split('_');
                    let year, month;

                    if (fileNameParts.length >= 4) {
                        year = fileNameParts[2]; // YYYY
                        month = fileNameParts[3]; // MM
                    } else {
                        // Fallback: verwende das Erstellungsdatum des Berichts
                        const createdDate = new Date(report.createdAt);
                        year = createdDate.getFullYear().toString();
                        month = (createdDate.getMonth() + 1).toString().padStart(2, '0');
                    }

                    // Bestimme den korrekten Storage-Unterordner
                    let storageSubDir = '';
                    switch (report.documentType) {
                        case 'bautagesbericht':
                            storageSubDir = 'bautagesberichte';
                            break;
                        case 'regiebericht':
                            storageSubDir = 'regieberichte';
                            break;
                        case 'regieantrag':
                            storageSubDir = 'regieantraege';
                            break;
                        default:
                            storageSubDir = 'berichte';
                    }

                    // Konstruiere den File-Server Storage-Pfad
                    const storagePath = `/app/storage/berichte/${storageSubDir}/${year}/${month}/${report.fileName}`;
                    possiblePaths.push(storagePath);
                }

                // 3. Alternative Pfade
                possiblePaths.push(
                    `/app/storage/${report.fileName}`,
                    `/app/storage/berichte/${report.fileName}`,
                    `/tmp/berichte_temp/${report.fileName}`
                );

                // Durchsuche alle möglichen Pfade
                for (const testPath of possiblePaths) {
                    if (testPath && fs.existsSync(testPath)) {
                        try {
                            fs.unlinkSync(testPath);
                            console.log(`🗑️ Datei lokal gelöscht: ${testPath}`);
                            fileDeleteSuccess = true;
                            fileDeleteMessage = `Datei lokal gelöscht: ${testPath}`;
                            break;
                        } catch (fileError) {
                            console.warn(`⚠️ Fehler beim lokalen Löschen: ${testPath}`, fileError);
                        }
                    }
                }

                // Wenn immer noch nicht gefunden, versuche rekursive Suche
                if (!fileDeleteSuccess) {
                    try {
                        const found = await this.searchAndDeleteFile(report.fileName);
                        if (found) {
                            fileDeleteSuccess = true;
                            fileDeleteMessage = 'Datei durch rekursive Suche gefunden und gelöscht';
                        }
                    } catch (searchError) {
                        console.warn('Fehler bei rekursiver Suche:', searchError);
                    }
                }
            }

            // Lösche den Eintrag aus der Datenbank (auch wenn Datei nicht gefunden)
            const deleted = await this.dbManager.deleteReport(id);

            if (deleted) {
                const successMessage = fileDeleteSuccess
                    ? `Bericht und Datei erfolgreich gelöscht (${fileDeleteMessage})`
                    : `Bericht aus Datenbank gelöscht (Datei war bereits entfernt oder nicht auffindbar)`;

                console.log(`🗑️ Bericht aus Datenbank gelöscht: ${report.fileName} (ID: ${id})`);
                return {
                    success: true,
                    message: successMessage
                };
            } else {
                return {
                    success: false,
                    message: 'Fehler beim Löschen aus der Datenbank'
                };
            }
        } catch (error) {
            console.error('Fehler beim Löschen des Berichts:', error);
            return {
                success: false,
                message: 'Fehler beim Löschen des Berichts'
            };
        }
    }

    // Hilfsfunktion um Dateien im Storage-Verzeichnis zu suchen und zu löschen
    private async searchAndDeleteFile(fileName: string): Promise<boolean> {
        const searchDirs = [
            '/app/storage',
            '/app/storage/berichte',
            '/app/storage/berichte/bautagesberichte',
            '/app/storage/berichte/regieberichte',
            '/app/storage/berichte/regieantraege'
        ];

        for (const searchDir of searchDirs) {
            if (fs.existsSync(searchDir)) {
                try {
                    const result = this.searchFileRecursively(searchDir, fileName);
                    if (result) {
                        fs.unlinkSync(result);
                        console.log(`🗑️ Datei durch Suche gefunden und gelöscht: ${result}`);
                        return true;
                    }
                } catch (error) {
                    console.warn(`⚠️ Fehler bei der Suche in ${searchDir}:`, error);
                }
            }
        }
        return false;
    }

    // Rekursive Dateisuche
    private searchFileRecursively(dir: string, fileName: string): string | null {
        try {
            const files = fs.readdirSync(dir);

            for (const file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);

                if (stat.isDirectory()) {
                    const result = this.searchFileRecursively(fullPath, fileName);
                    if (result) return result;
                } else if (file === fileName) {
                    return fullPath;
                }
            }
        } catch (error) {
            // Ignoriere Fehler bei der Verzeichnissuche
        }
        return null;
    }
}
