import { ReportData } from './database';
import { CreateReportRequest } from './reportService';
export interface BautagesberichtGeneratorOptions {
    outputDir?: string;
}
export declare class BautagesberichtGenerator {
    private outputDir;
    private weatherService;
    constructor(options?: BautagesberichtGeneratorOptions);
    private ensureOutputDirectory;
    private formatDate;
    private getCurrentWeek;
    private calculateDuration;
    generateWordDocument(reportData: ReportData, requestData: CreateReportRequest): Promise<{
        filePath: string;
        fileName: string;
    }>;
    private createDocumentHeader;
    private createMainTable;
    private createHeaderRow;
    private createCustomerRow;
    private createCustomerAddressRow;
    private createConstructionSiteRow;
    private createConstructionAddressRow;
    private createEmployeeHeaderRow;
    private createEmployeeRows;
    private createEmptyEmployeeRows;
    private createWorkDescriptionHeaderRow;
    private createWorkDescriptionRow;
    private createWorkDescriptionParagraphs;
    private createMaterialTable;
    private createSignatureRow;
}
//# sourceMappingURL=BautagesberichtGenerator.d.ts.map