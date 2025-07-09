"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./modules/database");
async function migrateDatabase() {
    console.log('Starting database migration...');
    try {
        const dbManager = new database_1.DatabaseManager('./reports.db');
        await dbManager.migrateFromOldDatabases();
        console.log('Database migration completed successfully!');
        dbManager.close();
        console.log('Migration finished. You can now delete the old database files:');
        console.log('- bautagesberichte.db');
        console.log('- regieberichte.db');
        console.log('- regieantraege.db');
    }
    catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}
migrateDatabase();
//# sourceMappingURL=migrate.js.map