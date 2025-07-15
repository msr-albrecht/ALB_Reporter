import { Document, Paragraph, Table, TableRow, TableCell, WidthType, TextRun, BorderStyle, Packer, VerticalAlign, ImageRun, Header, AlignmentType } from 'docx';
import * as fs from 'fs';
import * as path from 'path';
import { ReportData } from './database';
import { CsvReader } from './csvReader';
import { CreateReportRequest } from './reportService';

export interface RegieGeneratorOptions {
    outputDir?: string;
}

export class RegieGenerator {
    private outputDir: string;
    private csvReader: CsvReader;

    constructor(options: RegieGeneratorOptions = {}) {
        this.outputDir = options.outputDir || './generated_reports/regieberichte';
        this.csvReader = new CsvReader();
        this.ensureOutputDirectory();
    }

    private ensureOutputDirectory(): void {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    private formatDate(dateString: string): string {
        if (!dateString || dateString.trim() === '') {
            return '';
        }

        try {
            // Prüfe ob es ein Datumsbereich ist (z.B. "2025-01-01 - 2025-01-01")
            if (dateString.includes(' - ')) {
                const [startDate, endDate] = dateString.split(' - ').map(d => d.trim());
                const formattedStart = this.formatSingleDate(startDate);
                const formattedEnd = this.formatSingleDate(endDate);

                // Wenn Start- und Enddatum gleich sind, nur einmal anzeigen
                if (formattedStart === formattedEnd) {
                    return formattedStart;
                }
                return `${formattedStart} - ${formattedEnd}`;
            }

            // Einzelnes Datum formatieren
            return this.formatSingleDate(dateString);
        } catch (error) {
            console.error('Error formatting date:', dateString, error);
            return dateString;
        }
    }

    private formatSingleDate(dateString: string): string {
        if (!dateString || dateString.trim() === '') {
            return '';
        }

        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return dateString;
            }

            return date.toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch (error) {
            console.error('Error formatting single date:', dateString, error);
            return dateString;
        }
    }

