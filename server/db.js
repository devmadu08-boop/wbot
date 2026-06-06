import fs from "fs";
import path from "path";
import sqlite3 from "sqlite3";
import { open } from "sqlite";
import { config, resolveAppPath } from "./config.js";

let db;

export async function getDb() {
  if (db) return db;
  const filename = resolveAppPath(config.databaseUrl);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  db = await open({ filename, driver: sqlite3.Database });
  await db.exec("PRAGMA foreign_keys = ON");
  return db;
}

export async function runMigrations() {
  const database = await getDb();
  await database.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS contacts (
      jid TEXT PRIMARY KEY,
      name TEXT,
      push_name TEXT,
      phone TEXT,
      nickname TEXT,
      is_group INTEGER DEFAULT 0,
      ai_enabled INTEGER DEFAULT 0,
      morning_enabled INTEGER DEFAULT 0,
      night_enabled INTEGER DEFAULT 0,
      scheduled_enabled INTEGER DEFAULT 1,
      blocked INTEGER DEFAULT 0,
      ignored INTEGER DEFAULT 0,
      last_seen_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS style_samples (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      language TEXT DEFAULT 'mixed',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS message_logs (
      id TEXT PRIMARY KEY,
      contact_jid TEXT,
      direction TEXT NOT NULL,
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      prompt TEXT,
      ai_response TEXT,
      status TEXT DEFAULT 'ok',
      error TEXT,
      token_usage INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(contact_jid) REFERENCES contacts(jid) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      contact_jid TEXT NOT NULL,
      message TEXT NOT NULL,
      scheduled_at TEXT NOT NULL,
      repeat TEXT DEFAULT 'once',
      language_style TEXT DEFAULT 'auto',
      status TEXT DEFAULT 'pending',
      last_error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(contact_jid) REFERENCES contacts(jid) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS delivery_logs (
      id TEXT PRIMARY KEY,
      schedule_id TEXT,
      contact_jid TEXT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT NOT NULL,
      error TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      contact_jid TEXT NOT NULL,
      incoming_message TEXT NOT NULL,
      draft_reply TEXT NOT NULL,
      prompt TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const defaults = {
    ai_enabled: "false",
    ai_selected_only: "false",
    unknown_auto_reply: "false",
    manual_approval: "false",
    pause_all: "false",
    max_replies_per_hour: "6",
    reply_delay_min: "5",
    reply_delay_max: "30",
    openrouter_model: "openai/gpt-4o-mini",
    openrouter_temperature: "0.75",
    openrouter_max_tokens: "180",
    fallback_message: "Sorry, mata poddak busy. passe reply karannam.",
    quiet_hours_enabled: "false",
    quiet_hours_start: "23:00",
    quiet_hours_end: "06:00",
    urgent_keywords: "urgent,emergency,important,asap,ඉක්මනට,හදිසි",
    stop_keywords: "stop,block,unsubscribe,නවත්තන්න",
    morning_enabled: "false",
    morning_start: "06:00",
    morning_end: "08:00",
    morning_ai: "false",
    morning_templates: "Good morning! ada dawasa lassanata yanna.\nSuba udasanak!",
    night_enabled: "false",
    night_start: "21:00",
    night_end: "23:00",
    night_ai: "false",
    night_templates: "Good night! hodata nida ganna.\nSuba rathriyak!",
    allow_groups: "false"
  };

  for (const [key, value] of Object.entries(defaults)) {
    await database.run("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", key, value);
  }
}

export async function getSetting(key, fallback = null) {
  const database = await getDb();
  const row = await database.get("SELECT value FROM settings WHERE key = ?", key);
  return row?.value ?? fallback;
}

export async function setSetting(key, value) {
  const database = await getDb();
  await database.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    String(value)
  );
}

export async function getSettings() {
  const database = await getDb();
  const rows = await database.all("SELECT key, value FROM settings");
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
