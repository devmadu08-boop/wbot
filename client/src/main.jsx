import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import { io } from "socket.io-client";
import {
  Activity,
  Bell,
  CalendarClock,
  Check,
  DatabaseBackup,
  Download,
  LogOut,
  MessageCircle,
  Moon,
  QrCode,
  RefreshCcw,
  Save,
  Search,
  Settings,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  Users,
  Wifi,
  WifiOff
} from "lucide-react";
import "./styles.css";

const apiOrigin = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const apiBaseUrl = apiOrigin ? `${apiOrigin}/api` : "/api";
const socketUrl = apiOrigin || window.location.origin;

const api = axios.create({ baseURL: apiBaseUrl });
const storedToken = localStorage.getItem("token");
if (storedToken) api.defaults.headers.common.Authorization = `Bearer ${storedToken}`;

function applyToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem("token", token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem("token");
  }
}

function useAuth() {
  const [token, setTokenState] = useState(storedToken);
  function setToken(value) {
    applyToken(value);
    setTokenState(value);
  }
  return { token, setToken };
}

function Login({ onLogin }) {
  const [form, setForm] = useState({ username: "admin", password: "admin123" });
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", form);
      onLogin(data.token);
    } catch {
      setError("Login failed. Check your .env admin details.");
    }
  }
  return (
    <main className="min-h-screen grid place-items-center auth-bg p-4">
      <form onSubmit={submit} className="panel w-full max-w-md p-6 space-y-5">
        <div>
          <div className="h-12 w-12 rounded-2xl bg-emerald-500 text-white grid place-items-center shadow-soft">
            <MessageCircle size={26} />
          </div>
          <h1 className="mt-5 text-3xl font-bold text-slate-950 dark:text-white">Madu AI WhatsApp Assistant</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Secure dashboard login</p>
        </div>
        <input className="input" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input className="input" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className="btn-primary w-full" type="submit">Login</button>
      </form>
    </main>
  );
}

const nav = [
  ["Dashboard", Activity],
  ["WhatsApp", QrCode],
  ["Contacts", Users],
  ["AI Settings", Sparkles],
  ["Style Training", MessageCircle],
  ["Scheduler", CalendarClock],
  ["Morning Night", Sun],
  ["Chat Logs", Bell],
  ["System Logs", Shield],
  ["API Settings", Settings],
  ["Backup Restore", DatabaseBackup]
];

