import { runMigrations } from "../db.js";

await runMigrations();
console.log("Database migrations completed.");
process.exit(0);
