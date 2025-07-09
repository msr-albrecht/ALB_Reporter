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
exports.RegieGenerator = void 0;
const docx_1 = require("docx");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const csvReader_1 = require("./csvReader");
class RegieGenerator {
    constructor(options = {}) {
        this.outputDir = options.outputDir || './generated_reports/regieberichte';
        this.csvReader = new csvReader_1.CsvReader();
        this.ensureOutputDirectory();
    }
    ensureOutputDirectory() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    formatDate(dateString) {
        if (!dateString || dateString.trim() === '') {
            return '';
        }
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) {
                return dateString;
            }
            return date.toLocaleDateString('de-DE', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
        }
        catch (error) {
            console.error('Error formatting date:', dateString, error);
            return dateString;
        }
    }
    getCurrentWeek(date) {
        const startDate = new Date(date.getFullYear(), 0, 1);
        const days = Math.floor((date.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
        return Math.ceil((days + startDate.getDay() + 1) / 7);
    }
    calculateDuration(timeRange, dateRange) {
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
                }
                catch (error) {
                    console.error('Error parsing date range:', error);
                    numberOfDays = 1;
                }
            }
        }
        const totalMinutes = (dailyHours * 60 + dailyMinutes) * numberOfDays;
        const totalHours = Math.floor(totalMinutes / 60);
        const remainingMinutes = totalMinutes % 60;
        const pad = (num) => num.toString().padStart(2, '0');
        return `${pad(totalHours)}:${pad(remainingMinutes)}`;
    }
    createMaterialTable(materials) {
        const headerRow = new docx_1.TableRow({
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
        });
        const materialRows = materials.length > 0 ? materials.map(material => new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: material.menge || "", size: 20 })] })],
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: material.einheit || "", size: 20 })] })],
                    columnSpan: 2,
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: material.beschreibung || "", size: 20 })] })],
                    columnSpan: 10,
                }),
            ],
        })) : [
            new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Keine Materialien angegeben", size: 20, italics: true })] })],
                        columnSpan: 13,
                    }),
                ],
            })
        ];
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
            rows: [headerRow, ...materialRows]
        });
    }
    async generateWordDocument(reportData, requestData) {
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
            }, {});
            const mainTable = this.createMainTable(reportData, requestData, mitarbeiterList, individualDates, individualTimes, wzDataFromRequest, wzLookup, regieTextDataFromRequest, materials, currentDate, documentTitle, documentSubject, isRegieantrag);
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
                                        text: isRegieantrag
                                            ? "Hinweis: Regieleistungen bedürfen der vorherigen schriftlichen Genehmigung durch den Auftraggeber. Ohne Genehmigung können keine Regiearbeiten durchgeführt werden."
                                            : "Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum. Mit der Bestätigung dieses Berichtes wurde die Sache kontrolliert und mängelfrei übergeben! Es gelten die Geschäftsbedingungen der Elektrotechniker, herausgegeben von der Bundesinnung!",
                                        size: 18,
                                        italics: true,
                                    }),
                                ],
                                spacing: { before: 400 },
                            }),
                            new docx_1.Paragraph({
                                children: [
                                    new docx_1.TextRun({
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
    createMainTable(reportData, requestData, mitarbeiterList, individualDates, individualTimes, wzDataFromRequest, wzLookup, regieTextDataFromRequest, materials, currentDate, documentTitle, documentSubject, isRegieantrag) {
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
    createHeaderRow(reportData, currentDate, documentTitle, documentSubject) {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: documentTitle, bold: true, size: 28 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: `Nr. ${reportData.reportNumber.toString().padStart(3, '0')}`, bold: true, size: 24 })],
                        }),
                    ],
                    columnSpan: 7,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Betreff:", bold: true, size: 28 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: documentSubject, size: 22 })],
                        }),
                    ],
                    columnSpan: 7,
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
                            children: [new docx_1.TextRun({ text: `Ort: ${requestData.strasseBaustelle}`, bold: true, size: 22 })],
                        }),
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
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({
                                    text: "Verg.nr.", size: 22
                                })]
                        }),
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
                    columnSpan: 7,
                }),
                new docx_1.TableCell({
                    children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Qualifikation", size: 22 })] })],
                    columnSpan: 3,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Regie", size: 22 })] }),
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Std.", size: 22 })] }),
                    ],
                    columnSpan: 4,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Beginn", size: 22 })] }),
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Ende", size: 22 })] }),
                    ],
                    columnSpan: 2,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "WZ", size: 22 })] }),
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "KM", size: 22 })] }),
                    ],
                    columnSpan: 2,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Üstd.", size: 22 })] }),
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "50%", size: 22 })] }),
                    ],
                    columnSpan: 3,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "Üstd.", size: 22 })] }),
                        new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "100%", size: 22 })] }),
                    ],
                }),
            ],
        });
    }
    createEmployeeRows(mitarbeiterList, individualDates, individualTimes, requestData, wzDataFromRequest, wzLookup, reportData) {
        return mitarbeiterList.map((mitarbeiter) => {
            const employeeDate = individualDates[mitarbeiter.name] || requestData.arbeitsdatum;
            const employeeTime = individualTimes[mitarbeiter.name] || requestData.arbeitszeit;
            const regieTime = this.calculateDuration(employeeTime, employeeDate);
            const shouldIncludeWZ = wzDataFromRequest[mitarbeiter.name]?.includeWZ || false;
            const employeeKuerzel = wzDataFromRequest[mitarbeiter.name]?.kuerzel || reportData.kuerzel;
            const wzValue = shouldIncludeWZ ? (wzLookup[employeeKuerzel] || '') : '';
            return new docx_1.TableRow({
                children: [
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: this.formatDate(employeeDate), size: 20 })] })],
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: mitarbeiter.name, size: 20 })] })],
                        columnSpan: 7,
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: mitarbeiter.qualifikation, size: 20 })] })],
                        columnSpan: 3,
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: regieTime, size: 20 })] })],
                        columnSpan: 4,
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: employeeTime, size: 20 })] })],
                        columnSpan: 2,
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: wzValue, size: 20 })] })],
                        columnSpan: 2,
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })],
                        columnSpan: 3,
                    }),
                    new docx_1.TableCell({
                        children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })],
                    }),
                ],
            });
        });
    }
    createEmptyEmployeeRows(mitarbeiterList) {
        return Array(Math.max(0, 4 - mitarbeiterList.length)).fill(0).map(() => new docx_1.TableRow({
            children: [
                new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })] }),
                new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })], columnSpan: 7 }),
                new docx_1.TableCell({ children: [new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 20 })] })], columnSpan: 3 }),
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
    createWorkDescriptionRow(requestData, mitarbeiterList, regieTextDataFromRequest, materials) {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Anlage:", size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Etage:", size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Achse:", size: 22 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "", size: 16 })],
                        }),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Durchgeführte Arbeiten:", bold: true, size: 22 })],
                        }),
                        ...this.createWorkDescriptionParagraphs(requestData, mitarbeiterList),
                    ],
                    columnSpan: 10,
                    verticalAlign: docx_1.VerticalAlign.TOP,
                }),
                new docx_1.TableCell({
                    children: [
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Behinderungen/Erschwernisse/Begehungen/Abnahme", underline: { type: "single" }, size: 20 })],
                        }),
                        ...this.createRegieTextParagraphs(regieTextDataFromRequest, 'behinderungen'),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Regieleistungen / Leistungsänderungen:", underline: { type: "single" }, size: 20 })],
                        }),
                        ...this.createRegieTextParagraphs(regieTextDataFromRequest, 'regieleistungen'),
                        new docx_1.Paragraph({
                            children: [new docx_1.TextRun({ text: "Bedenkanmeldung/Hinweise an den AG:", underline: { type: "single" }, size: 20 })],
                        }),
                        ...this.createRegieTextParagraphs(regieTextDataFromRequest, 'bedenkanmeldung'),
                        this.createMaterialTable(materials)
                    ],
                    columnSpan: 13,
                    verticalAlign: docx_1.VerticalAlign.TOP,
                }),
            ],
        });
    }
    createWorkDescriptionParagraphs(requestData, mitarbeiterList) {
        if (requestData.zusatzInformationen && requestData.zusatzInformationen.trim()) {
            return [
                new docx_1.Paragraph({
                    children: [new docx_1.TextRun({ text: `• ${requestData.zusatzInformationen}`, size: 20 })],
                })
            ];
        }
        else if (mitarbeiterList.length > 0) {
            return [
                new docx_1.Paragraph({
                    children: [new docx_1.TextRun({ text: `• Kunde: ${requestData.kunde}`, size: 20 })],
                })
            ];
        }
        else {
            return [
                new docx_1.Paragraph({
                    children: [new docx_1.TextRun({ text: "• Keine Tätigkeiten ausgeführt.", size: 20 })],
                })
            ];
        }
    }
    createRegieTextParagraphs(regieTextData, field) {
        if (regieTextData[field]) {
            return [
                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: regieTextData[field], size: 18 })] }),
                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 16 })] }),
            ];
        }
        else {
            return [
                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 16 })] }),
                new docx_1.Paragraph({ children: [new docx_1.TextRun({ text: "", size: 16 })] })
            ];
        }
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
exports.RegieGenerator = RegieGenerator;
//# sourceMappingURL=RegieGenerator.js.map