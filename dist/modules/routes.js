"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reportRouter = void 0;
const express_1 = require("express");
const reportService_1 = require("./reportService");
const csvReader_1 = require("./csvReader");
const mitarbeiterReader_1 = require("./mitarbeiterReader");
exports.reportRouter = (0, express_1.Router)();
const reportService = new reportService_1.ReportService();
const csvReader = new csvReader_1.CsvReader();
const mitarbeiterReader = new mitarbeiterReader_1.MitarbeiterReader();
exports.reportRouter.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Report Generator API is running',
        timestamp: new Date().toISOString()
    });
});
exports.reportRouter.get('/kuerzel', async (req, res) => {
    try {
        const csvData = await csvReader.readCsvData();
        res.json({
            success: true,
            data: csvData
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Laden der Kürzel-Daten'
        });
    }
});
exports.reportRouter.get('/mitarbeiter', async (req, res) => {
    try {
        const mitarbeiterData = await mitarbeiterReader.readMitarbeiterData();
        res.json({
            success: true,
            data: mitarbeiterData
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Laden der Mitarbeiter-Daten'
        });
    }
});
exports.reportRouter.post('/reports', async (req, res) => {
    try {
        const reportRequest = req.body;
        if (!reportRequest.kuerzel) {
            res.status(400).json({
                success: false,
                message: 'Kürzel ist ein Pflichtfeld'
            });
            return;
        }
        const result = await reportService.createReport(reportRequest);
        if (result.success) {
            res.status(201).json(result);
        }
        else {
            res.status(400).json(result);
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Interner Serverfehler'
        });
    }
});
exports.reportRouter.get('/reports', async (req, res) => {
    try {
        const result = await reportService.getAllReports();
        res.json(result);
    }
    catch (error) {
        res.status(500).json({
            success: false,
            reports: [],
            count: 0,
            message: 'Fehler beim Laden der Berichte'
        });
    }
});
exports.reportRouter.get('/reports/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (id) {
            const report = await reportService.getReportById(id);
            if (report) {
                const csvData = await csvReader.readCsvData();
                const projectData = csvData.find(item => item.kuerzel === report.kuerzel);
                const enrichedReport = {
                    ...report,
                    kunde: projectData?.kunde || '',
                    strasseKunde: projectData?.strasseKunde || '',
                    ortKunde: projectData?.ortKunde || '',
                    baustelle: projectData?.baustelle || '',
                    strasseBaustelle: projectData?.strasseBaustelle || '',
                    ortBaustelle: projectData?.ortBaustelle || '',
                    auftragsNr: projectData?.auftragsNr || '',
                    vergNr: projectData?.vergNr || '',
                    arbeitsdatum: report.arbeitsdatum || '',
                    arbeitszeit: report.arbeitszeit || '',
                    zusatzInformationen: report.zusatzInformationen || ''
                };
                res.json({
                    success: true,
                    report: enrichedReport
                });
            }
            else {
                res.status(404).json({
                    success: false,
                    message: 'Bericht nicht gefunden'
                });
            }
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Laden des Berichts'
        });
    }
});
exports.reportRouter.get('/reports/:id/view', async (req, res) => {
    try {
        const { id } = req.params;
        if (id) {
            const report = await reportService.getReportById(id);
            if (report && report.filePath) {
                if (require('fs').existsSync(report.filePath)) {
                    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
                    res.setHeader('Content-Disposition', `inline; filename="${report.fileName}"`);
                    res.sendFile(require('path').resolve(report.filePath), (err) => {
                        if (err) {
                            res.status(500).json({
                                success: false,
                                message: 'Fehler beim Öffnen der Datei'
                            });
                        }
                    });
                }
                else {
                    res.status(404).json({
                        success: false,
                        message: 'Datei nicht gefunden'
                    });
                }
            }
            else {
                res.status(404).json({
                    success: false,
                    message: 'Bericht nicht gefunden'
                });
            }
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Öffnen der Datei'
        });
    }
});
exports.reportRouter.get('/reports/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        if (id) {
            const downloadInfo = await reportService.downloadReport(id);
            if (downloadInfo) {
                res.download(downloadInfo.filePath, downloadInfo.fileName, (err) => {
                    if (err) {
                        res.status(500).json({
                            success: false,
                            message: 'Fehler beim Download der Datei'
                        });
                    }
                });
            }
            else {
                res.status(404).json({
                    success: false,
                    message: 'Datei nicht gefunden'
                });
            }
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Download'
        });
    }
});
exports.reportRouter.delete('/reports/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (id) {
            const deleted = await reportService.deleteReport(id);
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Bericht erfolgreich gelöscht'
                });
            }
            else {
                res.status(404).json({
                    success: false,
                    message: 'Bericht nicht gefunden'
                });
            }
        }
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Löschen des Berichts'
        });
    }
});
//# sourceMappingURL=routes.js.map