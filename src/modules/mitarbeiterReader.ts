import * as fs from 'fs';
import * as path from 'path';

export interface MitarbeiterData {
    name: string;
    qualifikation: string;
}

export class MitarbeiterReader {
    private csvPath: string;

    constructor(csvPath: string = './arbeiter.csv') {
        this.csvPath = csvPath;
    }

    async readMitarbeiterData(): Promise<MitarbeiterData[]> {
        try {
            const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
            const lines = csvContent.split('\n').filter(line => line.trim());
            const dataLines = lines.slice(1);
            return dataLines.map(line => {
                const columns = line.split(';');
                return {
                    name: columns[0]?.trim() || '',
                    qualifikation: columns[1]?.trim() || ''
                };
            });
        } catch {
            return [];
        }
    }
}
