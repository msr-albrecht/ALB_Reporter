import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager, ReportData } from './database';
import { BautagesberichtGenerator } from './BautagesberichtGenerator';
import { RegieGenerator } from './RegieGenerator';
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

    constructor() {
        this.dbManager = new DatabaseManager();
        this.bautagesberichtGenerator = new BautagesberichtGenerator({
            outputDir: './generated_reports/bautagesberichte'
        });
        this.regieGenerator = new RegieGenerator({
            outputDir: './generated_reports/regieberichte'
        });
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

            const { filePath, fileName } = await generator.generateWordDocument(savedReport, request);

            savedReport.fileName = fileName;
            savedReport.filePath = filePath;

            await this.dbManager.deleteReport(reportId);
            const finalReport = await this.dbManager.saveReport({
                ...reportData,
                fileName,
                filePath,
            });

            return {
                success: true,
                message: `${documentName} #${finalReport.reportNumber.toString().padStart(4, '0')} wurde erfolgreich erstellt`,
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

    async downloadReport(id: string): Promise<{ filePath: string; fileName: string } | null> {
        try {
            const report = await this.dbManager.getReportById(id);
            if (!report) {
                return null;
            }

            if (!fs.existsSync(report.filePath)) {
                return null;
            }

            return {
                filePath: report.filePath,
                fileName: report.fileName
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