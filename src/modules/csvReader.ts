import * as fs from 'fs';
import * as path from 'path';

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

export class CsvReader {
    private csvPath: string;

    constructor(csvPath: string = './projekte.csv') {
        this.csvPath = csvPath;
    }

    async readCsvData(): Promise<CsvData[]> {
        try {
            const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
            const lines = csvContent.split('\n').filter(line => line.trim());
            const dataLines = lines.slice(1);

            return dataLines.map(line => {
                const columns = line.split(';');
                return {
                    kuerzel: columns[0]?.trim() || '',
                    kunde: columns[1]?.trim() || '',
                    strasseKunde: columns[2]?.trim() || '',
                    ortKunde: columns[3]?.trim() || '',
                    baustelle: columns[4]?.trim() || '',
                    strasseBaustelle: columns[5]?.trim() || '',
                    ortBaustelle: columns[6]?.trim() || '',
                    auftragsNr: columns[7]?.trim() || '',
                    vergNr: columns[8]?.trim() || '',
                    wz: columns[9]?.trim() || ''
                };
            });
        } catch (error) {
            return [];
        }
    }
}
