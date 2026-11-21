// Match videos from the team's own YouTube channel, matched to matches by title.
// Titles look like:  "FTC Team Stealth Meet 2 Match 11 FTC Nighthawks Meet 1 Match 11"
//                    "FTC Team Stealth Missouri Kansas State Tournament Playoff Match 9"
//                    "FRC Team Stealth Heartland Regional Qual 43"
// "Meet N" is that team's Nth league meet of the season. The match number is usually the event's match
// number, but sometimes it's the team's own Nth match, so both are tried (event number first).
import { fetchT, load, save } from './util.js';

const YT = 'https://www.googleapis.com/youtube/v3';
const CACHE = 'prl.videos';
const TTL = 3 * 60 * 60 * 1000;

export function channelUrl(cfg) {
  const ch = String((cfg.youtube && cfg.youtube.channel) || '').trim();
  if (!ch) return '';
  if (/^https?:/.test(ch)) return ch.replace(/\/$/, '');
  return `https://www.youtube.com/${ch.startsWith('@') || ch.startsWith('channel/') ? ch : '@' + ch}`;
}
// Without an API key: a YouTube search inside the channel.
export function searchUrl(cfg, query) {
  const base = channelUrl(cfg);
  return base ? `${base}/search?query=${encodeURIComponent(query)}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

export function cachedVideos() { return load(CACHE, null); }

// Every upload on the channel (cached for a few hours; one request per 50 videos).
export async function loadVideos(cfg, { force = false } = {}) {
  const key = cfg.youtube && cfg.youtube.apiKey;
  const ch = String((cfg.youtube && cfg.youtube.channel) || '').trim();
  if (!key || !ch) return null;
  const cur = cachedVideos();
  if (!force && cur && cur.channel === ch && Date.now() - cur.at < TTL) return cur;
  const q = /^UC[\w-]{20,}$/.test(ch) ? `id=${ch}` : `forHandle=${encodeURIComponent(ch.replace(/^https?:\/\/(www\.)?youtube\.com\//, '').replace(/^@?/, '@'))}`;
  const cj = await (await fetchT(`${YT}/channels?part=contentDetails&${q}&key=${encodeURIComponent(key)}`)).json();
  if (cj.error) throw new Error('YouTube: ' + (cj.error.message || 'request failed'));
  const uploads = cj.items && cj.items[0] && cj.items[0].contentDetails.relatedPlaylists.uploads;
  if (!uploads) throw new Error(`YouTube couldn't find the channel ${ch}.`);
  const list = [];
  let token = '';
  for (let page = 0; page < 40; page++) {
    const pj = await (await fetchT(`${YT}/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${uploads}&key=${encodeURIComponent(key)}${token ? '&pageToken=' + token : ''}`)).json();
    if (pj.error) throw new Error('YouTube: ' + (pj.error.message || 'request failed'));
    for (const it of pj.items || []) {
      const sn = it.snippet || {};
      const id = (it.contentDetails && it.contentDetails.videoId) || (sn.resourceId && sn.resourceId.videoId);
      if (id) list.push({ id, title: sn.title || '', date: String((it.contentDetails && it.contentDetails.videoPublishedAt) || sn.publishedAt || '').slice(0, 10) });
    }
    token = pj.nextPageToken;
    if (!token) break;
  }
  const out = { channel: ch, at: Date.now(), list };
  save(CACHE, out);
  return out;
}

// ---------------------------------------------------------------- reading titles

const norm = s => String(s || '').toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Split a title into one part per team: { program, number, meet, level, num, text }
export function parseTitle(title, teams) {
  const out = [];
  const parts = String(title || '').split(/(?=\b(?:FTC|FRC)\b)/i);
  for (const part of parts) {
    const m = part.match(/^\s*(FTC|FRC)\b\s*(.*)$/i);
    if (!m) continue;
    const program = m[1].toLowerCase();
    let rest = norm(m[2]);
    const cands = teams.filter(t => t.program === program)
      .flatMap(t => [...(t.videoNames || []), t.name, String(t.number)].filter(Boolean).map(a => ({ t, a: norm(a) })))
      .sort((x, y) => y.a.length - x.a.length);
    const hit = cands.find(c => c.a && (rest === c.a || rest.startsWith(c.a + ' ')));
    if (!hit) continue;
    rest = rest.slice(hit.a.length).trim();
    const meet = rest.match(/\bmeet (\d+)/);
    const playoff = /\b(playoff|playoffs|semi|semifinal|final|finals|elim|elimination)\b/.test(rest);
    const qual = /\b(qual|quals|qualification|qualifier)\b/.test(rest);
    const nums = [...rest.matchAll(/\b(?:match|qual|quals|qualification|playoff|playoffs|final|semifinal|q|m) (\d+)\b/g)];
    const n = nums.length ? Number(nums[nums.length - 1][1]) : null;
    const text = rest.replace(/\bmeet \d+\b/, ' ').replace(/\b(match|qual|quals|qualification|playoff|playoffs|final|finals|semifinal|semi|q|m) \d+\b/g, ' ').replace(/\s+/g, ' ').trim();
    out.push({ program, number: hit.t.number, meet: meet ? Number(meet[1]) : null, level: playoff ? 'playoff' : qual ? 'qual' : null, num: n, text });
  }
  return out;
}

// ---------------------------------------------------------------- matching to events and matches

const TYPE_WORDS = [[/\bworld/, ['worlds']], [/\bstate\b|\bchamp/, ['champ', 'dcmp']], [/\bleague tourn/, ['lt']], [/\bregional\b/, ['regional']], [/\bdistrict\b/, ['district', 'dcmp']], [/\bmeet\b/, ['meet']]];
const STOP = new Set(['ftc', 'frc', 'team', 'match', 'tournament', 'competition', 'event', 'the', 'and', 'of', 'championship', 'state', 'first', 'tech', 'challenge', 'robotics', 'league', 'meet', 'regional', 'worlds', 'world', 'qual', 'playoff']);
const dayNum = s => Math.floor((Date.parse(String(s).slice(0, 10) + 'T12:00:00Z') || 0) / 864e5);

// Which of the team's events a title part means (or null).
export function eventFor(part, events, videoDate) {
  const within = e => !videoDate || !e.start || (dayNum(videoDate) >= dayNum(e.start) - 1 && dayNum(videoDate) <= dayNum(e.end || e.start) + 150);
  if (part.meet) {
    const meets = events.filter(e => e.type === 'meet').sort((a, b) => String(a.start).localeCompare(String(b.start)));
    const ev = meets[part.meet - 1];
    return ev && within(ev) ? ev : null;
  }
  const words = part.text.split(' ').filter(w => w.length >= 4 && !STOP.has(w));
  let best = null, bestScore = 0;
  for (const e of events) {
    if (!within(e)) continue;
    let score = 0;
    for (const [re, types] of TYPE_WORDS) if (re.test(part.text) && types.includes(e.type)) score += 5;
    const name = norm(`${e.name} ${e.city || ''}`);
    for (const w of words) if (name.includes(w)) score += 1;
    if (score > bestScore || (score === bestScore && score > 0 && best && String(e.start) > String(best.start))) { best = e; bestScore = score; }
  }
  return bestScore > 0 ? best : null;
}

// Which match of that event a title part means: the event's match number first, then the team's own Nth match.
export function matchFor(part, team, matches) {
  if (!part.num) return null;
  const mine = matches.filter(m => m.red.includes(team) || m.blue.includes(team));
  const quals = mine.filter(m => m.level === 'qual'), offs = mine.filter(m => m.level === 'playoff');
  if (part.level === 'playoff') {
    const byNum = offs.find(m => m.series === part.num) || offs.find(m => !m.series && m.n === part.num);
    if (byNum) return { m: byNum, how: 'exact' };
    return offs[part.num - 1] ? { m: offs[part.num - 1], how: 'order' } : null;
  }
  const exact = quals.find(m => m.n === part.num);
  if (exact) return { m: exact, how: 'exact' };
  if (!part.level) { const p = offs.find(m => m.series === part.num); if (p) return { m: p, how: 'exact' }; }
  return quals[part.num - 1] ? { m: quals[part.num - 1], how: 'order' } : null;
}

// All of the channel's videos for one event, keyed by match id: { [matchId]: [{ id, title, team, how }] }
export function videosForEvent(videos, teamsCfg, summaries, event) {
  const out = {};
  if (!videos || !event) return out;
  for (const v of videos.list || []) {
    for (const part of parseTitle(v.title, teamsCfg)) {
      const sum = summaries[`${part.program}:${part.number}`];
      if (!sum || `${part.program}` !== event.program) continue;
      const ev = eventFor(part, sum.events || [], v.date);
      if (!ev || ev.key !== event.key) continue;
      const hit = matchFor(part, part.number, event.matches || []);
      if (!hit) continue;
      const list = out[hit.m.id] = out[hit.m.id] || [];
      if (!list.some(x => x.id === v.id)) list.push({ id: v.id, title: v.title, team: part.number, how: hit.how, source: 'ours' });
    }
  }
  return out;
}
