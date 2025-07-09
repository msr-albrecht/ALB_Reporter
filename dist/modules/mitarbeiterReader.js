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
exports.MitarbeiterReader = void 0;
const fs = __importStar(require("fs"));
class MitarbeiterReader {
    constructor(csvPath = './arbeiter.csv') {
        this.csvPath = csvPath;
    }
    async readMitarbeiterData() {
        try {
            const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
            const lines = csvContent.split('\n').filter(line => line.trim());
            const dataLines = lines.slice(1);
            return dataLines.map(line => {
                const columns = line.split(';');
                return {
                    name: columns[0]?.trim() || '',
                    qualifikation: columns[1]?.trim() || ''
                };
            });
        }
        catch (error) {
            console.error('Error reading Mitarbeiter CSV file:', error);
            return [];
        }
    }
}
exports.MitarbeiterReader = MitarbeiterReader;
//# sourceMappingURL=mitarbeiterReader.js.map