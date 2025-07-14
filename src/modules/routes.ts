import { Router, Request, Response } from 'express';
import { ReportService, CreateReportRequest } from './reportService';
import { CsvReader } from './csvReader';
import { MitarbeiterReader } from './mitarbeiterReader';

export const reportRouter = Router();
const reportService = new ReportService();
const csvReader = new CsvReader();
const mitarbeiterReader = new MitarbeiterReader();

reportRouter.get('/health', (req: Request, res: Response) => {
    res.json({
        status: 'OK',
        message: 'Report Generator API is running',
        timestamp: new Date().toISOString()
    });
});

reportRouter.get('/kuerzel', async (req: Request, res: Response) => {
    try {
        const csvData = await csvReader.readCsvData();
        res.json({
            success: true,
            data: csvData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Laden der Kürzel-Daten'
        });
    }
});

reportRouter.get('/mitarbeiter', async (req: Request, res: Response) => {
    try {
        const mitarbeiterData = await mitarbeiterReader.readMitarbeiterData();
        res.json({
            success: true,
            data: mitarbeiterData
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Laden der Mitarbeiter-Daten'
        });
    }
});

reportRouter.post('/reports', async (req: Request, res: Response) => {
    try {
        const reportRequest: CreateReportRequest = req.body;

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
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Interner Serverfehler'
        });
    }
});

reportRouter.get('/reports', async (req: Request, res: Response) => {
    try {
        const result = await reportService.getAllReports();
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            reports: [],
            count: 0,
            message: 'Fehler beim Laden der Berichte'
        });
    }
});

reportRouter.get('/reports/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (id) {
            const report = await reportService.getReportById(id);
            if (report) {
                // Erweitere die Berichtdaten mit zusätzlichen Informationen
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
                    // Füge zusätzliche Felder hinzu falls vorhanden
                    arbeitsdatum: report.arbeitsdatum || '',
                    arbeitszeit: report.arbeitszeit || '',
                    zusatzInformationen: report.zusatzInformationen || ''
                };

                res.json({
                    success: true,
                    report: enrichedReport
                });
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Bericht nicht gefunden'
                });
            }
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Laden des Berichts'
        });
    }
});

reportRouter.get('/reports/:id/view', async (req: Request, res: Response) => {
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
                } else {
                    res.status(404).json({
                        success: false,
                        message: 'Datei nicht gefunden'
                    });
                }
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Bericht nicht gefunden'
                });
            }
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Öffnen der Datei'
        });
    }
});

reportRouter.get('/reports/:id/download', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const downloadData = await reportService.downloadReport(id);

        if (!downloadData) {
            res.status(404).json({
                success: false,
                message: 'Bericht nicht gefunden'
            });
            return;
        }

        if (downloadData.downloadUrl) {
            res.redirect(downloadData.downloadUrl);
        } else if (downloadData.filePath) {
            res.download(downloadData.filePath, downloadData.fileName);
        } else {
            res.status(404).json({
                success: false,
                message: 'Datei nicht verfügbar'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Download'
        });
    }
});

// Admin-Endpoint zum Leeren der Datenbank
reportRouter.delete('/admin/clear-database', async (req: Request, res: Response) => {
    try {
        // Einfacher Sicherheitscheck - Sie können hier ein Admin-Token hinzufügen
        const adminKey = req.headers['x-admin-key'] || req.query.adminKey;

        if (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin123') {
            return res.status(401).json({
                success: false,
                message: 'Nicht autorisiert. Admin-Schlüssel erforderlich.'
            });
        }

        const result = await reportService.clearAllReports();

        if (result.success) {
            res.json({
                success: true,
                message: `Datenbank erfolgreich geleert. ${result.deletedCount} Berichte entfernt.`
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Fehler beim Leeren der Datenbank'
            });
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Leeren der Datenbank'
        });
    }
});
