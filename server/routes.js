import fs from "fs";
import path from "path";
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import multer from "multer";
import { v4 as uuid } from "uuid";
import { config, resolveAppPath } from "./config.js";
import { getDb, getSettings, setSetting } from "./db.js";
import { requireAuth } from "./middleware/auth.js";
import { connectWhatsApp, getWhatsAppState, logoutWhatsApp, sendWhatsAppMessage, syncChats } from "./services/whatsapp.js";

const upload = multer({ dest: resolveAppPath("./data/uploads") });

export function createRouter() {
  const router = express.Router();

  router.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const validUser = username === config.adminUsername;
    const validPass = config.adminPassword.startsWith("$2")
      ? await bcrypt.compare(password || "", config.adminPassword)
      : password === config.adminPassword;
    if (!validUser || !validPass) return res.status(401).json({ error: "Invalid login" });
    const token = jwt.sign({ username }, config.jwtSecret, { expiresIn: "12h" });
    res.json({ token, username });
  });

  router.use(requireAuth);

  router.get("/dashboard", async (_req, res) => {
    const db = await getDb();
    const [contacts, aiContacts, todaySchedules, failed, recent, delivery, tokens] = await Promise.all([
      db.get("SELECT COUNT(*) as count FROM contacts"),
      db.get("SELECT COUNT(*) as count FROM contacts WHERE ai_enabled = 1"),
      db.get("SELECT COUNT(*) as count FROM schedules WHERE date(scheduled_at) = date('now')"),
      db.get("SELECT COUNT(*) as count FROM message_logs WHERE status = 'failed'"),
      db.all("SELECT * FROM message_logs ORDER BY created_at DESC LIMIT 8"),
      db.all("SELECT type, status, COUNT(*) as count FROM delivery_logs GROUP BY type, status"),
      db.get("SELECT COALESCE(SUM(token_usage), 0) as total FROM message_logs")
    ]);
    res.json({
      whatsapp: getWhatsAppState(),
      totalContacts: contacts.count,
      aiContacts: aiContacts.count,
      todaySchedules: todaySchedules.count,
      failedMessages: failed.count,
      recent,
      delivery,
      tokenUsage: tokens.total
    });
  });

  router.get("/whatsapp/status", (_req, res) => res.json(getWhatsAppState()));
  router.post("/whatsapp/connect", async (_req, res) => {
    await connectWhatsApp();
    res.json(getWhatsAppState());
  });
  router.post("/whatsapp/logout", async (_req, res) => {
    await logoutWhatsApp();
    res.json({ ok: true });
  });
  router.post("/whatsapp/sync", async (_req, res) => {
    await syncChats();
    res.json({ ok: true });
  });
  router.post("/whatsapp/send", async (req, res) => {
    await sendWhatsAppMessage(req.body.jid, req.body.message, "manual");
    res.json({ ok: true });
  });

  router.get("/contacts", async (req, res) => {
    const db = await getDb();
    const q = `%${req.query.q || ""}%`;
    const contacts = await db.all(
      `SELECT * FROM contacts
       WHERE COALESCE(name,'') LIKE ? OR COALESCE(phone,'') LIKE ? OR COALESCE(nickname,'') LIKE ?
       ORDER BY COALESCE(nickname, name, phone) COLLATE NOCASE`,
      q,
      q,
      q
    );
    res.json(contacts);
  });

  router.patch("/contacts/:jid", async (req, res) => {
    const db = await getDb();
    const fields = ["nickname", "ai_enabled", "morning_enabled", "night_enabled", "scheduled_enabled", "blocked", "ignored"];
    const updates = fields.filter((field) => field in req.body);
    if (!updates.length) return res.json({ ok: true });
    const sql = updates.map((field) => `${field} = ?`).join(", ");
    const values = updates.map((field) => (typeof req.body[field] === "boolean" ? (req.body[field] ? 1 : 0) : req.body[field]));
    await db.run(`UPDATE contacts SET ${sql}, updated_at = CURRENT_TIMESTAMP WHERE jid = ?`, ...values, req.params.jid);
    res.json({ ok: true });
  });

  router.get("/settings", async (_req, res) => res.json(await getSettings()));
  router.put("/settings", async (req, res) => {
    for (const [key, value] of Object.entries(req.body)) await setSetting(key, value);
    res.json(await getSettings());
  });

  router.get("/style-samples", async (_req, res) => {
    const db = await getDb();
    res.json(await db.all("SELECT * FROM style_samples ORDER BY created_at DESC"));
  });
  router.post("/style-samples", async (req, res) => {
    const db = await getDb();
    await db.run("INSERT INTO style_samples (id, text, language) VALUES (?, ?, ?)", uuid(), req.body.text, req.body.language || "mixed");
    res.json({ ok: true });
  });
  router.delete("/style-samples/:id", async (req, res) => {
    const db = await getDb();
    await db.run("DELETE FROM style_samples WHERE id = ?", req.params.id);
    res.json({ ok: true });
  });

  router.get("/schedules", async (_req, res) => {
    const db = await getDb();
    res.json(await db.all("SELECT s.*, c.name, c.nickname FROM schedules s LEFT JOIN contacts c ON c.jid = s.contact_jid ORDER BY scheduled_at DESC"));
  });
  router.post("/schedules", async (req, res) => {
    const db = await getDb();
    await db.run(
      "INSERT INTO schedules (id, contact_jid, message, scheduled_at, repeat, language_style) VALUES (?, ?, ?, ?, ?, ?)",
      uuid(),
      req.body.contact_jid,
      req.body.message,
      req.body.scheduled_at,
      req.body.repeat || "once",
      req.body.language_style || "auto"
    );
    res.json({ ok: true });
  });
  router.patch("/schedules/:id", async (req, res) => {
    const db = await getDb();
    await db.run(
      "UPDATE schedules SET contact_jid = ?, message = ?, scheduled_at = ?, repeat = ?, language_style = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      req.body.contact_jid,
      req.body.message,
      req.body.scheduled_at,
      req.body.repeat,
      req.body.language_style,
      req.body.status,
      req.params.id
    );
    res.json({ ok: true });
  });
  router.delete("/schedules/:id", async (req, res) => {
    const db = await getDb();
    await db.run("DELETE FROM schedules WHERE id = ?", req.params.id);
    res.json({ ok: true });
  });

  router.get("/logs", async (req, res) => {
    const db = await getDb();
    const rows = await db.all("SELECT l.*, c.name, c.nickname FROM message_logs l LEFT JOIN contacts c ON c.jid = l.contact_jid ORDER BY l.created_at DESC LIMIT ?", Number(req.query.limit || 200));
    res.json(rows);
  });
  router.delete("/logs", async (_req, res) => {
    const db = await getDb();
    await db.run("DELETE FROM message_logs");
    res.json({ ok: true });
  });
  router.get("/logs/export.csv", async (_req, res) => {
    const db = await getDb();
    const rows = await db.all("SELECT * FROM message_logs ORDER BY created_at DESC");
    const csv = ["created_at,contact_jid,direction,source,status,message"].concat(
      rows.map((r) => [r.created_at, r.contact_jid, r.direction, r.source, r.status, JSON.stringify(r.message)].join(","))
    ).join("\n");
    res.header("Content-Type", "text/csv").send(csv);
  });

  router.get("/approvals", async (_req, res) => {
    const db = await getDb();
    res.json(await db.all("SELECT * FROM approvals WHERE status = 'pending' ORDER BY created_at DESC"));
  });
  router.post("/approvals/:id/send", async (req, res) => {
    const db = await getDb();
    const approval = await db.get("SELECT * FROM approvals WHERE id = ?", req.params.id);
    if (!approval) return res.status(404).json({ error: "Approval not found" });
    await sendWhatsAppMessage(approval.contact_jid, req.body.message || approval.draft_reply, "ai", approval.prompt, req.body.message || approval.draft_reply);
    await db.run("UPDATE approvals SET status = 'sent' WHERE id = ?", req.params.id);
    res.json({ ok: true });
  });

  router.post("/backup", async (_req, res) => {
    const backupDir = resolveAppPath(config.backupDir);
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dbSource = resolveAppPath(config.databaseUrl);
    const dbTarget = path.join(backupDir, `database-${stamp}.sqlite`);
    fs.copyFileSync(dbSource, dbTarget);
    res.json({ ok: true, file: dbTarget });
  });
  router.post("/restore", upload.single("database"), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "database file is required" });
    fs.copyFileSync(req.file.path, resolveAppPath(config.databaseUrl));
    res.json({ ok: true });
  });

  router.get("/reports/daily", async (_req, res) => {
    const db = await getDb();
    const rows = await db.all(
      `SELECT source, direction, status, COUNT(*) as count
       FROM message_logs
       WHERE date(created_at) = date('now')
       GROUP BY source, direction, status`
    );
    res.json(rows);
  });

  return router;
}