function AppShell({ onLogout }) {
  const [page, setPage] = useState("Dashboard");
  const [dark, setDark] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const socket = io(socketUrl, { transports: ["polling"] });
    socket.on("message:new", () => {
      setToast("New WhatsApp message");
      new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=").play().catch(() => {});
    });
    socket.on("automation:urgent", () => setToast("Urgent message detected"));
    return () => socket.disconnect();
  }, []);

  const Page = pages[page] || Dashboard;
  return (
    <main className="min-h-screen app-bg text-slate-900 dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-white/40 bg-white/58 p-4 backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/60 lg:block">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="h-11 w-11 rounded-2xl bg-emerald-500 text-white grid place-items-center"><MessageCircle /></div>
          <div>
            <p className="font-bold leading-tight">Madu AI</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">WhatsApp Assistant</p>
          </div>
        </div>
        <nav className="mt-5 space-y-1">
          {nav.map(([label, Icon]) => (
            <button key={label} onClick={() => setPage(label)} className={`nav-item ${page === label ? "active" : ""}`}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
      </aside>
      <section className="lg:pl-72">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-white/40 bg-white/55 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/55">
          <div>
            <h2 className="text-xl font-bold">{page}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Asia/Colombo automation control center</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="icon-btn" onClick={() => setDark(!dark)} title="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
            <button className="icon-btn" onClick={onLogout} title="Logout"><LogOut size={18} /></button>
          </div>
        </header>
        <div className="flex gap-2 overflow-x-auto p-3 lg:hidden">
          {nav.map(([label]) => <button className={`pill ${page === label ? "pill-active" : ""}`} onClick={() => setPage(label)} key={label}>{label}</button>)}
        </div>
        {toast && <button onClick={() => setToast("")} className="fixed right-4 top-20 z-20 rounded-xl bg-slate-950 px-4 py-3 text-sm text-white shadow-soft">{toast}</button>}
        <div className="p-4 md:p-6"><Page /></div>
      </section>
    </main>
  );
}

const toneClasses = {
  emerald: "bg-emerald-100 text-emerald-700",
  sky: "bg-sky-100 text-sky-700",
  violet: "bg-violet-100 text-violet-700",
  amber: "bg-amber-100 text-amber-700"
};

function Stat({ icon: Icon, label, value, tone = "emerald" }) {
  return (
    <div className="panel p-5">
      <div className={`h-10 w-10 rounded-xl grid place-items-center ${toneClasses[tone] || toneClasses.emerald}`}>
        <Icon size={20} />
      </div>
      <p className="mt-4 text-3xl font-bold">{value}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data));
  }, []);
  if (!data) return <Skeleton />;
  const connected = data.whatsapp.status === "Connected";
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Stat icon={connected ? Wifi : WifiOff} label="WhatsApp status" value={data.whatsapp.status} />
        <Stat icon={Users} label="Total contacts" value={data.totalContacts} tone="sky" />
        <Stat icon={Sparkles} label="AI enabled contacts" value={data.aiContacts} tone="violet" />
        <Stat icon={CalendarClock} label="Scheduled today" value={data.todaySchedules} tone="amber" />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="panel p-5 xl:col-span-2">
          <h3 className="section-title">Recent Replies</h3>
          <LogList rows={data.recent} />
        </div>
        <div className="panel p-5">
          <h3 className="section-title">Automation Health</h3>
          <div className="space-y-3 text-sm">
            <Row label="Failed messages" value={data.failedMessages} />
            <Row label="AI tokens used" value={data.tokenUsage} />
            {data.delivery.map((item) => <Row key={`${item.type}-${item.status}`} label={`${item.type} ${item.status}`} value={item.count} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsApp() {
  const [state, setState] = useState({ status: "Loading" });
  async function refresh() {
    const { data } = await api.get("/whatsapp/status");
    setState(data);
  }
  useEffect(() => {
    refresh();
    const socket = io(socketUrl, { transports: ["polling"] });
    socket.on("whatsapp:status", setState);
    return () => socket.disconnect();
  }, []);
  return (
    <div className="grid gap-5 lg:grid-cols-[380px,1fr]">
      <div className="panel p-5 text-center">
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-emerald-500 text-white grid place-items-center">
          {state.status === "Connected" ? <Wifi /> : <QrCode />}
        </div>
        <h3 className="text-xl font-bold">{state.status}</h3>
        {state.qr ? <img src={state.qr} alt="WhatsApp QR" className="mx-auto mt-5 rounded-2xl bg-white p-3 shadow-soft" /> : <p className="mt-4 text-sm text-slate-500">QR appears here when login is needed.</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button className="btn-primary" onClick={() => api.post("/whatsapp/connect").then(refresh)}><RefreshCcw size={16} /> Connect</button>
          <button className="btn-danger" onClick={() => api.post("/whatsapp/logout").then(refresh)}><LogOut size={16} /> Reset</button>
        </div>
      </div>
      <div className="panel p-5">
        <h3 className="section-title">Connection Safety</h3>
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">Baileys auth is stored locally in the configured session folder and reconnects after restart. Use reset only when you want to remove the WhatsApp Web session from this VPS.</p>
      </div>
    </div>
  );
}

function Contacts() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  async function load() {
    const { data } = await api.get("/contacts", { params: { q } });
    setRows(data);
  }
  useEffect(() => { load(); }, []);
  async function toggle(jid, field, value) {
    await api.patch(`/contacts/${encodeURIComponent(jid)}`, { [field]: value });
    load();
  }
  return (
    <div className="space-y-4">
      <div className="toolbar">
        <Search size={18} />
        <input className="plain-input" placeholder="Search contacts or numbers" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
        <button className="btn-secondary" onClick={load}>Search</button>
        <button className="btn-secondary" onClick={() => api.post("/whatsapp/sync").then(load)}><RefreshCcw size={16} /> Sync</button>
      </div>
      <div className="panel overflow-hidden">
        <table className="table">
          <thead><tr><th>Contact</th><th>AI</th><th>Morning</th><th>Night</th><th>Schedule</th><th>Ignored</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.jid}>
              <td>
                <input className="mini-input" defaultValue={c.nickname || ""} placeholder={c.name || c.phone} onBlur={(e) => toggle(c.jid, "nickname", e.target.value)} />
                <div className="text-xs text-slate-500">{c.phone || c.jid}</div>
              </td>
              {["ai_enabled", "morning_enabled", "night_enabled", "scheduled_enabled", "ignored"].map((field) => (
                <td key={field}><input type="checkbox" checked={!!c[field]} onChange={(e) => toggle(c.jid, field, e.target.checked)} /></td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

function SettingsPage({ mode }) {
  const [settings, setSettings] = useState({});
  useEffect(() => { api.get("/settings").then((r) => setSettings(r.data)); }, []);
  async function save() {
    const { data } = await api.put("/settings", settings);
    setSettings(data);
  }
  const fields = mode === "api"
    ? ["openrouter_api_key", "openrouter_model", "openrouter_temperature", "openrouter_max_tokens", "fallback_message"]
    : mode === "morning"
      ? ["morning_enabled", "morning_start", "morning_end", "morning_ai", "morning_templates", "night_enabled", "night_start", "night_end", "night_ai", "night_templates", "allow_groups"]
      : ["ai_enabled", "ai_selected_only", "unknown_auto_reply", "manual_approval", "pause_all", "max_replies_per_hour", "reply_delay_min", "reply_delay_max", "quiet_hours_enabled", "quiet_hours_start", "quiet_hours_end", "urgent_keywords", "stop_keywords"];
  return (
    <div className="panel p-5 space-y-4">
      <div className="flex items-center justify-between"><h3 className="section-title">Controls</h3><button className="btn-primary" onClick={save}><Save size={16} /> Save</button></div>
      <div className="grid gap-4 md:grid-cols-2">
        {fields.map((field) => <SettingInput key={field} field={field} value={settings[field] || ""} onChange={(value) => setSettings({ ...settings, [field]: value })} />)}
      </div>
    </div>
  );
}

function SettingInput({ field, value, onChange }) {
  const isBool = ["enabled", "selected_only", "unknown", "approval", "pause", "groups", "_ai"].some((x) => field.includes(x));
  const label = field.replaceAll("_", " ");
  if (field.includes("templates") || field.includes("keywords") || field === "fallback_message") {
    return <label className="field md:col-span-2"><span>{label}</span><textarea className="input min-h-28" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
  }
  if (isBool) {
    return <label className="toggle"><span>{label}</span><input type="checkbox" checked={value === "true"} onChange={(e) => onChange(String(e.target.checked))} /></label>;
  }
  return <label className="field"><span>{label}</span><input className="input" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function StyleTraining() {
  const [rows, setRows] = useState([]);
  const [text, setText] = useState("");
  async function load() { setRows((await api.get("/style-samples")).data); }
  useEffect(() => { load(); }, []);
  async function add() {
    if (!text.trim()) return;
    await api.post("/style-samples", { text });
    setText("");
    load();
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr,420px]">
      <div className="panel p-5 space-y-3">
        <h3 className="section-title">My Style Samples</h3>
        {rows.map((row) => <div className="sample" key={row.id}><p>{row.text}</p><button onClick={() => api.delete(`/style-samples/${row.id}`).then(load)}><Trash2 size={16} /></button></div>)}
      </div>
      <div className="panel p-5 space-y-3">
        <textarea className="input min-h-56" placeholder="Paste messages written by you..." value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn-primary w-full" onClick={add}><Check size={16} /> Add Sample</button>
      </div>
    </div>
  );
}

function Scheduler() {
  const [contacts, setContacts] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ repeat: "once", language_style: "auto" });
  async function load() {
    setContacts((await api.get("/contacts")).data);
    setRows((await api.get("/schedules")).data);
  }
  useEffect(() => { load(); }, []);
  async function add() {
    await api.post("/schedules", form);
    setForm({ repeat: "once", language_style: "auto" });
    load();
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[420px,1fr]">
      <div className="panel p-5 space-y-3">
        <select className="input" value={form.contact_jid || ""} onChange={(e) => setForm({ ...form, contact_jid: e.target.value })}>
          <option value="">Select contact</option>{contacts.map((c) => <option key={c.jid} value={c.jid}>{c.nickname || c.name || c.phone}</option>)}
        </select>
        <textarea className="input min-h-28" placeholder="Message" value={form.message || ""} onChange={(e) => setForm({ ...form, message: e.target.value })} />
        <input className="input" type="datetime-local" value={form.scheduled_at || ""} onChange={(e) => setForm({ ...form, scheduled_at: new Date(e.target.value).toISOString() })} />
        <select className="input" value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}><option>once</option><option>daily</option><option>weekly</option><option>monthly</option></select>
        <button className="btn-primary w-full" onClick={add}><CalendarClock size={16} /> Schedule</button>
      </div>
      <div className="panel overflow-hidden"><SimpleTable rows={rows} columns={["nickname", "message", "scheduled_at", "repeat", "status"]} onDelete={(id) => api.delete(`/schedules/${id}`).then(load)} /></div>
    </div>
  );
}

function Logs() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/logs").then((r) => setRows(r.data)); }, []);
  return (
    <div className="space-y-3">
      <div className="toolbar justify-end">
        <a className="btn-secondary" href={`${apiBaseUrl}/logs/export.csv`}><Download size={16} /> CSV</a>
        <button className="btn-danger" onClick={() => api.delete("/logs").then(() => setRows([]))}><Trash2 size={16} /> Clear</button>
      </div>
      <div className="panel p-5"><LogList rows={rows} detailed /></div>
    </div>
  );
}

function BackupRestore() {
  return (
    <div className="panel p-5 space-y-4">
      <h3 className="section-title">Backup & Restore</h3>
      <button className="btn-primary" onClick={() => api.post("/backup").then((r) => alert(`Backup created: ${r.data.file}`))}><DatabaseBackup size={16} /> Create Backup</button>
      <p className="text-sm text-slate-500">Restore endpoint is available at <code>/api/restore</code> for database upload.</p>
    </div>
  );
}

function SystemLogs() {
  const [reports, setReports] = useState([]);
  const [approvals, setApprovals] = useState([]);
  useEffect(() => {
    api.get("/reports/daily").then((r) => setReports(r.data));
    api.get("/approvals").then((r) => setApprovals(r.data));
  }, []);
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="panel p-5"><h3 className="section-title">Daily Report</h3><SimpleTable rows={reports} columns={["source", "direction", "status", "count"]} /></div>
      <div className="panel p-5"><h3 className="section-title">Pending Approvals</h3><LogList rows={approvals.map((a) => ({ ...a, message: a.draft_reply }))} /></div>
    </div>
  );
}

function LogList({ rows, detailed }) {
  return <div className="space-y-3">{rows.map((row) => <div key={row.id} className="log-row"><div><p className="font-medium">{row.message}</p>{detailed && row.prompt && <details className="mt-2 text-xs"><summary>AI prompt</summary><pre>{row.prompt}</pre></details>}<p className="text-xs text-slate-500">{row.created_at} · {row.source || row.status}</p></div></div>)}</div>;
}

function SimpleTable({ rows, columns, onDelete }) {
  return <table className="table"><thead><tr>{columns.map((c) => <th key={c}>{c.replaceAll("_", " ")}</th>)}{onDelete && <th></th>}</tr></thead><tbody>{rows.map((row, i) => <tr key={row.id || i}>{columns.map((c) => <td key={c}>{String(row[c] ?? "")}</td>)}{onDelete && <td><button className="icon-btn" onClick={() => onDelete(row.id)}><Trash2 size={16} /></button></td>}</tr>)}</tbody></table>;
}

function Row({ label, value }) {
  return <div className="flex items-center justify-between rounded-xl bg-white/55 px-3 py-2 dark:bg-white/5"><span>{label}</span><strong>{value}</strong></div>;
}

function Skeleton() {
  return <div className="grid gap-4 md:grid-cols-3">{[1, 2, 3].map((i) => <div className="panel h-36 animate-pulse" key={i} />)}</div>;
}

const pages = {
  Dashboard,
  WhatsApp,
  Contacts,
  "AI Settings": () => <SettingsPage />,
  "Style Training": StyleTraining,
  Scheduler,
  "Morning Night": () => <SettingsPage mode="morning" />,
  "Chat Logs": Logs,
  "System Logs": SystemLogs,
  "API Settings": () => <SettingsPage mode="api" />,
  "Backup Restore": BackupRestore
};

function Root() {
  const { token, setToken } = useAuth();
  return token ? <AppShell onLogout={() => setToken("")} /> : <Login onLogin={setToken} />;
}

createRoot(document.getElementById("root")).render(<Root />);
