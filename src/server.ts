import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { reportRouter } from './modules/routes';

const app = express();
const PORT = process.env.PORT || 4055;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

const staticPath = path.join(__dirname, '../src');
app.use(express.static(staticPath));

app.use('/api', reportRouter);

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/index.html'));
});

app.get('/report-detail', (req, res) => {
    res.sendFile(path.join(__dirname, '../src/report-detail.html'));
});

app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route nicht gefunden'
    });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        message: 'Interner Serverfehler'
    });
});

app.listen(80, () => {
    console.log(`Server läuft auf Port ${PORT}`);
    console.log(`Frontend: http://localhost:${PORT}`);
    console.log(`API: http://localhost:${PORT}/api`);
});
