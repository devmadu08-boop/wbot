import dotenv from "dotenv";
import path from "path";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL || "./data/madu-assistant.sqlite",
  openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "admin123",
  timezone: process.env.TIMEZONE || "Asia/Colombo",
  baileysAuthDir: process.env.BAILEYS_AUTH_DIR || "./data/baileys-auth",
  backupDir: process.env.BACKUP_DIR || "./backups"
};

export function resolveAppPath(value) {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
}
