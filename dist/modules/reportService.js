"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("./database");
const BautagesberichtGenerator_1 = require("./BautagesberichtGenerator");
const RegieGenerator_1 = require("./RegieGenerator");
const cloudStorageOneDrive_1 = require("./cloudStorageOneDrive");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ReportService {
    constructor() {
        this.dbManager = new database_1.DatabaseManager();
        this.cloudStorage = new cloudStorageOneDrive_1.CloudStorageService();
        this.ensureDirectoryExists('./generated_reports/bautagesberichte');
        this.ensureDirectoryExists('./generated_reports/regieberichte');
        this.bautagesberichtGenerator = new BautagesberichtGenerator_1.BautagesberichtGenerator({
            outputDir: './generated_reports/bautagesberichte'
        });
        this.regieGenerator = new RegieGenerator_1.RegieGenerator({
            outputDir: './generated_reports/regieberichte'
        });
    }
    ensureDirectoryExists(dirPath) {
        try {
            const fullPath = path.resolve(dirPath);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true, mode: 0o777 });
                console.log(`Verzeichnis erstellt: ${fullPath}`);
            }
            try {
                fs.chmodSync(fullPath, 0o777);
                console.log(`Berechtigungen gesetzt für: ${fullPath}`);
            }
            catch (chmodError) {
                console.warn(`Konnte Berechtigungen nicht setzen für ${fullPath}:`, chmodError);
            }
            const testFile = path.join(fullPath, '.write_test_' + Date.now());
            try {
                fs.writeFileSync(testFile, 'test', { mode: 0o666 });
                fs.unlinkSync(testFile);
                console.log(`Schreibberechtigung bestätigt für: ${fullPath}`);
            }
            catch (testError) {
                console.error(`Schreibtest fehlgeschlagen für ${fullPath}:`, testError);
                const tmpDir = path.join('/tmp', 'berichte_reports', path.basename(dirPath));
                try {
                    if (!fs.existsSync(tmpDir)) {
                        fs.mkdirSync(tmpDir, { recursive: true, mode: 0o777 });
                    }
                    const tmpTestFile = path.join(tmpDir, '.write_test_' + Date.now());
                    fs.writeFileSync(tmpTestFile, 'test');
                    fs.unlinkSync(tmpTestFile);
                    console.log(`Alternative Verzeichnis erstellt und getestet: ${tmpDir}`);
                    if (dirPath.includes('bautagesberichte')) {
                        this.bautagesberichtGenerator = new BautagesberichtGenerator_1.BautagesberichtGenerator({
                            outputDir: tmpDir
                        });
                    }
                    else if (dirPath.includes('regieberichte')) {
                        this.regieGenerator = new RegieGenerator_1.RegieGenerator({
                            outputDir: tmpDir
                        });
                    }
                }
                catch (tmpError) {
                    console.error(`Fehler beim Erstellen des alternativen Verzeichnisses:`, tmpError);
                }
            }
        }
        catch (error) {
            console.error(`Fehler beim Erstellen/Testen des Verzeichnisses ${dirPath}:`, error);
            const cwdPath = path.join(process.cwd(), 'temp_reports', path.basename(dirPath));
            try {
                if (!fs.existsSync(cwdPath)) {
                    fs.mkdirSync(cwdPath, { recursive: true, mode: 0o777 });
                    console.log(`Notfall-Verzeichnis erstellt: ${cwdPath}`);
                }
            }
            catch (cwdError) {
                console.error(`Fehler beim Erstellen des Notfall-Verzeichnisses:`, cwdError);
            }
        }
    }
    async createReport(request) {
        try {
            if (!request.kuerzel?.trim()) {
                return {
                    success: false,
                    message: 'Kürzel ist ein Pflichtfeld'
                };
            }
            const reportId = (0, uuid_1.v4)();
            const createdAt = new Date().toISOString();
            const reportData = {
                id: reportId,
                documentType: request.documentType,
                kuerzel: request.kuerzel.trim(),
                mitarbeiter: JSON.stringify(request.mitarbeiter),
                createdAt,
                fileName: '',
                filePath: '',
                arbeitsdatum: request.arbeitsdatum,
                arbeitszeit: request.arbeitszeit,
                ...(request.zusatzInformationen && { zusatzInformationen: request.zusatzInformationen })
            };
            const savedReport = await this.dbManager.saveReport(reportData);
            let generator;
            let documentName;
            switch (request.documentType) {
                case 'bautagesbericht':
                    generator = this.bautagesberichtGenerator;
                    documentName = 'Bautagesbericht';
                    break;
                case 'regiebericht':
                case 'regieantrag':
                    generator = this.regieGenerator;
                    documentName = request.documentType === 'regieantrag' ? 'Regieantrag' : 'Regiebericht';
                    break;
                default:
                    generator = this.bautagesberichtGenerator;
                    documentName = 'Bautagesbericht';
            }
            const { filePath, fileName } = await generator.generateWordDocument(savedReport, request);
            let finalReportData = {
                ...reportData,
                fileName,
                filePath,
                isCloudStored: false
            };
            if (this.cloudStorage.isEnabled()) {
                console.log('Uploade Bericht in die Cloud...');
                const uploadResult = await this.cloudStorage.uploadFile(filePath, fileName, request.documentType);
                if (uploadResult.success && uploadResult.fileUrl) {
                    finalReportData = {
                        ...finalReportData,
                        cloudUrl: uploadResult.fileUrl,
                        cloudKey: uploadResult.localPath || uploadResult.fileUrl,
                        isCloudStored: true,
                        filePath: uploadResult.localPath || filePath
                    };
                    console.log('Cloud-Upload erfolgreich:', uploadResult.fileUrl);
                    if (uploadResult.localPath) {
                        console.log('Datei in lokalen OneDrive-Ordner kopiert:', uploadResult.localPath);
                    }
                }
                else {
                    console.warn('Cloud-Upload fehlgeschlagen, verwende lokalen Speicher:', uploadResult.error);
                }
            }
            else {
                console.log('Cloud-Speicher nicht verfügbar, verwende lokalen Speicher');
            }
            await this.dbManager.deleteReport(reportId);
            const finalReport = await this.dbManager.saveReport(finalReportData);
            const storageInfo = finalReport.isCloudStored ? 'in der Cloud' : 'lokal';
            return {
                success: true,
                message: `${documentName} #${finalReport.reportNumber.toString().padStart(4, '0')} wurde erfolgreich erstellt und ${storageInfo} gespeichert`,
                reportData: finalReport,
                downloadUrl: `/api/reports/${finalReport.id}/download`
            };
        }
        catch (error) {
            return {
                success: false,
                message: 'Fehler beim Erstellen des Berichts: ' + error.message
            };
        }
    }
    async getAllReports() {
        try {
            const reports = await this.dbManager.getAllReports();
            return {
                success: true,
                reports,
                count: reports.length
            };
        }
        catch (error) {
            return {
                success: false,
                reports: [],
                count: 0
            };
        }
    }
    async getReportById(id) {
        try {
            return await this.dbManager.getReportById(id);
        }
        catch (error) {
            return null;
        }
    }
    async downloadReport(id) {
        try {
            const report = await this.dbManager.getReportById(id);
            if (!report) {
                return null;
            }
            if (report.isCloudStored && report.cloudKey && this.cloudStorage.isEnabled()) {
                const downloadResult = await this.cloudStorage.getDownloadUrl(report.cloudKey);
                if (downloadResult.success && downloadResult.downloadUrl) {
                    return {
                        fileName: report.fileName,
                        downloadUrl: downloadResult.downloadUrl,
                        isCloudStored: true
                    };
                }
                else {
                    console.error('Fehler beim Generieren der Cloud-Download-URL:', downloadResult.error);
                    return null;
                }
            }
            if (!fs.existsSync(report.filePath)) {
                return null;
            }
            return {
                filePath: report.filePath,
                fileName: report.fileName,
                isCloudStored: false
            };
        }
        catch (error) {
            return null;
        }
    }
    async deleteReport(id) {
        try {
            const report = await this.dbManager.getReportById(id);
            if (!report) {
                return false;
            }
            if (report.isCloudStored && report.cloudKey && this.cloudStorage.isEnabled()) {
                const cloudDeleted = await this.cloudStorage.deleteFile(report.cloudKey);
                if (!cloudDeleted) {
                    console.warn('Konnte Cloud-Datei nicht löschen:', report.cloudKey);
                }
            }
            if (fs.existsSync(report.filePath)) {
                fs.unlinkSync(report.filePath);
            }
            return await this.dbManager.deleteReport(id);
        }
        catch (error) {
            return false;
        }
    }
    close() {
        this.dbManager.close();
    }
}
exports.ReportService = ReportService;
//# sourceMappingURL=reportService.js.map