    private getCurrentWeek(date: Date): number {
        const startDate = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + startDate.getDay() + 1) / 7);
    }

    private calculateDuration(timeRange: string, dateRange?: string): string {
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
        const dailyHours = Math.floor(diffMinutes / 60);
        const dailyMinutes = diffMinutes % 60;

        let numberOfDays = 1;
        if (dateRange && dateRange.includes(' - ')) {
            const [startDateStr, endDateStr] = dateRange.split(' - ');
            if (startDateStr && endDateStr) {
                try {
                    const startDay = new Date(startDateStr);
                    const endDay = new Date(endDateStr);

                    if (!isNaN(startDay.getTime()) && !isNaN(endDay.getTime())) {
                        const timeDiff = endDay.getTime() - startDay.getTime();
                        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                        numberOfDays = daysDiff + 1;
                    }
                } catch (error) {
                    console.error('Error parsing date range:', error);
                    numberOfDays = 1;
                }
            }
        }

        const totalMinutes = (dailyHours * 60 + dailyMinutes) * numberOfDays;
        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;

        const pad = (num: number) => num.toString().padStart(2, '0');
        return `${pad(totalHours)}:${pad(remainingMinutes)}`;
    }

    private createMaterialTable(materials: any[]): Table {
        const headerRow = new TableRow({
            children: [
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Menge", bold: true, size: 22 })] })],
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "EH", bold: true, size: 22 })] })],
                    columnSpan: 2,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Materialbezeichnung", bold: true, size: 22 })] })],
                    columnSpan: 10,
                }),
            ]
        });

        const materialRows = materials.length > 0 ? materials.map(material =>
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: material.menge || "", size: 20 })] })],
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: material.einheit || "", size: 20 })] })],
                        columnSpan: 2,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: material.beschreibung || "", size: 20 })] })],
                        columnSpan: 10,
                    }),
                ],
            })
        ) : [
            new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "Keine Materialien angegeben", size: 20, italics: true })] })],
                        columnSpan: 13,
                    }),
                ],
            })
        ];

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
            rows: [headerRow, ...materialRows]
        });
    }

    async generateWordDocument(reportData: ReportData, requestData: CreateReportRequest): Promise<{ filePath: string; fileName: string }> {
        const currentDate = new Date();
        const isRegieantrag = reportData.documentType === 'regieantrag';

        const filePrefix = isRegieantrag ? 'RGA' : 'RGE';
        const outputDir = isRegieantrag ? './generated_reports/regieantraege' : './generated_reports/regieberichte';

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const fileName = `${filePrefix}_${reportData.kuerzel}_${requestData.arbeitsdatum.replace(/-/g, '_')}_${reportData.reportNumber.toString().padStart(3, '0')}.docx`;
        const filePath = path.join(outputDir, fileName);

        try {
            const mitarbeiterList = JSON.parse(reportData.mitarbeiter);
            const documentTitle = isRegieantrag ? "Regieantrag" : "Regiebericht";
            const documentSubject = isRegieantrag ? "Antrag auf Regiearbeiten" : "";

            const individualDates = requestData.individualDates || {};
            const individualTimes = requestData.individualTimes || {};
            const wzDataFromRequest = requestData.wzData || {};
            const regieTextDataFromRequest = requestData.regieTextData || {};
            const materials = requestData.materials || [];

            const csvData = await this.csvReader.readCsvData();
            const wzLookup = csvData.reduce((acc, item) => {
                acc[item.kuerzel] = item.wz;
                return acc;
            }, {} as {[key: string]: string});

            const mainTable = this.createMainTable(
                reportData,
                requestData,
                mitarbeiterList,
                individualDates,
                individualTimes,
                wzDataFromRequest,
                wzLookup,
                regieTextDataFromRequest,
                materials,
                currentDate,
                documentTitle,
                documentSubject,
                isRegieantrag
            );

            const header = this.createDocumentHeader();

            const doc = new Document({
                sections: [{
                    headers: {
                        default: header,
                    },
                    children: [
                        mainTable,
                        new Paragraph({
                            children: [new TextRun({ text: "", size: 16 })],
                            spacing: { after: 300 },
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: isRegieantrag
                                        ? "Hinweis: Regieleistungen bedürfen der vorherigen schriftlichen Genehmigung durch den Auftraggeber. Ohne Genehmigung können keine Regiearbeiten durchgeführt werden."
                                        : "Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum. Mit der Bestätigung dieses Berichtes wurde die Sache kontrolliert und mängelfrei übergeben! Es gelten die Geschäftsbedingungen der Elektrotechniker, herausgegeben von der Bundesinnung!",
                                    size: 18,
                                    italics: true,
                                }),
                            ],
                            spacing: { before: 400 },
                        }),
                        new Paragraph({
                            children: [
                                new TextRun({
                                    text: isRegieantrag
                                        ? "Nach Genehmigung ist ein separater Regiebericht zu erstellen."
                                        : "Für Regieleistungen ist die Unterschrift des Kunden erforderlich.",
                                    size: 18,
                                    italics: true,
                                }),
                            ],
                            spacing: { before: 200 },
                        }),
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

    private createMainTable(
        reportData: ReportData,
        requestData: CreateReportRequest,
        mitarbeiterList: any[],
        individualDates: {[key: string]: string},
        individualTimes: {[key: string]: string},
        wzDataFromRequest: {[key: string]: any},
        wzLookup: {[key: string]: string},
        regieTextDataFromRequest: any,
        materials: any[],
        currentDate: Date,
        documentTitle: string,
        documentSubject: string,
        isRegieantrag: boolean
    ): Table {
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
                this.createHeaderRow(reportData, currentDate, documentTitle, documentSubject),
                this.createCustomerRow(requestData),
                this.createCustomerAddressRow(requestData),
                this.createConstructionSiteRow(requestData),
                this.createConstructionAddressRow(requestData),
                this.createEmployeeHeaderRow(),
                ...this.createEmployeeRows(mitarbeiterList, individualDates, individualTimes, requestData, wzDataFromRequest, wzLookup, reportData),
                ...this.createEmptyEmployeeRows(mitarbeiterList),
                this.createWorkDescriptionHeaderRow(),
                this.createWorkDescriptionRow(requestData, mitarbeiterList, regieTextDataFromRequest, materials),
                this.createSignatureRow(currentDate, mitarbeiterList)
            ]
        });
    }

    private createHeaderRow(reportData: ReportData, currentDate: Date, documentTitle: string, documentSubject: string): TableRow {
        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: documentTitle, bold: true, size: 28 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: `Nr. ${reportData.reportNumber.toString().padStart(3, '0')}`, bold: true, size: 24 })],
                        }),
                    ],
                    columnSpan: 7,
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "Betreff:", bold: true, size: 28 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: documentSubject, size: 22 })],
                        }),
                    ],
                    columnSpan: 7,
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `Datum: ${this.formatDate(currentDate.toISOString())}`, size: 22 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: `KW: ${this.getCurrentWeek(currentDate)}`, size: 22 })],
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
                            children: [new TextRun({ text: requestData.strasseKunde, size: 22 })],
                        })
                    ],
                    columnSpan: 9,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: requestData.ortKunde, size: 22 })] })],
                    columnSpan: 10,
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
                            children: [new TextRun({ text: requestData.baustelle, bold: true, size: 22 })],
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
                            children: [new TextRun({ text: `Ort: ${requestData.strasseBaustelle}`, bold: true, size: 22 })],
                        }),
                    ],
                    columnSpan: 9,
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: requestData.ortBaustelle, bold: true, size: 22 })],
                        }),
                    ],
                    columnSpan: 10,
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
                    columnSpan: 7,
                }),
                new TableCell({
                    children: [new Paragraph({ children: [new TextRun({ text: "Qualifikation", size: 22 })] })],
                    columnSpan: 3,
                }),
                new TableCell({
                    children: [
                        new Paragraph({ children: [new TextRun({ text: "Regie", size: 22 })] }),
                        new Paragraph({ children: [new TextRun({ text: "Std.", size: 22 })] }),
                    ],
                    columnSpan: 4,
                }),
                new TableCell({
                    children: [
                        new Paragraph({ children: [new TextRun({ text: "Beginn", size: 22 })] }),
                        new Paragraph({ children: [new TextRun({ text: "Ende", size: 22 })] }),
                    ],
                    columnSpan: 2,
                }),
                new TableCell({
                    children: [
                        new Paragraph({ children: [new TextRun({ text: "WZ", size: 22 })] }),
                        new Paragraph({ children: [new TextRun({ text: "KM", size: 22 })] }),
                    ],
                    columnSpan: 2,
                }),
                new TableCell({
                    children: [
                        new Paragraph({ children: [new TextRun({ text: "Üstd.", size: 22 })] }),
                        new Paragraph({ children: [new TextRun({ text: "50%", size: 22 })] }),
                    ],
                    columnSpan: 3,
                }),
                new TableCell({
                    children: [
                        new Paragraph({ children: [new TextRun({ text: "Üstd.", size: 22 })] }),
                        new Paragraph({ children: [new TextRun({ text: "100%", size: 22 })] }),
                    ],
                }),
            ],
        });
    }

    private createEmployeeRows(
        mitarbeiterList: any[],
        individualDates: {[key: string]: string},
        individualTimes: {[key: string]: string},
        requestData: CreateReportRequest,
        wzDataFromRequest: {[key: string]: any},
        wzLookup: {[key: string]: string},
        reportData: ReportData
    ): TableRow[] {
        return mitarbeiterList.map((mitarbeiter: any) => {
            const employeeDate = individualDates[mitarbeiter.name] || requestData.arbeitsdatum;
            const employeeTime = individualTimes[mitarbeiter.name] || requestData.arbeitszeit;
            const regieTime = this.calculateDuration(employeeTime, employeeDate);

            const shouldIncludeWZ = wzDataFromRequest[mitarbeiter.name]?.includeWZ || false;
            const employeeKuerzel = wzDataFromRequest[mitarbeiter.name]?.kuerzel || reportData.kuerzel;
            const wzValue = shouldIncludeWZ ? (wzLookup[employeeKuerzel] || '') : '';

            return new TableRow({
                children: [
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: this.formatDate(employeeDate), size: 20 })] })],
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: mitarbeiter.name, size: 20 })] })],
                        columnSpan: 7,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: mitarbeiter.qualifikation, size: 20 })] })],
                        columnSpan: 3,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: regieTime, size: 20 })] })],
                        columnSpan: 4,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: employeeTime, size: 20 })] })],
                        columnSpan: 2,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: wzValue, size: 20 })] })],
                        columnSpan: 2,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })],
                        columnSpan: 3,
                    }),
                    new TableCell({
                        children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })],
                    }),
                ],
            });
        });
    }

    private createEmptyEmployeeRows(mitarbeiterList: any[]): TableRow[] {
        return Array(Math.max(0, 4 - mitarbeiterList.length)).fill(0).map(() => new TableRow({
            children: [
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })] }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })], columnSpan: 7 }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })], columnSpan: 3 }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })], columnSpan: 4 }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })], columnSpan: 2 }),
                new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "", size: 20 })] })], columnSpan: 2}),
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

    private createWorkDescriptionRow(
        requestData: CreateReportRequest,
        mitarbeiterList: any[],
        regieTextDataFromRequest: any,
        materials: any[]
    ): TableRow {
        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "Anlage:", size: 22 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: "Etage:", size: 22 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: "Achse:", size: 22 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: "", size: 16 })],
                        }),
                        new Paragraph({
                            children: [new TextRun({ text: "Durchgeführte Arbeiten:", bold: true, size: 22 })],
                        }),
                        ...this.createWorkDescriptionParagraphs(requestData, mitarbeiterList),
                    ],
                    columnSpan: 10,
                    verticalAlign: VerticalAlign.TOP,
                }),
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: "Behinderungen/Erschwernisse/Begehungen/Abnahme", underline: { type: "single" }, size: 20 })],
                        }),
                        ...this.createRegieTextParagraphs(regieTextDataFromRequest, 'behinderungen'),
                        new Paragraph({
                            children: [new TextRun({ text: "Regieleistungen / Leistungsänderungen:", underline: { type: "single" }, size: 20 })],
                        }),
                        ...this.createRegieTextParagraphs(regieTextDataFromRequest, 'regieleistungen'),
                        new Paragraph({
                            children: [new TextRun({ text: "Bedenkanmeldung/Hinweise an den AG:", underline: { type: "single" }, size: 20 })],
                        }),
                        ...this.createRegieTextParagraphs(regieTextDataFromRequest, 'bedenkanmeldung'),
                        this.createMaterialTable(materials)
                    ],
                    columnSpan: 13,
                    verticalAlign: VerticalAlign.TOP,
                }),
            ],
        });
    }

    private createWorkDescriptionParagraphs(requestData: CreateReportRequest, mitarbeiterList: any[]): Paragraph[] {
        if (requestData.zusatzInformationen && requestData.zusatzInformationen.trim()) {
            return [
                new Paragraph({
                    children: [new TextRun({ text: `• ${requestData.zusatzInformationen}`, size: 20 })],
                })
            ];
        } else if (mitarbeiterList.length > 0) {
            return [
                new Paragraph({
                    children: [new TextRun({ text: `• Kunde: ${requestData.kunde}`, size: 20 })],
                })
            ];
        } else {
            return [
                new Paragraph({
                    children: [new TextRun({ text: "• Keine Tätigkeiten ausgeführt.", size: 20 })],
                })
            ];
        }
    }

    private createRegieTextParagraphs(regieTextData: any, field: string): Paragraph[] {
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

    private createSignatureRow(currentDate: Date, mitarbeiterList: any[]): TableRow {
        return new TableRow({
            children: [
                new TableCell({
                    children: [
                        new Paragraph({
                            children: [new TextRun({ text: `Datum: ${this.formatDate(currentDate.toISOString())}`, size: 20 })],
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
