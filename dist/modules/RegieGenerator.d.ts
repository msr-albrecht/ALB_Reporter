import { ReportData } from './database';
import { CreateReportRequest } from './reportService';
export interface RegieGeneratorOptions {
    outputDir?: string;
}
export declare class RegieGenerator {
    private outputDir;
    private csvReader;
    constructor(options?: RegieGeneratorOptions);
    private ensureOutputDirectory;
    private formatDate;
    private getCurrentWeek;
    private calculateDuration;
    private createMaterialTable;
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
    private createRegieTextParagraphs;
    private createSignatureRow;
}
//# sourceMappingURL=RegieGenerator.d.ts.map