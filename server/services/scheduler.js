import cron from "node-cron";
import { v4 as uuid } from "uuid";
import { getDb, getSettings } from "../db.js";
import { generateReply } from "./openrouter.js";
import { sendWhatsAppMessage } from "./whatsapp.js";
import { nextRepeatDate, nowInTimezone } from "../utils/time.js";

let task;
const sentDaily = new Set();

export function startScheduler() {
  task?.stop();
  task = cron.schedule("* * * * *", tick, { timezone: process.env.TIMEZONE || "Asia/Colombo" });
}

async function tick() {
  const settings = await getSettings();
  if (settings.pause_all === "true") return;
  await processSchedules();
  await processMorningNight("morning", settings);
  await processMorningNight("night", settings);
}

async function processSchedules() {
  const db = await getDb();
  const now = new Date().toISOString();
  const rows = await db.all(
    `SELECT s.*, c.blocked, c.ignored, c.scheduled_enabled
     FROM schedules s
     JOIN contacts c ON c.jid = s.contact_jid
     WHERE s.status = 'pending' AND s.scheduled_at <= ?
     LIMIT 10`,
    now
  );

  for (const row of rows) {
    if (row.blocked || row.ignored || !row.scheduled_enabled) continue;
    try {
      await sendWhatsAppMessage(row.contact_jid, row.message, "scheduled");
      await db.run(
        "INSERT INTO delivery_logs (id, schedule_id, contact_jid, type, status, message) VALUES (?, ?, ?, 'scheduled', 'sent', ?)",
        uuid(),
        row.id,
        row.contact_jid,
        row.message
      );
      if (row.repeat === "once") {
        await db.run("UPDATE schedules SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?", row.id);
      } else {
        await db.run(
          "UPDATE schedules SET scheduled_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          nextRepeatDate(row.scheduled_at, row.repeat).toISOString(),
          row.id
        );
      }
    } catch (error) {
      await db.run("UPDATE schedules SET status = 'failed', last_error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", error.message, row.id);
    }
  }
}

async function processMorningNight(type, settings) {
  if (settings[`${type}_enabled`] !== "true") return;
  const now = nowInTimezone();
  const dateKey = now.toISOString().slice(0, 10);
  const [startH, startM] = settings[`${type}_start`].split(":").map(Number);
  const [endH, endM] = settings[`${type}_end`].split(":").map(Number);
  const current = now.getHours() * 60 + now.getMinutes();
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  if (current < start || current > end) return;

  const db = await getDb();
  const flag = type === "morning" ? "morning_enabled" : "night_enabled";
  const contacts = await db.all(`SELECT * FROM contacts WHERE ${flag} = 1 AND blocked = 0 AND ignored = 0`);
  const templates = settings[`${type}_templates`].split("\n").map((x) => x.trim()).filter(Boolean);

  for (const contact of contacts) {
    const key = `${type}:${dateKey}:${contact.jid}`;
    if (sentDaily.has(key)) continue;
    sentDaily.add(key);
    let text = templates[Math.floor(Math.random() * templates.length)] || (type === "morning" ? "Good morning!" : "Good night!");
    try {
      if (settings[`${type}_ai`] === "true") {
        const samples = await db.all("SELECT text FROM style_samples ORDER BY created_at DESC LIMIT 20");
        const result = await generateReply({
          message: type === "morning" ? "Write a personalized good morning WhatsApp message." : "Write a personalized good night WhatsApp message.",
          contact,
          context: "",
          samples,
          settings
        });
        text = result.text;
      }
      await sendWhatsAppMessage(contact.jid, text, type);
      await db.run(
        "INSERT INTO delivery_logs (id, contact_jid, type, status, message) VALUES (?, ?, ?, 'sent', ?)",
        uuid(),
        contact.jid,
        type,
        text
      );
    } catch (error) {
      await db.run(
        "INSERT INTO delivery_logs (id, contact_jid, type, status, message, error) VALUES (?, ?, ?, 'failed', ?, ?)",
        uuid(),
        contact.jid,
        type,
        text,
        error.message
      );
    }
  }
}
