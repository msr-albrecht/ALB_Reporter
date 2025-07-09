export interface MitarbeiterData {
    name: string;
    qualifikation: string;
}
export declare class MitarbeiterReader {
    private csvPath;
    constructor(csvPath?: string);
    readMitarbeiterData(): Promise<MitarbeiterData[]>;
}
//# sourceMappingURL=mitarbeiterReader.d.ts.map