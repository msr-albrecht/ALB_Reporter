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
exports.WordGenerator = void 0;
const docx_1 = require("docx");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WordGenerator {
    constructor(options = {}) {
        this.outputDir = options.outputDir || './generated_reports';
        console.log(`WordGenerator initialized with output directory: ${this.outputDir}`);
        this.ensureOutputDirectory();
    }
    ensureOutputDirectory() {
        console.log(`Checking if output directory exists: ${this.outputDir}`);
        if (!fs.existsSync(this.outputDir)) {
            console.log(`Creating output directory: ${this.outputDir}`);
            fs.mkdirSync(this.outputDir, { recursive: true });
            console.log('Output directory created successfully');
        }
        else {
            console.log('Output directory already exists');
        }
    }
    formatDate(dateString) {
        const date = new Date(dateString);
        const formatted = date.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
        console.log(`Formatted date: ${dateString} -> ${formatted}`);
        return formatted;
    }
    async generateWordDocument(reportData) {
        console.log('=== Starting Word document generation ===');
        console.log('Report data for Word generation:', reportData);
        const fileName = `Bericht_${reportData.reportNumber.toString().padStart(4, '0')}_${reportData.autor.replace(/\s+/g, '_')}.docx`;
        const filePath = path.join(this.outputDir, fileName);
        console.log(`Generated file name: ${fileName}`);
        console.log(`Full file path: ${filePath}`);
        try {
            console.log('Creating report table...');
            const reportTable = new docx_1.Table({
                width: {
                    size: 100,
                    type: docx_1.WidthType.PERCENTAGE,
                },
                borders: {
                    top: { style: docx_1.BorderStyle.SINGLE, size: 1 },
                    bottom: { style: docx_1.BorderStyle.SINGLE, size: 1 },
                    left: { style: docx_1.BorderStyle.SINGLE, size: 1 },
                    right: { style: docx_1.BorderStyle.SINGLE, size: 1 },
                    insideHorizontal: { style: docx_1.BorderStyle.SINGLE, size: 1 },
                    insideVertical: { style: docx_1.BorderStyle.SINGLE, size: 1 },
                },
                rows: [
                    new docx_1.TableRow({
                        children: [
                            new docx_1.TableCell({
                                children: [
                                    new docx_1.Paragraph({
                                        children: [
                                            new docx_1.TextRun({
                                                text: "Feld",
                                                bold: true,
                                            }),
                                        ],
                                        alignment: docx_1.AlignmentType.CENTER,
                                    }),
                                ],
                                width: {
                                    size: 30,
                                    type: docx_1.WidthType.PERCENTAGE,
                                },
                            }),
                            new docx_1.TableCell({
                                children: [
                                    new docx_1.Paragraph({
                                        children: [
                                            new docx_1.TextRun({
                                                text: "Wert",
                                                bold: true,
                                            }),
                                        ],
                                        alignment: docx_1.AlignmentType.CENTER,
                                    }),
                                ],
                                width: {
                                    size: 70,
                                    type: docx_1.WidthType.PERCENTAGE,
                                },
                            }),
                        ],
                    }),
                    new docx_1.TableRow({
                        children: [
                            new docx_1.TableCell({
                                children: [
                                    new docx_1.Paragraph({
                                        children: [
                                            new docx_1.TextRun({
                                                text: "Berichtsnummer",
                                                bold: true,
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                            new docx_1.TableCell({
                                children: [
                                    new docx_1.Paragraph({
                                        children: [
                                            new docx_1.TextRun({
                                                text: reportData.reportNumber.toString().padStart(4, '0'),
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new docx_1.TableRow({
                        children: [
                            new docx_1.TableCell({
                                children: [
                                    new docx_1.Paragraph({
                                        children: [
                                            new docx_1.TextRun({
                                                text: "Autor",
                                                bold: true,
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                            new docx_1.TableCell({
                                children: [
                                    new docx_1.Paragraph({
                                        children: [
                                            new docx_1.TextRun({
                                                text: reportData.autor,
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new docx_1.TableRow({
                        children: [
                            new docx_1.TableCell({
                                children: [
                                    new docx_1.Paragraph({
                                        children: [
                                            new docx_1.TextRun({
                                                text: "Abteilung",
                                                bold: true,
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                            new docx_1.TableCell({
                                children: [
                                    new docx_1.Paragraph({
                                        children: [
                                            new docx_1.TextRun({
                                                text: reportData.abteilung,
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                    new docx_1.TableRow({
                        children: [
                            new docx_1.TableCell({
                                children: [
                                    new docx_1.Paragraph({
                                        children: [
                                            new docx_1.TextRun({
                                                text: "Erstellungsdatum",
                                                bold: true,
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                            new docx_1.TableCell({
                                children: [
                                    new docx_1.Paragraph({
                                        children: [
                                            new docx_1.TextRun({
                                                text: this.formatDate(reportData.createdAt),
                                            }),
                                        ],
                                    }),
                                ],
                            }),
                        ],
                    }),
                    ...(reportData.zusatzInformationen ? [
                        new docx_1.TableRow({
                            children: [
                                new docx_1.TableCell({
                                    children: [
                                        new docx_1.Paragraph({
                                            children: [
                                                new docx_1.TextRun({
                                                    text: "Zusätzliche Informationen",
                                                    bold: true,
                                                }),
                                            ],
                                        }),
                                    ],
                                }),
                                new docx_1.TableCell({
                                    children: [
                                        new docx_1.Paragraph({
                                            children: [
                                                new docx_1.TextRun({
                                                    text: reportData.zusatzInformationen,
                                                }),
                                            ],
                                        }),
                                    ],
                                }),
                            ],
                        }),
                    ] : []),
                ],
            });
            console.log('Creating Word document...');
            const doc = new docx_1.Document({
                sections: [
                    {
                        children: [
                            new docx_1.Paragraph({
                                children: [
                                    new docx_1.TextRun({
                                        text: `📊 Bericht #${reportData.reportNumber.toString().padStart(4, '0')}`,
                                        bold: true,
                                        size: 32,
                                    }),
                                ],
                                heading: docx_1.HeadingLevel.HEADING_1,
                                alignment: docx_1.AlignmentType.CENTER,
                                spacing: {
                                    after: 400,
                                },
                            }),
                            new docx_1.Paragraph({
                                children: [
                                    new docx_1.TextRun({
                                        text: "Automatisch generierter Bericht",
                                        italics: true,
                                        size: 24,
                                    }),
                                ],
                                alignment: docx_1.AlignmentType.CENTER,
                                spacing: {
                                    after: 600,
                                },
                            }),
                            reportTable,
                            new docx_1.Paragraph({
                                children: [
                                    new docx_1.TextRun({
                                        text: "",
                                    }),
                                ],
                                spacing: {
                                    before: 400,
                                },
                            }),
                            new docx_1.Paragraph({
                                children: [
                                    new docx_1.TextRun({
                                        text: "Generiert durch den automatischen Berichtsgenerator",
                                        italics: true,
                                        size: 20,
                                    }),
                                ],
                                alignment: docx_1.AlignmentType.CENTER,
                                spacing: {
                                    before: 400,
                                },
                            }),
                        ],
                    },
                ],
            });
            console.log('Converting document to buffer...');
            const buffer = await docx_1.Packer.toBuffer(doc);
            console.log(`Buffer created, size: ${buffer.length} bytes`);
            console.log('Writing file to disk...');
            fs.writeFileSync(filePath, buffer);
            console.log('File written successfully');
            if (fs.existsSync(filePath)) {
                const stats = fs.statSync(filePath);
                console.log(`File verification: ${filePath} exists, size: ${stats.size} bytes`);
            }
            else {
                console.error('File was not created successfully!');
                throw new Error('File was not created');
            }
            console.log('=== Word document generation completed successfully ===');
            return {
                filePath,
                fileName,
            };
        }
        catch (error) {
            console.error('=== Error during Word document generation ===');
            console.error('Error details:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }
    getOutputDirectory() {
        return this.outputDir;
    }
}
exports.WordGenerator = WordGenerator;
//# sourceMappingURL=wordGenerator.js.map