import { ReportData } from './database';
export interface WordGeneratorOptions {
    outputDir?: string;
}
export declare class WordGenerator {
    private outputDir;
    constructor(options?: WordGeneratorOptions);
    private ensureOutputDirectory;
    private formatDate;
    generateWordDocument(reportData: ReportData): Promise<{
        filePath: string;
        fileName: string;
    }>;
    getOutputDirectory(): string;
}
//# sourceMappingURL=wordGenerator.d.ts.map