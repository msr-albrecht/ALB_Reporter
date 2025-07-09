import { ReportData } from './database';
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
    mitarbeiter: Array<{
        name: string;
        qualifikation: string;
    }>;
    arbeitsdatum: string;
    arbeitszeit: string;
    zusatzInformationen?: string;
    individualDates?: {
        [employeeName: string]: string;
    };
    individualTimes?: {
        [employeeName: string]: string;
    };
    materials?: Array<{
        menge: string;
        einheit: string;
        beschreibung: string;
    }>;
    wzData?: {
        [employeeName: string]: {
            includeWZ: boolean;
            kuerzel: string;
        };
    };
    regieTextData?: {
        behinderungen: string;
        regieleistungen: string;
        bedenkanmeldung: string;
    };
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
export declare class ReportService {
    private dbManager;
    private bautagesberichtGenerator;
    private regieGenerator;
    constructor();
    createReport(request: CreateReportRequest): Promise<CreateReportResponse>;
    getAllReports(): Promise<GetReportsResponse>;
    getReportById(id: string): Promise<ReportData | null>;
    downloadReport(id: string): Promise<{
        filePath: string;
        fileName: string;
    } | null>;
    deleteReport(id: string): Promise<boolean>;
    close(): void;
}
//# sourceMappingURL=reportService.d.ts.map