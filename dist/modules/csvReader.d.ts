export interface CsvData {
    kuerzel: string;
    kunde: string;
    strasseKunde: string;
    ortKunde: string;
    baustelle: string;
    strasseBaustelle: string;
    ortBaustelle: string;
    auftragsNr: string;
    vergNr: string;
    wz: string;
}
export declare class CsvReader {
    private csvPath;
    constructor(csvPath?: string);
    readCsvData(): Promise<CsvData[]>;
}
//# sourceMappingURL=csvReader.d.ts.map