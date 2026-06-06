import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import pino from "pino";
import {
  default as makeWASocket,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import { v4 as uuid } from "uuid";
import { config, resolveAppPath } from "../config.js";
import { getDb, getSettings } from "../db.js";
import { generateReply } from "./openrouter.js";
import { isWithinQuietHours, randomDelaySeconds } from "../utils/time.js";

let sock = null;
let io = null;
let status = "Disconnected";
let latestQr = null;
let reconnecting = false;

export function initWhatsApp(socketIo) {
  io = socketIo;
  connectWhatsApp().catch((error) => {
    status = "Disconnected";
    emitStatus();
    console.error("WhatsApp init failed:", error.message);
  });
}

export function getWhatsAppState() {
  return { status, qr: latestQr };
}

function emitStatus() {
  io?.emit("whatsapp:status", getWhatsAppState());
}

export async function connectWhatsApp() {
  if (sock || reconnecting) return;
  reconnecting = true;
  status = "Reconnecting";
  emitStatus();

  const authDir = resolveAppPath(config.baileysAuthDir);
  fs.mkdirSync(authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["Madu AI", "Chrome", "1.0"],
    markOnlineOnConnect: false
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      latestQr = await QRCode.toDataURL(qr);
      status = "Disconnected";
      emitStatus();
    }
    if (connection === "open") {
      latestQr = null;
      status = "Connected";
      reconnecting = false;
      emitStatus();
      await syncChats();
    }
    if (connection === "close") {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
      sock = null;
      status = "Disconnected";
      reconnecting = false;
      emitStatus();
      if (reason !== DisconnectReason.loggedOut) setTimeout(() => connectWhatsApp(), 5000);
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    for (const message of messages) await handleIncomingMessage(message);
  });

  reconnecting = false;
}

export async function logoutWhatsApp() {
  try {
    await sock?.logout();
  } catch {
    // Ignore logout failures and remove local auth below.
  }
  sock = null;
  latestQr = null;
  status = "Disconnected";
  fs.rmSync(resolveAppPath(config.baileysAuthDir), { recursive: true, force: true });
  emitStatus();
}

export async function syncChats() {
  if (!sock) return;
  const db = await getDb();
  const chats = Object.values(sock.store?.chats || {});
  for (const chat of chats) {
    await upsertContact(db, {
      jid: chat.id,
      name: chat.name || chat.subject || chat.id,
      pushName: chat.name,
      isGroup: chat.id.endsWith("@g.us")
    });
  }
}

async function upsertContact(db, contact) {
  const phone = contact.jid.split("@")[0];
  await db.run(
    `INSERT INTO contacts (jid, name, push_name, phone, is_group, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(jid) DO UPDATE SET
      name = COALESCE(excluded.name, contacts.name),
      push_name = COALESCE(excluded.push_name, contacts.push_name),
      phone = excluded.phone,
      is_group = excluded.is_group,
      updated_at = CURRENT_TIMESTAMP`,
    contact.jid,
    contact.name,
    contact.pushName,
    phone,
    contact.isGroup ? 1 : 0
  );
}

function extractText(message) {
  const body = message.message;
  return (
    body?.conversation ||
    body?.extendedTextMessage?.text ||
    body?.imageMessage?.caption ||
    body?.videoMessage?.caption ||
    ""
  ).trim();
}

async function handleIncomingMessage(message) {
  if (!message.message || message.key.fromMe) return;
  const jid = message.key.remoteJid;
  const text = extractText(message);
  if (!jid || !text) return;

  const db = await getDb();
  await upsertContact(db, {
    jid,
    name: message.pushName || jid,
    pushName: message.pushName,
    isGroup: jid.endsWith("@g.us")
  });

  await db.run(
    "INSERT INTO message_logs (id, contact_jid, direction, source, message) VALUES (?, ?, 'incoming', 'manual', ?)",
    uuid(),
    jid,
    text
  );
  io?.emit("message:new", { jid, direction: "incoming", message: text });

  await maybeAutoReply(jid, text);
}

async function maybeAutoReply(jid, text) {
  const db = await getDb();
  const settings = await getSettings();
  const contact = await db.get("SELECT * FROM contacts WHERE jid = ?", jid);
  const isGroup = jid.endsWith("@g.us");
  if (settings.pause_all === "true" || settings.ai_enabled !== "true") return;
  if (isGroup && settings.allow_groups !== "true") return;
  if (contact?.blocked || contact?.ignored) return;
  if (settings.ai_selected_only === "true" && !contact?.ai_enabled) return;
  if (!contact && settings.unknown_auto_reply !== "true") return;
  if (isWithinQuietHours(settings)) return;

  const stopWords = settings.stop_keywords.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (stopWords.some((word) => text.toLowerCase().includes(word))) {
    await db.run("UPDATE contacts SET ignored = 1 WHERE jid = ?", jid);
    return;
  }

  const urgentWords = settings.urgent_keywords.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (urgentWords.some((word) => text.toLowerCase().includes(word))) {
    io?.emit("automation:urgent", { jid, text });
    return;
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const recent = await db.get(
    "SELECT COUNT(*) as count FROM message_logs WHERE contact_jid = ? AND direction = 'outgoing' AND source = 'ai' AND created_at > ?",
    jid,
    oneHourAgo
  );
  if (recent.count >= Number(settings.max_replies_per_hour || 6)) return;

  const contextRows = await db.all(
    "SELECT direction, message FROM message_logs WHERE contact_jid = ? ORDER BY created_at DESC LIMIT 8",
    jid
  );
  const context = contextRows.reverse().map((row) => `${row.direction}: ${row.message}`).join("\n");
  const samples = await db.all("SELECT text FROM style_samples ORDER BY created_at DESC LIMIT 20");

  let generated;
  try {
    generated = await generateReply({ message: text, contact, context, samples, settings });
  } catch (error) {
    generated = { text: settings.fallback_message, prompt: error.message, tokens: 0 };
  }

  if (settings.manual_approval === "true") {
    await db.run(
      "INSERT INTO approvals (id, contact_jid, incoming_message, draft_reply, prompt) VALUES (?, ?, ?, ?, ?)",
      uuid(),
      jid,
      text,
      generated.text,
      generated.prompt
    );
    io?.emit("approval:new", { jid, draft: generated.text });
    return;
  }

  const delay = randomDelaySeconds(settings.reply_delay_min, settings.reply_delay_max);
  setTimeout(() => sendWhatsAppMessage(jid, generated.text, "ai", generated.prompt, generated.text, generated.tokens), delay * 1000);
}

export async function sendWhatsAppMessage(jid, text, source = "manual", prompt = null, aiResponse = null, tokens = 0) {
  if (!sock) throw new Error("WhatsApp is not connected");
  await sock.sendMessage(jid, { text });
  const db = await getDb();
  await db.run(
    "INSERT INTO message_logs (id, contact_jid, direction, source, message, prompt, ai_response, token_usage) VALUES (?, ?, 'outgoing', ?, ?, ?, ?, ?)",
    uuid(),
    jid,
    source,
    text,
    prompt,
    aiResponse,
    tokens
  );
  io?.emit("message:new", { jid, direction: "outgoing", source, message: text });
}
