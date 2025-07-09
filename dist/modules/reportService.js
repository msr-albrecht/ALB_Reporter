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
const fs = __importStar(require("fs"));
class ReportService {
    constructor() {
        this.dbManager = new database_1.DatabaseManager();
        this.bautagesberichtGenerator = new BautagesberichtGenerator_1.BautagesberichtGenerator({
            outputDir: './generated_reports/bautagesberichte'
        });
        this.regieGenerator = new RegieGenerator_1.RegieGenerator({
            outputDir: './generated_reports/regieberichte'
        });
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
            savedReport.fileName = fileName;
            savedReport.filePath = filePath;
            await this.dbManager.deleteReport(reportId);
            const finalReport = await this.dbManager.saveReport({
                ...reportData,
                fileName,
                filePath,
            });
            return {
                success: true,
                message: `${documentName} #${finalReport.reportNumber.toString().padStart(4, '0')} wurde erfolgreich erstellt`,
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
            if (!fs.existsSync(report.filePath)) {
                return null;
            }
            return {
                filePath: report.filePath,
                fileName: report.fileName
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