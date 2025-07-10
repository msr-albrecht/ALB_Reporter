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
        if (id) {
            const downloadInfo = await reportService.downloadReport(id);
            if (downloadInfo) {
                // Wenn Cloud-gespeichert, leite zur Cloud-URL weiter
                if (downloadInfo.isCloudStored && downloadInfo.downloadUrl) {
                    res.redirect(downloadInfo.downloadUrl);
                } else if (downloadInfo.filePath) {
                    // Lokale Datei herunterladen
                    res.download(downloadInfo.filePath, downloadInfo.fileName, (err) => {
                        if (err) {
                            res.status(500).json({
                                success: false,
                                message: 'Fehler beim Download der Datei'
                            });
                        }
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        message: 'Datei nicht verfügbar'
                    });
                }
            } else {
                res.status(404).json({
                    success: false,
                    message: 'Datei nicht gefunden'
                });
            }
        }
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Download'
        });
    }
});

reportRouter.delete('/reports/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (id) {
            const deleted = await reportService.deleteReport(id);
            if (deleted) {
                res.json({
                    success: true,
                    message: 'Bericht erfolgreich gelöscht'
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
            message: 'Fehler beim Löschen des Berichts'
        });
    }
});
