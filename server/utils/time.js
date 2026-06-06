import { config } from "../config.js";

export function nowInTimezone() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: config.timezone }));
}

export function isWithinQuietHours(settings) {
  if (settings.quiet_hours_enabled !== "true") return false;
  const now = nowInTimezone();
  const current = now.getHours() * 60 + now.getMinutes();
  const [startH, startM] = settings.quiet_hours_start.split(":").map(Number);
  const [endH, endM] = settings.quiet_hours_end.split(":").map(Number);
  const start = startH * 60 + startM;
  const end = endH * 60 + endM;
  return start <= end ? current >= start && current <= end : current >= start || current <= end;
}

export function randomDelaySeconds(min, max) {
  const lo = Number(min || 0);
  const hi = Number(max || lo);
  return Math.max(0, Math.floor(lo + Math.random() * (hi - lo + 1)));
}

export function nextRepeatDate(date, repeat) {
  const next = new Date(date);
  if (repeat === "daily") next.setDate(next.getDate() + 1);
  if (repeat === "weekly") next.setDate(next.getDate() + 7);
  if (repeat === "monthly") next.setMonth(next.getMonth() + 1);
  return next;
}
