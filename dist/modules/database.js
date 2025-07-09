"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseManager = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
class DatabaseManager {
    constructor(dbPath = './reports.db') {
        this.dbPath = dbPath;
        this.tableNames = new Map();
        this.tableNames.set('bautagesbericht', 'bautagesberichte');
        this.tableNames.set('regiebericht', 'regieberichte');
        this.tableNames.set('regieantrag', 'regieantraege');
        this.db = new sqlite3_1.default.Database(this.dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err);
            }
        });
        this.initializeDatabase();
    }
    getTableName(documentType) {
        const tableName = this.tableNames.get(documentType);
        if (!tableName) {
            throw new Error(`Unknown document type: ${documentType}`);
        }
        return tableName;
    }
    async initializeDatabase() {
        for (const [documentType, tableName] of this.tableNames) {
            await this.createTable(tableName);
        }
    }
    async createTable(tableName) {
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
                }
                else {
                    resolve();
                }
            });
        });
    }
    async getNextReportNumber(kuerzel, documentType) {
        const tableName = this.getTableName(documentType);
        return new Promise((resolve, reject) => {
            const query = `SELECT MAX(reportNumber) as maxNumber FROM ${tableName} WHERE kuerzel = ?`;
            this.db.get(query, [kuerzel], (err, row) => {
                if (err) {
                    console.error('Error getting next report number:', err);
                    reject(err);
                }
                else {
                    const nextNumber = (row?.maxNumber || 0) + 1;
                    resolve(nextNumber);
                }
            });
        });
    }
    async saveReport(reportData) {
        const reportNumber = await this.getNextReportNumber(reportData.kuerzel, reportData.documentType);
        const fullReportData = { ...reportData, reportNumber };
        const tableName = this.getTableName(reportData.documentType);
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO ${tableName} (id, documentType, kuerzel, mitarbeiter, reportNumber, createdAt, fileName, filePath, arbeitsdatum, arbeitszeit, zusatzInformationen)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                fullReportData.arbeitsdatum || null,
                fullReportData.arbeitszeit || null,
                fullReportData.zusatzInformationen || null
            ];
            this.db.run(query, values, function (err) {
                if (err) {
                    console.error('Error saving report to database:', err);
                    reject(err);
                }
                else {
                    resolve(fullReportData);
                }
            });
        });
    }
    async getAllReports() {
        const allReports = [];
        for (const [documentType, tableName] of this.tableNames) {
            const reports = await this.getReportsByType(documentType);
            allReports.push(...reports);
        }
        allReports.sort((a, b) => {
            if (a.kuerzel !== b.kuerzel) {
                return a.kuerzel.localeCompare(b.kuerzel);
            }
            return b.reportNumber - a.reportNumber;
        });
        return allReports;
    }
    async getReportsByType(documentType) {
        const tableName = this.getTableName(documentType);
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM ${tableName} ORDER BY kuerzel ASC, reportNumber DESC`;
            this.db.all(query, (err, rows) => {
                if (err) {
                    console.error(`Error fetching reports from ${tableName}:`, err);
                    reject(err);
                }
                else {
                    resolve(rows);
                }
            });
        });
    }
    async getReportById(id) {
        for (const [documentType, tableName] of this.tableNames) {
            const report = await this.getReportByIdFromTable(id, tableName);
            if (report) {
                return report;
            }
        }
        return null;
    }
    async getReportByIdFromTable(id, tableName) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM ${tableName} WHERE id = ?`;
            this.db.get(query, [id], (err, row) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(row ? row : null);
                }
            });
        });
    }
    async deleteReport(id) {
        for (const [documentType, tableName] of this.tableNames) {
            const deleted = await this.deleteReportFromTable(id, tableName);
            if (deleted) {
                return true;
            }
        }
        return false;
    }
    async deleteReportFromTable(id, tableName) {
        return new Promise((resolve, reject) => {
            const query = `DELETE FROM ${tableName} WHERE id = ?`;
            this.db.run(query, [id], function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve(this.changes > 0);
                }
            });
        });
    }
    close() {
        this.db.close((err) => {
            if (err) {
                console.error('Error closing database:', err);
            }
        });
    }
}
exports.DatabaseManager = DatabaseManager;
//# sourceMappingURL=database.js.map