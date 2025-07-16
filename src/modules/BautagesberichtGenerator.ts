import { Document, Paragraph, Table, TableRow, TableCell, WidthType, TextRun, BorderStyle, Packer, VerticalAlign, ImageRun, Header, AlignmentType, Footer } from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { ReportData } from './database';
import { WeatherService } from './weatherService';
import { CreateReportRequest } from './reportService';

export interface BautagesberichtGeneratorOptions {
    outputDir?: string;
}

export class BautagesberichtGenerator {
    private outputDir: string;
    private weatherService: WeatherService;

    constructor(options: BautagesberichtGeneratorOptions = {}) {
        this.outputDir = options.outputDir || './generated_reports/bautagesberichte';
        this.weatherService = new WeatherService();
        this.ensureOutputDirectory();
    }

    private ensureOutputDirectory(): void {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    private formatDate(dateString: string): string {
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    private getCurrentWeek(date: Date): number {
        const startDate = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + startDate.getDay() + 1) / 7);
    }

    private calculateDuration(timeRange: string): string {
        if (!timeRange || !timeRange.includes("-")) {
            throw new Error("Invalid time range format. Expected 'HH:mm-HH:mm'.");
        }

        const [start, end] = timeRange.split('-');
        if (!start || !end) {
            throw new Error("Invalid time range. Start or end time missing.");
        }

        const [startHours, startMinutes] = start.split(':').map(Number);
        const [endHours, endMinutes] = end.split(':').map(Number);

        const startDate = new Date(0, 0, 0, startHours, startMinutes);
        const endDate = new Date(0, 0, 0, endHours, endMinutes);

        let diffMs = endDate.getTime() - startDate.getTime();
        if (diffMs < 0) {
            diffMs += 24 * 60 * 60 * 1000;
        }

        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMinutes / 60);
        const minutes = diffMinutes % 60;

