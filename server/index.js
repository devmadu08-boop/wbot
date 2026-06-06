import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import { config } from "./config.js";
import { runMigrations } from "./db.js";
import { createRouter } from "./routes.js";
import { initWhatsApp } from "./services/whatsapp.js";
import { startScheduler } from "./services/scheduler.js";

await runMigrations();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.clientOrigin, credentials: true }
});

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use("/api", createRouter());

app.get("/", (_req, res) => res.json({ name: "Madu AI WhatsApp Assistant", ok: true }));

io.on("connection", (socket) => {
  socket.emit("ready", { ok: true });
});

initWhatsApp(io);
startScheduler();

server.listen(config.port, () => {
  console.log(`Madu AI WhatsApp Assistant API running on http://localhost:${config.port}`);
});
