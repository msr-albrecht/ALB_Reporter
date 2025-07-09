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
exports.BautagesberichtGenerator = void 0;
const docx_1 = require("docx");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const weatherService_1 = require("./weatherService");
class BautagesberichtGenerator {
    constructor(options = {}) {
        this.outputDir = options.outputDir || './generated_reports/bautagesberichte';
        this.weatherService = new weatherService_1.WeatherService();
        this.ensureOutputDirectory();
    }
    ensureOutputDirectory() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }
    getCurrentWeek(date) {
        const startDate = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + startDate.getDay() + 1) / 7);
    }
    calculateDuration(timeRange) {
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
        const pad = (num) => num.toString().padStart(2, '0');
        return `${pad(hours)}:${pad(minutes)}`;
    }
    async generateWordDocument(reportData, requestData) {
        const currentDate = new Date();
        const fileName = `BTB_${reportData.kuerzel}_${requestData.arbeitsdatum.replace(/-/g, '_')}_${reportData.reportNumber.toString().padStart(3, '0')}.docx`;
        const filePath = path.join(this.outputDir, fileName);
        try {
            const mitarbeiterList = JSON.parse(reportData.mitarbeiter);
            const individualDates = requestData.individualDates || {};
            const individualTimes = requestData.individualTimes || {};
            const mainTable = await this.createMainTable(reportData, requestData, mitarbeiterList, individualDates, individualTimes, currentDate);
            const header = this.createDocumentHeader();
            const doc = new docx_1.Document({
                sections: [{
                        headers: {
                            default: header,
                        },
                        children: [
                            mainTable,
                            new docx_1.Paragraph({
                                children: [new docx_1.TextRun({ text: "", size: 16 })],
                                spacing: { after: 300 },
                            }),
                            new docx_1.Paragraph({
                                children: [
                                    new docx_1.TextRun({
                                        text: "Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum. Mit der Bestätigung dieses Berichtes wurde die Sache kontrolliert und mängelfrei übergeben! Es gelten die Geschäftsbedingungen der Elektrotechniker, herausgegeben von der Bundesinnung!",
                                        size: 18,
                                        italics: true,
                                    }),
                                ],
                                spacing: { before: 400 },
                            }),
                            new docx_1.Paragraph({
                                children: [
                                    new docx_1.TextRun({
                                        text: "Als Bautagesbericht wird keine Unterschrift des Kunden benötigt.",
                                        size: 18,
                                        italics: true,
                                    }),
                                ],
                                spacing: { before: 200 },
                            }),
                        ],
                    }],
            });
            const buffer = await docx_1.Packer.toBuffer(doc);
            fs.writeFileSync(filePath, buffer);
            if (!fs.existsSync(filePath)) {
                throw new Error('File was not created');
            }
            return { filePath, fileName };
        }
        catch (error) {
            console.error('Error during Word document generation:', error);
            throw error;
        }
    }
    createDocumentHeader() {
        const logoPath = path.join(process.cwd(), 'photos', 'logo.jpg');
        const infoPath = path.join(process.cwd(), 'photos', 'albrechtInfo.jpg');
        let logoImageRun = null;
        let infoImageRun = null;
        if (fs.existsSync(logoPath)) {
            try {
                logoImageRun = new docx_1.ImageRun({
                    data: fs.readFileSync(logoPath),
                    transformation: {
                        width: 200,
                        height: 60,
                    },
                });
            }
            catch (error) {
                console.error('Error loading logo image:', error);
            }
        }
        if (fs.existsSync(infoPath)) {
            try {
                infoImageRun = new docx_1.ImageRun({
                    data: fs.readFileSync(infoPath),
                    transformation: {
                        width: 180,
                        height: 90,
                    },
                });
            }
            catch (error) {
                console.error('Error loading info image:', error);
            }
        }
        return new docx_1.Header({
            children: [
                new docx_1.Table({
                    width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
                    borders: {
                        top: { style: docx_1.BorderStyle.NONE },
                        bottom: { style: docx_1.BorderStyle.NONE },
                        left: { style: docx_1.BorderStyle.NONE },
                        right: { style: docx_1.BorderStyle.NONE },
                        insideHorizontal: { style: docx_1.BorderStyle.NONE },
                        insideVertical: { style: docx_1.BorderStyle.NONE },
                    },
                    rows: [
                        new docx_1.TableRow({
                            children: [
                                new docx_1.TableCell({
                                    children: [
                                        ...(logoImageRun ? [new docx_1.Paragraph({
                                                children: [logoImageRun],
                                                alignment: docx_1.AlignmentType.LEFT
                                            })] : []),
                                    ],
                                    width: { size: 50, type: docx_1.WidthType.PERCENTAGE },
                                }),
                                new docx_1.TableCell({
                                    children: [
                                        ...(infoImageRun ? [new docx_1.Paragraph({
                                                children: [infoImageRun],
                                                alignment: docx_1.AlignmentType.RIGHT
                                            })] : []),
                                    ],
                                    width: { size: 50, type: docx_1.WidthType.PERCENTAGE },
                                }),
                            ],
                        }),
                    ],
                }),
            ],
        });
    }
    async createMainTable(reportData, requestData, mitarbeiterList, individualDates, individualTimes, currentDate) {
        return new docx_1.Table({
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.SINGLE, size: 8 },
                bottom: { style: docx_1.BorderStyle.SINGLE, size: 8 },
                left: { style: docx_1.BorderStyle.SINGLE, size: 8 },
                right: { style: docx_1.BorderStyle.SINGLE, size: 8 },
                insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 8 },
                insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 8 },
            },
            rows: [
                this.createHeaderRow(reportData, currentDate),
                this.createCustomerRow(requestData),
                this.createCustomerAddressRow(requestData),
                this.createConstructionSiteRow(requestData),
                this.createConstructionAddressRow(requestData),
                this.createEmployeeHeaderRow(),
                ...await this.createEmployeeRows(mitarbeiterList, individualDates, individualTimes, requestData),
                ...this.createEmptyEmployeeRows(mitarbeiterList),
                this.createWorkDescriptionHeaderRow(),
                this.createWorkDescriptionRow(mitarbeiterList),
                this.createSignatureRow(currentDate, mitarbeiterList)
            ]
        });
    }
    createHeaderRow(reportData, currentDate) {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Bautagesbericht", bold: true, size: 28 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: `Nr. ${reportData.reportNumber.toString().padStart(3, '0')}`, bold: true, size: 24 })],
                        }),
                    ],
                    columnSpan: 8,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Betreff:", bold: true, size: 28 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "", size: 22 })],
                        }),
                    ],
                    columnSpan: 6,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: `Datum: ${this.formatDate(currentDate.toISOString())}`, size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: `KW: ${this.getCurrentWeek(currentDate)}`, size: 22 })],
                        }),
                    ],
                    columnSpan: 9,
                }),
            ],
        });
    }
    createCustomerRow(requestData) {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Kunde/Rechnungsanschrift:", bold: true, size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: requestData.kunde, bold: true, size: 22 })],
                        }),
                    ],
                    columnSpan: 23,
                }),
            ],
        });
    }
    createCustomerAddressRow(requestData) {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Ort:", bold: true, size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: requestData.strasseKunde, size: 22 })],
                        })
                    ],
                    columnSpan: 9,
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: requestData.ortKunde, size: 22 })] })],
                    columnSpan: 10,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Auftrags-Nr.:", size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: requestData.auftragsNr, size: 22 })],
                        }),
                    ],
                    columnSpan: 4,
                }),
            ],
        });
    }
    createConstructionSiteRow(requestData) {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Baustellenanschrift:", bold: true, size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: requestData.baustelle, bold: true, size: 22 })],
                        }),
                    ],
                    columnSpan: 23,
                }),
            ],
        });
    }
    createConstructionAddressRow(requestData) {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Ort:", bold: true, size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: requestData.strasseBaustelle, size: 22 })],
                        })
                    ],
                    columnSpan: 9,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: requestData.ortBaustelle, bold: true, size: 22 })],
                        }),
                    ],
                    columnSpan: 10,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Verg.nr.", size: 22 })] }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: requestData.vergNr, size: 22 })],
                        }),
                    ],
                    columnSpan: 4,
                }),
            ],
        });
    }
    createEmployeeHeaderRow() {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Datum:", size: 22 })] })],
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Name", bold: true, size: 26 })] })],
                    columnSpan: 9,
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Qualifikation", size: 22 })] })],
                    columnSpan: 4,
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "N-Std. lt. Auftrag", size: 22 })] })],
                    columnSpan: 2,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Beginn", size: 22 })] }),
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Ende", size: 22 })] }),
                    ],
                    columnSpan: 2,
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Temperatur", size: 22 })] })],
                    columnSpan: 3,
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Wetter", size: 22 })] })],
                }),
            ],
        });
    }
    async createEmployeeRows(mitarbeiterList, individualDates, individualTimes, requestData) {
        return await Promise.all(mitarbeiterList.map(async (mitarbeiter) => {
            const employeeDate = individualDates[mitarbeiter.name] || requestData.arbeitsdatum;
            const employeeTime = individualTimes[mitarbeiter.name] || requestData.arbeitszeit;
            const timeWorked = this.calculateDuration(employeeTime);
            const weatherData = await this.weatherService.getWeatherForDateAndLocation(employeeDate, requestData.ortBaustelle);
            return new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: this.formatDate(employeeDate), size: 20 })] })],
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: mitarbeiter.name, size: 20 })] })],
                        columnSpan: 9,
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: mitarbeiter.qualifikation, size: 20 })] })],
                        columnSpan: 4,
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: timeWorked, size: 20 })] })],
                        columnSpan: 2,
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: employeeTime, size: 20 })] })],
                        columnSpan: 2,
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: weatherData.temperature, size: 20 })] })],
                        columnSpan: 3,
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: weatherData.condition, size: 20 })] })],
                    }),
                ],
            });
        }));
    }
    createEmptyEmployeeRows(mitarbeiterList) {
        return Array(Math.max(0, 4 - mitarbeiterList.length)).fill(0).map(() => new docx_1.TableRow({
            children: [
                new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })] }),
                new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })], columnSpan: 9 }),
                new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })], columnSpan: 4 }),
                new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })], columnSpan: 2 }),
                new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })], columnSpan: 2 }),
                new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })], columnSpan: 3 }),
                new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })] }),
            ],
        }));
    }
    createWorkDescriptionHeaderRow() {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Leistungsbeschreibung", bold: true, size: 24 })],
                        }),
                    ],
                    columnSpan: 10,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Besondere Vorkommnisse:", bold: true, size: 24 })],
                        }),
                    ],
                    columnSpan: 13,
                }),
            ],
        });
    }
    createWorkDescriptionRow(mitarbeiterList) {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "", size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "", size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "", size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "", size: 16 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Durchgeführte Arbeiten:", bold: true, size: 22 })],
                        }),
                        ...this.createWorkDescriptionParagraphs(mitarbeiterList),
                    ],
                    columnSpan: 10,
                    verticalAlign: docx_1.VerticalAlign.TOP,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Behinderungen/Erschwernisse/Begehungen/Abnahme", underline: { type: "single" }, size: 20 })],
                        }),
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 16 })] }),
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 16 })] }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Regieleistungen / Leistungsänderungen:", underline: { type: "single" }, size: 20 })],
                        }),
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 16 })] }),
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 16 })] }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Bedenkanmeldung/Hinweise an den AG:", underline: { type: "single" }, size: 20 })],
                        }),
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 16 })] }),
                        this.createMaterialTable()
                    ],
                    columnSpan: 13,
                    verticalAlign: docx_1.VerticalAlign.TOP,
                }),
            ],
        });
    }
    createWorkDescriptionParagraphs(mitarbeiterList) {
        if (mitarbeiterList.length === 0) {
            return [
                new docx_1.Paragraph({
                    children: [new docx_1.TextRun({ text: "• Keine Tätigkeiten ausgeführt.", size: 20 })],
                })
            ];
        }
        else {
            return [
                new docx_1.Paragraph({
                    children: [new docx_1.TextRun({ text: "", size: 20 })],
                })
            ];
        }
    }
    createMaterialTable() {
        return new docx_1.Table({
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: {
                top: { style: docx_1.BorderStyle.SINGLE, size: 8 },
                bottom: { style: docx_1.BorderStyle.SINGLE, size: 8 },
                left: { style: docx_1.BorderStyle.SINGLE, size: 8 },
                right: { style: docx_1.BorderStyle.SINGLE, size: 8 },
                insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 8 },
                insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 8 },
            },
            rows: [
                new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({
                            children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Menge", bold: true, size: 22 })] })],
                        }),
                        new docx_1.TableCell({
                            children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "EH", bold: true, size: 22 })] })],
                            columnSpan: 2,
                        }),
                        new docx_1.TableCell({
                            children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Materialbezeichnung", bold: true, size: 22 })] })],
                            columnSpan: 10,
                        }),
                    ]
                }),
                new docx_1.TableRow({
                    children: [
                        new docx_1.TableCell({
                            children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "1", size: 20 })] })],
                        }),
                        new docx_1.TableCell({
                            children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "STK", size: 20 })] })],
                            columnSpan: 2,
                        }),
                        new docx_1.TableCell({
                            children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Diverse Materialien", size: 20 })] })],
                            columnSpan: 10,
                        }),
                    ],
                }),
            ]
        });
    }
    createSignatureRow(currentDate, mitarbeiterList) {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: `Datum: ${this.formatDate(currentDate.toISOString())}`, size: 20 })],
                        }),
                    ],
                    columnSpan: 3,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: `AN: ${mitarbeiterList.length > 0 ? mitarbeiterList[0].name : ''}`, size: 20 })],
                        }),
                    ],
                    columnSpan: 7,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "AG od. bevollmächtigter Vertreter:", size: 20 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Name in Druckbuchstaben:", size: 20 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "", size: 16 })],
                        }),
                    ],
                    columnSpan: 13,
                }),
            ],
        });
    }
}
exports.BautagesberichtGenerator = BautagesberichtGenerator;
//# sourceMappingURL=BautagesberichtGenerator.js.map