export interface ReportData {
    id?: string;
    documentType: string;
    kuerzel: string;
    mitarbeiter: string;
    reportNumber: number;
    createdAt: string;
    fileName: string;
    filePath: string;
    cloudUrl?: string;
    cloudKey?: string;
    isCloudStored?: boolean;
    arbeitsdatum?: string;
    arbeitszeit?: string;
    zusatzInformationen?: string;
}
export declare class DatabaseManager {
    private db;
    private dbPath;
    private tableNames;
    constructor(dbPath?: string);
    private getTableName;
    private initializeDatabase;
    private createTable;
    private updateTableSchema;
    getNextReportNumber(kuerzel: string, documentType: string): Promise<number>;
    saveReport(reportData: Omit<ReportData, 'reportNumber'>): Promise<ReportData>;
    getAllReports(): Promise<ReportData[]>;
    getReportsByType(documentType: string): Promise<ReportData[]>;
    getReportById(id: string): Promise<ReportData | null>;
    private getReportByIdFromTable;
    deleteReport(id: string): Promise<boolean>;
    private deleteReportFromTable;
    close(): void;
}
//# sourceMappingURL=database.d.ts.map