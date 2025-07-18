import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';

export interface ReportData {
    id?: string;
    documentType: string;
    kuerzel: string;
    mitarbeiter: string;
    reportNumber: number;
    createdAt: string;
    fileName: string;
    filePath: string;
    // Lokaler Dateiserver Felder
    fileUrl?: string;
    arbeitsdatum?: string;
    arbeitszeit?: string;
    zusatzInformationen?: string;
}

export class DatabaseManager {
    private db: sqlite3.Database;
    private dbPath: string;
    private tableNames: Map<string, string>;

    constructor(dbPath?: string) {
        // Verwende Umgebungsvariable oder Standard-Pfad
        this.dbPath = dbPath || process.env.DB_PATH || './reports.db';

        // Erstelle Verzeichnis falls es nicht existiert (für Docker Volume)
        const dbDir = path.dirname(this.dbPath);
        if (!require('fs').existsSync(dbDir)) {
            require('fs').mkdirSync(dbDir, { recursive: true });
        }

        this.tableNames = new Map();

        // Definiere die Tabellennamen für jeden Dokumenttyp
        this.tableNames.set('bautagesbericht', 'bautagesberichte');
        this.tableNames.set('regiebericht', 'regieberichte');
        this.tableNames.set('regieantrag', 'regieantraege');

        this.db = new sqlite3.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            }
        });
        this.initializeDatabase();
    }

    private getTableName(documentType: string): string {
        const tableName = this.tableNames.get(documentType);
        if (!tableName) {
            throw new Error(`Unknown document type: ${documentType}`);
        }
        return tableName;
    }

    private async initializeDatabase(): Promise<void> {
        // Erstelle Tabellen für alle Dokumenttypen
        for (const [documentType, tableName] of this.tableNames) {
            await this.createTable(tableName);
            await this.updateTableSchema(tableName);
        }
    }

    private async createTable(tableName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const createTableQuery = `
                CREATE TABLE IF NOT EXISTS ${tableName} (
                    id TEXT PRIMARY KEY,
                    documentType TEXT NOT NULL,
                    kuerzel TEXT NOT NULL,
                    mitarbeiter TEXT NOT NULL,
                    reportNumber INTEGER NOT NULL,
                    createdAt TEXT NOT NULL,
                    fileName TEXT NOT NULL,
                    filePath TEXT NOT NULL,
                    fileUrl TEXT,
                    arbeitsdatum TEXT,
                    arbeitszeit TEXT,
                    zusatzInformationen TEXT,
                    UNIQUE(kuerzel, reportNumber)
                )
            `;

            this.db.run(createTableQuery, (err) => {
                if (err) {
                    console.error(`Error creating table ${tableName}:`, err);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    private async updateTableSchema(tableName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Prüfe ob die Cloud-Spalten bereits existieren
            this.db.get(`PRAGMA table_info(${tableName})`, (err, rows) => {
                if (err) {
                    console.error(`Error checking table schema for ${tableName}:`, err);
                    reject(err);
                    return;
                }

                // Hole alle Spaltennamen
                this.db.all(`PRAGMA table_info(${tableName})`, (err, columns: any[]) => {
                    if (err) {
                        console.error(`Error getting column info for ${tableName}:`, err);
                        reject(err);
                        return;
                    }

                    const columnNames = columns.map(col => col.name);
                    const alterQueries: string[] = [];

                    // Prüfe und füge fehlende Spalten hinzu
                    if (!columnNames.includes('fileUrl')) {
                        alterQueries.push(`ALTER TABLE ${tableName} ADD COLUMN fileUrl TEXT`);
                    }

                    // Migration für UNIQUE Constraint - erstelle neue Tabelle mit korrekter Struktur
                    this.migrateTableConstraints(tableName).then(() => {
                        // Führe alle ALTER TABLE Befehle aus
                        if (alterQueries.length > 0) {
                            console.log(`Updating schema for table ${tableName}...`);
                            let completed = 0;
                            const total = alterQueries.length;

                            alterQueries.forEach(query => {
                                this.db.run(query, (err) => {
                                    if (err) {
                                        console.error(`Error altering table ${tableName}:`, err);
                                        reject(err);
                                    } else {
                                        completed++;
                                        if (completed === total) {
                                            console.log(`Schema update completed for table ${tableName}`);
                                            resolve();
                                        }
                                    }
                                });
                            });
                        } else {
                            resolve();
                        }
                    }).catch(reject);
                });
            });
        });
    }

    private async migrateTableConstraints(tableName: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Da verschiedene Berichtstypen die gleiche Nummer haben können sollen,
            // ist keine Migration der UNIQUE-Constraint notwendig
            console.log(`✅ Tabelle ${tableName} verwendet korrekte UNIQUE-Constraint (kuerzel, reportNumber)`);
            resolve();
        });
    }

    async getNextReportNumber(kuerzel: string, documentType: string): Promise<number> {
        const tableName = this.getTableName(documentType);
        return new Promise((resolve, reject) => {
            // Hole die höchste reportNumber für dieses Kürzel in DIESER spezifischen Tabelle
            // (nicht gefiltert nach documentType, da jede Tabelle nur einen Dokumenttyp enthält)
            const query = `SELECT COALESCE(MAX(reportNumber), 0) as maxNumber FROM ${tableName} WHERE kuerzel = ?`;
            this.db.get(query, [kuerzel], (err, row: any) => {
                if (err) {
                    console.error('Error getting next report number:', err);
                    reject(err);
                } else {
                    const maxNumber = row.maxNumber || 0;
                    const nextNumber = maxNumber + 1;
                    console.log(`📝 Automatische Berichtsnummer für ${kuerzel} (${documentType}): ${nextNumber} (höchste gefunden: ${maxNumber})`);
                    resolve(nextNumber);
                }
            });
        });
    }

    private async findNextAvailableNumber(kuerzel: string, documentType: string, startNumber: number): Promise<number> {
        let currentNumber = startNumber;
        let existingReport = await this.getReportByNumber(kuerzel, documentType, currentNumber);

        while (existingReport) {
            currentNumber++;
            existingReport = await this.getReportByNumber(kuerzel, documentType, currentNumber);
        }

        return currentNumber;
    }

    async saveReport(reportData: Omit<ReportData, 'reportNumber'>, customReportNumber?: number): Promise<ReportData> {
        let reportNumber: number;

        if (customReportNumber && customReportNumber > 0) {
            // Prüfe ob die benutzerdefinierte Nummer bereits existiert
            const existingReport = await this.getReportByNumber(reportData.kuerzel, reportData.documentType, customReportNumber);
            if (existingReport) {
                throw new Error(`Berichtsnummer ${customReportNumber} für ${reportData.kuerzel} bereits vergeben.`);
            }
            reportNumber = customReportNumber;
            console.log(`📝 Verwende benutzerdefinierte Berichtsnummer: ${reportNumber}`);
        } else {
            // Automatische Nummerierung
            reportNumber = await this.getNextReportNumber(reportData.kuerzel, reportData.documentType);
            console.log(`📝 Automatische Berichtsnummer: ${reportNumber}`);
        }

        const fullReportData: ReportData = { ...reportData, reportNumber };
        const tableName = this.getTableName(reportData.documentType);

        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO ${tableName} (id, documentType, kuerzel, mitarbeiter, reportNumber, createdAt, fileName, filePath, fileUrl, arbeitsdatum, arbeitszeit, zusatzInformationen)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                fullReportData.id,
                fullReportData.documentType,
                fullReportData.kuerzel,
                fullReportData.mitarbeiter,
                fullReportData.reportNumber,
                fullReportData.createdAt,
                fullReportData.fileName,
                fullReportData.filePath,
                fullReportData.fileUrl || null,
                fullReportData.arbeitsdatum || null,
                fullReportData.arbeitszeit || null,
                fullReportData.zusatzInformationen || null
            ];

            this.db.run(query, values, function(err) {
                if (err) {
                    console.error('Error saving report to database:', err);
                    reject(err);
                } else {
                    resolve(fullReportData);
                }
            });
        });
    }

    async getReportById(id: string): Promise<ReportData | null> {
        for (const [documentType, tableName] of this.tableNames) {
            const report = await this.getReportByIdFromTable(id, tableName);
            if (report) {
                return report;
            }
        }
        return null;
    }

    async getReportByNumber(kuerzel: string, documentType: string, reportNumber: number): Promise<ReportData | null> {
        return new Promise((resolve, reject) => {
            const tableName = this.getTableName(documentType);
            const query = `SELECT * FROM ${tableName} WHERE kuerzel = ? AND reportNumber = ?`;
            this.db.get(query, [kuerzel, reportNumber], (err, row) => {
                if (err) {
                    console.error('Error fetching report by number:', err);
                    reject(err);
                } else {
                    resolve(row ? (row as ReportData) : null);
                }
            });
        });
    }

    async getReports(kuerzel: string, documentType: string, limit: number = 10, offset: number = 0): Promise<ReportData[]> {
        return new Promise((resolve, reject) => {
            const tableName = this.getTableName(documentType);
            const query = `SELECT * FROM ${tableName} WHERE kuerzel = ? ORDER BY reportNumber DESC LIMIT ? OFFSET ?`;
            this.db.all(query, [kuerzel, limit, offset], (err, rows) => {
                if (err) {
                    console.error('Error fetching reports:', err);
                    reject(err);
                } else {
                    resolve(rows as ReportData[]);
                }
            });
        });
    }

    async getAllReports(): Promise<ReportData[]> {
        const allReports: ReportData[] = [];

        for (const [documentType, tableName] of this.tableNames) {
            const reports = await this.getReportsByType(documentType);
            allReports.push(...reports);
        }

        // Sortiere nach Kürzel und Berichtsnummer
        allReports.sort((a, b) => {
            if (a.kuerzel !== b.kuerzel) {
                return a.kuerzel.localeCompare(b.kuerzel);
            }
            return b.reportNumber - a.reportNumber;
        });

        return allReports;
    }

    async getReportsByType(documentType: string): Promise<ReportData[]> {
        const tableName = this.getTableName(documentType);
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM ${tableName} ORDER BY kuerzel ASC, reportNumber DESC`;
            this.db.all(query, (err, rows: any[]) => {
                if (err) {
                    console.error(`Error fetching reports from ${tableName}:`, err);
                    reject(err);
                } else {
                    resolve(rows as ReportData[]);
                }
            });
        });
    }

    private async getReportByIdFromTable(id: string, tableName: string): Promise<ReportData | null> {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM ${tableName} WHERE id = ?`;
            this.db.get(query, [id], (err, row: any) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row ? (row as ReportData) : null);
                }
            });
        });
    }

    async deleteReport(id: string): Promise<boolean> {
        for (const [documentType, tableName] of this.tableNames) {
            const deleted = await this.deleteReportFromTable(id, tableName);
            if (deleted) {
                return true;
            }
        }
        return false;
    }

    private async deleteReportFromTable(id: string, tableName: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const query = `DELETE FROM ${tableName} WHERE id = ?`;
            this.db.run(query, [id], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.changes > 0);
                }
            });
        });
    }

    async clearAllReports(): Promise<{ deletedCount: number }> {
        let totalDeleted = 0;

        for (const [documentType, tableName] of this.tableNames) {
            const count = await new Promise<number>((resolve, reject) => {
                this.db.get(`SELECT COUNT(*) as count FROM ${tableName}`, (err, row: any) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row.count || 0);
                    }
                });
            });

            await new Promise<void>((resolve, reject) => {
                this.db.run(`DELETE FROM ${tableName}`, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        totalDeleted += count;
                        resolve();
                    }
                });
            });
        }

        console.log(`🗑️ Datenbank geleert: ${totalDeleted} Berichte entfernt`);
        return { deletedCount: totalDeleted };
    }

    close(): void {
        this.db.close();
    }
}