        const pad = (num: number) => num.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}`;
    }

    async generateWordDocument(reportData: ReportData, requestData: CreateReportRequest): Promise<{ filePath: string; fileName: string }> {
        const currentDate = new Date();
        const fileName = `BTB_${reportData.kuerzel}_${requestData.arbeitsdatum.replace(/-/g, '_')}_${reportData.reportNumber.toString().padStart(3, '0')}.docx`;
        const filePath = path.join(this.outputDir, fileName);

        try {
            const mitarbeiterList = JSON.parse(reportData.mitarbeiter);
            const individualDates = requestData.individualDates || {};
            const individualTimes = requestData.individualTimes || {};

            const mainTable = await this.createMainTable(
                reportData,
                requestData,
                mitarbeiterList,
                individualDates,
                individualTimes,
                currentDate
            );

            const header = this.createDocumentHeader();
            const footer = this.createDocumentFooter();

            const doc = new Document({
                sections: [{
                    headers: {
                        default: header,
                    },
                    footers: {
                        default: footer,
                    },
                    children: [
                        mainTable,
                    ],
                }],
            });

            const buffer = await Packer.toBuffer(doc);
            fs.writeFileSync(filePath, buffer);

            if (!fs.existsSync(filePath)) {
                throw new Error('File was not created');
            }

            return { filePath, fileName };
        } catch (error) {
            console.error('Error during Word document generation:', error);
            throw error;
        }
    }

    private createDocumentHeader(): Header {
        const logoPath = path.join(process.cwd(), 'photos', 'logo.jpg');
        const infoPath = path.join(process.cwd(), 'photos', 'albrechtInfo.jpg');

        let logoImageRun: ImageRun | null = null;
        let infoImageRun: ImageRun | null = null;

        // Load logo image if exists
        if (fs.existsSync(logoPath)) {
            try {
                logoImageRun = new ImageRun({
                    data: fs.readFileSync(logoPath),
                    transformation: {
                        width: 200,
                        height: 60,
                    },
                });
            } catch (error) {
                console.error('Error loading logo image:', error);
            }
        }

        // Load info image if exists
        if (fs.existsSync(infoPath)) {
            try {
                infoImageRun = new ImageRun({
                    data: fs.readFileSync(infoPath),
                    transformation: {
                        width: 180,
                        height: 90,
                    },
                });
            } catch (error) {
                console.error('Error loading info image:', error);
            }
        }

        return new Header({
            children: [
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    borders: {
                        top: { style: BorderStyle.NONE },
                        bottom: { style: BorderStyle.NONE },
                        left: { style: BorderStyle.NONE },
                        right: { style: BorderStyle.NONE },
                        insideHorizontal: { style: BorderStyle.NONE },
                        insideVertical: { style: BorderStyle.NONE },
                    },
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({
                                    children: [
                                        ...(logoImageRun ? [new Paragraph({
                                            children: [logoImageRun],
                                            alignment: AlignmentType.LEFT
                                        })] : []),
                                    ],
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                }),
                                new TableCell({
                                    children: [
                                        ...(infoImageRun ? [new Paragraph({
                                            children: [infoImageRun],
                                            alignment: AlignmentType.RIGHT
                                        })] : []),
                                    ],
                                    width: { size: 50, type: WidthType.PERCENTAGE },
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        });
    }

    private createDocumentFooter(): Footer {
        return new Footer({
            children: [
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum. Mit der Bestätigung dieses Berichtes wurde die Sache kontrolliert und mängelfrei übergeben! Es gelten die Geschäftsbedingungen der Elektrotechniker, herausgegeben von der Bundesinnung!",
                            size: 14,
                            italics: true,
                        }),
                    ],
                    spacing: { after: 200 },
                }),
                new Paragraph({
                    children: [
                        new TextRun({
                            text: "Als Bautagesbericht wird keine Unterschrift des Kunden benötigt.",
                            size: 14,
                            italics: true,
                        }),
                    ],
                }),
            ],
        });
    }

    private async createMainTable(
        reportData: ReportData,
        requestData: CreateReportRequest,
        mitarbeiterList: any[],
        individualDates: {[key: string]: string},
        individualTimes: {[key: string]: string},
        currentDate: Date
    ): Promise<Table> {
        return new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
                top: { style: BorderStyle.SINGLE, size: 8 },
                bottom: { style: BorderStyle.SINGLE, size: 8 },
                left: { style: BorderStyle.SINGLE, size: 8 },
                right: { style: BorderStyle.SINGLE, size: 8 },
                insideHorizontal: { style: BorderStyle.SINGLE, size: 8 },
                insideVertical: { style: BorderStyle.SINGLE, size: 8 },
            },
            rows: [
                this.createHeaderRow(reportData, requestData),
                this.createCustomerRow(requestData),
                this.createCustomerAddressRow(requestData),
                this.createConstructionSiteRow(requestData),
                this.createConstructionAddressRow(requestData),
                this.createEmployeeHeaderRow(),
                ...await this.createEmployeeRows(mitarbeiterList, individualDates, individualTimes, requestData),
                ...this.createEmptyEmployeeRows(mitarbeiterList),
                this.createWorkDescriptionHeaderRow(),
                this.createWorkDescriptionRow(mitarbeiterList, requestData),
                this.createSignatureRow(requestData, mitarbeiterList)
            ]
        });
    }

    private createHeaderRow(reportData: ReportData, requestData: CreateReportRequest): TableRow {
        // Verwende das Arbeitsdatum aus dem Request anstatt des heutigen Datums
        const workDate = new Date(requestData.arbeitsdatum);

        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "Bautagesbericht", bold: true, size: 28 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: `Nr. ${reportData.reportNumber.toString().padStart(3, '0')}`, bold: true, size: 24 })],
                        }),
                    ],
                    columnSpan: 14,
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `Datum: ${this.formatDate(requestData.arbeitsdatum)}`, size: 22 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: `KW: ${this.getCurrentWeek(workDate)}`, size: 22 })],
                        }),
                    ],
                    columnSpan: 9,
                }),
            ],
        });
    }

    private createCustomerRow(requestData: CreateReportRequest): TableRow {
        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "Kunde/Rechnungsanschrift:", bold: true, size: 22 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: requestData.kunde, bold: true, size: 22 })],
                        }),
                    ],
                    columnSpan: 23,
                }),
            ],
        });
    }

    private createCustomerAddressRow(requestData: CreateReportRequest): TableRow {
        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "Ort:", bold: true, size: 22 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: `${requestData.strasseKunde}, ${requestData.ortKunde}`, size: 22 })],
                        })
                    ],
                    columnSpan: 19,
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "Auftrags-Nr.:", size: 22 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: requestData.auftragsNr, size: 22 })],
                        }),
                    ],
                    columnSpan: 4,
                }),
            ],
        });
    }

    private createConstructionSiteRow(requestData: CreateReportRequest): TableRow {
        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "Baustellenanschrift:", bold: true, size: 22 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: requestData.baustelle, size: 22 })],
                        }),
                    ],
                    columnSpan: 23,
                }),
            ],
        });
    }

    private createConstructionAddressRow(requestData: CreateReportRequest): TableRow {
        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "Ort:", bold: true, size: 22 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: `${requestData.strasseBaustelle}, ${requestData.ortBaustelle}`, size: 22 })],
                        }),
                    ],
                    columnSpan: 19,
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({
                                text: "Verg.nr.", size: 22
                            })]
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: requestData.vergNr, size: 22 })],
                        }),
                    ],
                    columnSpan: 4,
                }),
            ],
        });
    }

    private createEmployeeHeaderRow(): TableRow {
        return new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Datum:", size: 22 })] })],
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Name", bold: true, size: 26 })] })],
                    columnSpan: 9,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Qualifikation", size: 22 })] })],
                    columnSpan: 4,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "N-Std. lt. Auftrag", size: 22 })] })],
                    columnSpan: 2,
                }),
                new TableCell({
                    children: [
                        new Paragraph({ children: [new TextRun({ text: "Beginn", size: 22 })] }),
                        new Paragraph({ children: [new TextRun({ text: "Ende", size: 22 })] }),
                    ],
                    columnSpan: 2,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Temperatur", size: 22 })] })],
                    columnSpan: 3,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Wetter", size: 22 })] })],
                }),
            ],
        });
    }

    private async createEmployeeRows(
        mitarbeiterList: any[],
        individualDates: {[key: string]: string},
        individualTimes: {[key: string]: string},
        requestData: CreateReportRequest
    ): Promise<TableRow[]> {
        return await Promise.all(mitarbeiterList.map(async (mitarbeiter: any, index: number) => {
            // Für Bautagesberichte: Globales Datum verwenden (arbeitsdatum)
            // Für andere Dokumenttypen: Individuelles Datum verwenden
            const employeeKey = `${mitarbeiter.name}_${index}`;
            let employeeDate: string;

            if (requestData.documentType === 'bautagesbericht') {
                // Bei Bautagesberichten: Verwende das globale arbeitsdatum für alle Mitarbeiter
                employeeDate = requestData.arbeitsdatum;
            } else {
                // Bei anderen Dokumenttypen: Verwende individuelles Datum oder Fallback
                employeeDate = individualDates[employeeKey] || requestData.arbeitsdatum;
            }

            const employeeTime = individualTimes[employeeKey] || requestData.arbeitszeit;
            const timeWorked = this.calculateDuration(employeeTime);

            const weatherData = await this.weatherService.getWeatherForDateAndLocation(employeeDate, requestData.ortBaustelle);

            return new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: this.formatDate(employeeDate), size: 20 })] })],
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: mitarbeiter.name, size: 20 })] })],
                        columnSpan: 9,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: mitarbeiter.qualifikation, size: 20 })] })],
                        columnSpan: 4,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: timeWorked, size: 20 })] })],
                        columnSpan: 2,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: employeeTime, size: 20 })] })],
                        columnSpan: 2,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: weatherData.temperature, size: 20 })] })],
                        columnSpan: 3,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: weatherData.condition, size: 20 })] })],
                    }),
                ],
            });
        }));
    }

    private createEmptyEmployeeRows(mitarbeiterList: any[]): TableRow[] {
        return Array(Math.max(0, 4 - mitarbeiterList.length)).fill(0).map(() => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })], columnSpan: 9 }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })], columnSpan: 4 }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })], columnSpan: 2 }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })], columnSpan: 2 }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })], columnSpan: 3 }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })] }),
            ],
        }));
    }

    private createWorkDescriptionHeaderRow(): TableRow {
        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "Leistungsbeschreibung", bold: true, size: 24 })],
                        }),
                    ],
                    columnSpan: 10,
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "Besondere Vorkommnisse:", bold: true, size: 24 })],
                        }),
                    ],
                    columnSpan: 13,
                }),
            ],
        });
    }

    private createWorkDescriptionRow(mitarbeiterList: any[], requestData: CreateReportRequest): TableRow {
        // Extrahiere die Textdaten aus dem Request
        const regieTextDataFromRequest = requestData.regieTextData || {};

        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "", size: 22 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: "", size: 22 })],
                        }),

                        ...this.createBautagesTextParagraphs(regieTextDataFromRequest, 'durchgefuehrte_arbeiten'),
                    ],
                    columnSpan: 10,
                    verticalAlign: VerticalAlign.TOP,
                }),
                new TableCell({
                    children: [
                        // Bedenkanmeldung oben (mittleres Feld nach oben bewegt)
                        new Paragraph({
                            children: [new TextRun({ text: "Bedenkanmeldung/Hinweise an den AG:", underline: { type: "single" }, size: 20 })],
                        }),
                        ...this.createBautagesTextParagraphs(regieTextDataFromRequest, 'bedenkanmeldung'),

                        // Behinderungen in der Mitte
                        new Paragraph({
                            children: [new TextRun({ text: "Behinderungen/Erschwernisse/Begehungen/Abnahme", underline: { type: "single" }, size: 20 })],
                        }),
                        ...this.createBautagesTextParagraphs(regieTextDataFromRequest, 'behinderungen'),

                    ],
                    columnSpan: 13,
                    verticalAlign: VerticalAlign.TOP,
                }),
            ],
        });
    }

    // Neue Hilfsmethode für Bautagesberichte (ähnlich wie bei RegieGenerator)
    private createBautagesTextParagraphs(regieTextData: any, field: string): Paragraph[] {
        if (regieTextData[field]) {
            return [
                new Paragraph({ children: [new TextRun({ text: regieTextData[field], size: 18 })] }),
                new Paragraph({ children: [new TextRun({ text: "", size: 16 })] }),
            ];
        } else {
            return [
                new Paragraph({ children: [new TextRun({ text: "", size: 16 })] }),
                new Paragraph({ children: [new TextRun({ text: "", size: 16 })] })
            ];
        }
    }

    private createSignatureRow(requestData: CreateReportRequest, mitarbeiterList: any[]): TableRow {
        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `Datum: ${this.formatDate(requestData.arbeitsdatum)}`, size: 20 })],
                        }),

                    ],
                    columnSpan: 3,
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `AN: ${mitarbeiterList.length > 0 ? mitarbeiterList[0].name : ''}`, size: 20 })],
                        }),
                    ],
                    columnSpan: 7,
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "AG od. bevollmächtigter Vertreter:", size: 20 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: "Name in Druckbuchstaben:", size: 20 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: "", size: 16 })],
                        }),
                    ],
                    columnSpan: 13,
                }),
            ],
        });
    }
}
