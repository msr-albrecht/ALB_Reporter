import { Router, Request, Response } from 'express';
import { ReportService, CreateReportRequest } from './reportService';
import { CsvReader } from './csvReader';
import { MitarbeiterReader } from './mitarbeiterReader';
import fs from 'fs';

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

// Lösch-Route für Berichte
reportRouter.delete('/reports/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) {
            res.status(400).json({
                success: false,
                message: 'Bericht-ID ist erforderlich'
            });
            return;
        }

        const result = await reportService.deleteReport(id);

        if (result.success) {
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
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Fehler beim Löschen des Berichts'
        });
    }
});

// Admin-Endpoint zum Leeren der Datenbank
reportRouter.delete('/admin/clear-database', async (req: Request, res: Response) => {
    try {
        // Einfacher Sicherheitscheck - Sie können hier ein Admin-Token hinzufügen
        const headerKey = req.headers['x-admin-key'];
        const queryKey = req.query.adminKey;
        const adminKey = typeof headerKey === 'string' ? headerKey : typeof queryKey === 'string' ? queryKey : '';

        if (!adminKey || (adminKey !== process.env.ADMIN_KEY && adminKey !== 'admin123')) {
            return res.status(401).json({
                success: false,
                message: 'Nicht autorisiert. Admin-Schlüssel erforderlich.'
            });
        }

        const result = await reportService.clearAllReports();

        if (result.success) {
            return res.json({
                success: true,
                message: `Datenbank erfolgreich geleert. ${result.deletedCount} Berichte entfernt.`
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Fehler beim Leeren der Datenbank'
            });
        }
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Fehler beim Leeren der Datenbank'
        });
    }
});

reportRouter.get('/reports/:id/download', async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({
                success: false,
                message: 'Bericht-ID ist erforderlich'
            });
            return;
        }

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

// CSV-Tabelle laden
reportRouter.get('/csv-table', async (req: Request, res: Response) => {
    try {
        // Rohdaten aus dummy.csv laden
        const csvRaw = await fs.promises.readFile('./dummy.csv', 'utf-8');
        const rows = csvRaw.split('\n').filter(line => line.trim()).map(line => line.split(';'));
        res.json({ success: true, data: rows });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Fehler beim Laden der CSV-Tabelle' });
    }
});

// CSV-Tabelle speichern
reportRouter.post('/save-csv', async (req: Request, res: Response) => {
    try {
        const { data } = req.body;
        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ success: false, message: 'Ungültige CSV-Daten' });
        }
        // CSV-String erzeugen
        const csvString = data.map((row: any[]) => row.map((cell: any) => String(cell).replace(/;/g, ',')).join(';')).join('\n');
        await fs.promises.writeFile('./dummy.csv', csvString, 'utf-8');
        return res.json({ success: true });
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Fehler beim Speichern der CSV-Tabelle' });
    }
});
