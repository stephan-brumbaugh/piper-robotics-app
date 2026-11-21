// Settings, the followed teams, and the downloaded data (kept on the phone so it works offline).
import { load, save, isOn, isAhead, todayStr } from './util.js';
import { ftcTeam, ftcEvent } from './ftc.js';
import { frcTeam, frcEvent } from './frc.js';
import { loadVideos } from './videos.js';

// Built-in copy of Piper's settings, used until ../config.json has loaded once.
const FALLBACK = {
  name: 'Piper Robotics', liveTitle: 'Piper Robotics Live', scoutUrl: '',
  teams: [
    { program: 'ftc', number: 21536, name: 'Team Stealth', videoNames: ['Team Stealth'], color: '#7c3aed' },
    { program: 'ftc', number: 14213, name: 'Nighthawks', videoNames: ['Nighthawks'], color: '#0f9d8a' },
    { program: 'frc', number: 1802, name: 'Team Stealth', videoNames: ['Team Stealth'], color: '#e8590c' },
  ],
  streams: { ftc: 'https://www.twitch.tv/firstmoks', frc: '' },
  youtube: { channel: '@PiperRobotics', apiKey: '' },
  keys: { tba: '' },
  seasons: { ftc: null, frc: null },
};
export const PALETTE = ['#7c3aed', '#0f9d8a', '#e8590c', '#d6336c', '#5c940d', '#0b7285', '#a35200', '#c2255c'];

export const state = {
  cfg: load('prl.config', null) || FALLBACK,
  follow: load('prl.follow', null),        // ['ftc:21536', …] — null until the first-run picker is done
  extra: load('prl.extra', []),            // teams a parent added that aren't in config.json
  teams: load('prl.teams', {}),            // 'ftc:21536' -> team summary
  events: load('prl.events', {}),          // 'ftc:USMOKSWM2' -> event detail
  videos: load('prl.videos', null),
  errors: {},
  busy: false,
};

export async function loadConfig() {
  try {
    const res = await fetch('../config.json', { cache: 'no-cache' });
    if (res.ok) {
      const c = await res.json();
      state.cfg = { ...FALLBACK, ...c, youtube: { ...FALLBACK.youtube, ...(c.youtube || {}) }, keys: { ...FALLBACK.keys, ...(c.keys || {}) }, streams: { ...FALLBACK.streams, ...(c.streams || {}) }, seasons: { ...FALLBACK.seasons, ...(c.seasons || {}) } };
      save('prl.config', state.cfg);
    }
  } catch (e) { /* offline: keep the saved copy */ }
  return state.cfg;
}

export const tkey = (program, number) => `${program}:${Number(number)}`;
const sameTeam = (a, b) => a.program === b.program && Number(a.number) === Number(b.number);

// Every team the app knows how to show (config teams first, then ones a parent added).
export function allTeams() {
  const out = state.cfg.teams.map(t => ({ ...t, program: t.program.toLowerCase(), number: Number(t.number) }));
  for (const x of state.extra) if (!out.some(t => sameTeam(t, x))) out.push({ ...x });
  out.forEach((t, i) => { t.key = tkey(t.program, t.number); t.color = t.color || PALETTE[i % PALETTE.length]; });
  return out;
}
export function followed() {
  const all = allTeams();
  return (state.follow || []).map(k => all.find(t => t.key === k)).filter(Boolean);
}
export function teamLabel(t) {
  const s = state.teams[t.key];
  return `${t.program.toUpperCase()} ${t.number}${t.name || (s && s.name) ? ' ' + (t.name || s.name) : ''}`;
}
export function setFollow(keys) { state.follow = keys; save('prl.follow', keys); }
export function addExtra(program, number) {
  if (!state.extra.some(t => sameTeam(t, { program, number }))) state.extra.push({ program, number: Number(number), name: '', videoNames: [] });
  save('prl.extra', state.extra);
}

// ---------------------------------------------------------------- downloading

const TEAM_TTL = 15 * 60 * 1000;
const LIVE_TTL = 60 * 1000;
const EVENT_TTL = 10 * 60 * 1000;

export async function refreshTeams({ force = false } = {}) {
  const list = followed();
  await Promise.all(list.map(async t => {
    const cur = state.teams[t.key];
    if (!force && cur && Date.now() - cur.at < TEAM_TTL) return;
    try {
      state.teams[t.key] = t.program === 'frc' ? await frcTeam(t.number, state.cfg) : await ftcTeam(t.number, state.cfg);
      delete state.errors[t.key];
    } catch (e) { state.errors[t.key] = e.message || String(e); }
  }));
  save('prl.teams', state.teams);
}

export async function refreshEvent(key, { force = false } = {}) {
  const cur = state.events[key];
  const live = activeEvents().some(e => e.key === key);
  if (!force && cur && Date.now() - cur.at < (live ? LIVE_TTL : EVENT_TTL)) return cur;
  const [program, code] = key.split(':');
  try {
    state.events[key] = program === 'frc' ? await frcEvent(code, state.cfg) : await ftcEvent(code, state.cfg);
    delete state.errors[key];
  } catch (e) { state.errors[key] = e.message || String(e); }
  // keep the saved copy small: only events our teams play in
  const keep = new Set(followed().flatMap(t => ((state.teams[t.key] || {}).events || []).map(e => e.key)));
  for (const k of Object.keys(state.events)) if (!keep.has(k) && k !== key) delete state.events[k];
  save('prl.events', state.events);
  return state.events[key];
}

export async function refreshVideos({ force = false } = {}) {
  try {
    const v = await loadVideos(state.cfg, { force });
    if (v) state.videos = v;
    delete state.errors.videos;
  } catch (e) { state.errors.videos = e.message || String(e); }
}

// ---------------------------------------------------------------- what's happening

// Events happening today for any followed team: [{ key, ev (from the team list), teams: [team cfg] }]
export function activeEvents() {
  const out = new Map();
  for (const t of followed()) {
    for (const e of ((state.teams[t.key] || {}).events || [])) {
      if (!(isOn(e) || (e.ongoing && !e.finished))) continue;
      if (!out.has(e.key)) out.set(e.key, { key: e.key, ev: e, teams: [] });
      out.get(e.key).teams.push(t);
    }
  }
  return [...out.values()];
}

// The next event for each followed team, soonest first.
export function upcoming() {
  const out = [];
  for (const t of followed()) {
    const e = ((state.teams[t.key] || {}).events || []).find(isAhead);
    if (e) out.push({ team: t, ev: e });
  }
  return out.sort((a, b) => String(a.ev.start).localeCompare(String(b.ev.start)));
}

export function teamsAt(eventKey) {
  return followed().filter(t => ((state.teams[t.key] || {}).events || []).some(e => e.key === eventKey));
}

export { todayStr };
