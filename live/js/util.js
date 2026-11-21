// Small shared helpers.

export const $ = s => document.querySelector(s);
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));
export const f1 = x => (x == null || isNaN(x) ? '–' : (Math.round(x * 10) / 10).toString());

const pad2 = n => String(n).padStart(2, '0');
export const dayStr = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
// Today's date on this phone (tests can pretend it's another day).
export function todayStr() {
  if (globalThis.__prlToday) return globalThis.__prlToday;
  return dayStr(new Date());
}
export const day10 = v => String(v || '').slice(0, 10);
export const isOn = e => !!e && !!e.start && e.start <= todayStr() && todayStr() <= (e.end || e.start);
export const isOver = e => !!e && !!(e.end || e.start) && (e.end || e.start) < todayStr();
export const isAhead = e => !!e && !!e.start && e.start > todayStr();

function localDate(s) {
  const m = String(s || '').match(/^(\d{4})-(\d\d)-(\d\d)/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
export function fmtDate(s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  const d = localDate(s);
  return d ? d.toLocaleDateString([], opts) : '';
}
export function fmtRange(e) {
  if (!e || !e.start) return 'date not posted';
  if (!e.end || e.end === e.start) return fmtDate(e.start);
  return `${fmtDate(e.start)} – ${fmtDate(e.end)}`;
}
export function daysUntil(s) {
  const d = localDate(s), t = localDate(todayStr());
  return d && t ? Math.round((d - t) / 864e5) : null;
}
export function fmtTime(v) {
  if (!v) return '';
  const str = String(v);
  if (/(Z|[+-]\d\d:?\d\d)$/.test(str) || typeof v === 'number') {
    const d = new Date(typeof v === 'number' ? v * 1000 : str);
    if (!isNaN(d)) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  const m = str.match(/T(\d\d):(\d\d)/);
  if (!m) return '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}
export function ago(t) {
  if (!t) return 'never';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
export function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export async function fetchT(url, opts = {}, ms = 20000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The request timed out.');
    throw e;
  } finally {
    clearTimeout(t);
  }
}

export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch (e) { out[idx] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

export function load(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}
export function save(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
}
