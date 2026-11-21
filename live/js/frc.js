// FRC data from The Blue Alliance (needs a free read key in config.json). Same shapes as ftc.js.
import { fetchT, num, todayStr } from './util.js';
import { sortMatches } from './ftc.js';

const TBA = 'https://www.thebluealliance.com/api/v3';

export function frcSeason(cfg) {
  const o = cfg && cfg.seasons && Number(cfg.seasons.frc);
  return o || Number(todayStr().slice(0, 4));
}

async function tba(path, cfg) {
  const key = cfg && cfg.keys && cfg.keys.tba;
  if (!key) throw new Error('FRC results need a Blue Alliance read key on the setup page.');
  const res = await fetchT(TBA + path, { headers: { 'X-TBA-Auth-Key': key } });
  if (res.status === 404) return null;
  if (res.status === 401) throw new Error('The Blue Alliance rejected the read key. Check it on the setup page.');
  if (!res.ok) throw new Error('The Blue Alliance returned HTTP ' + res.status);
  return res.json();
}

const TYPES = { 0: 'regional', 1: 'district', 2: 'dcmp', 3: 'worlds', 4: 'worlds', 5: 'dcmp', 6: 'other', 99: 'other', 100: 'other' };
const TYPE_LABEL = { regional: 'Regional', district: 'District event', dcmp: 'District championship', worlds: 'FIRST Championship', other: 'Event' };
const strip = s => String(s || '').replace(/<[^>]+>/g, '');

export function webcastUrl(w) {
  if (!w) return '';
  if (w.type === 'twitch') return `https://www.twitch.tv/${w.channel}`;
  if (w.type === 'youtube') return `https://www.youtube.com/watch?v=${w.channel}`;
  if (w.type === 'direct_link' || w.type === 'iframe') return /^https?:/.test(w.channel) ? w.channel : '';
  return '';
}

function normEvent(e, st, awards) {
  const type = TYPES[e.event_type] || 'other';
  const q = st && st.qual && st.qual.ranking;
  const rec = (q && q.record) || {};
  const pr = (st && st.playoff && st.playoff.record) || {};
  return {
    key: 'frc:' + e.key, code: e.key, name: e.short_name ? `${e.short_name} ${type === 'regional' ? 'Regional' : ''}`.trim() : e.name,
    start: e.start_date || '', end: e.end_date || e.start_date || '', type, typeLabel: TYPE_LABEL[type],
    city: [e.city, e.state_prov].filter(Boolean).join(', '),
    stats: q ? { rank: num(q.rank), w: (num(rec.wins) || 0) + (num(pr.wins) || 0), l: (num(rec.losses) || 0) + (num(pr.losses) || 0), t: (num(rec.ties) || 0) + (num(pr.ties) || 0), of: num(st.qual.num_teams) } : null,
    status: st ? strip(st.overall_status_str) : '',
    awards: (awards || []).filter(a => a.event_key === e.key).map(a => a.name),
    stream: webcastUrl((e.webcasts || [])[0]),
  };
}

export async function frcTeam(n, cfg) {
  const y = frcSeason(cfg);
  const k = 'frc' + Number(n);
  const [team, evs, st, aw] = await Promise.all([
    tba(`/team/${k}/simple`, cfg), tba(`/team/${k}/events/${y}`, cfg), tba(`/team/${k}/events/${y}/statuses`, cfg), tba(`/team/${k}/awards/${y}`, cfg),
  ]);
  if (!team) throw new Error(`FRC team ${n} isn't on The Blue Alliance.`);
  let events = (evs || []).map(e => normEvent(e, (st || {})[e.key], aw));
  // next season's events are listed months ahead; show them as upcoming
  if (Number(todayStr().slice(5, 7)) >= 8) {
    const next = await tba(`/team/${k}/events/${y + 1}`, cfg).catch(() => null);
    events = events.concat((next || []).map(e => normEvent(e, null, [])));
  }
  events.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const record = { w: 0, l: 0, t: 0 };
  for (const e of events) if (e.stats) { record.w += e.stats.w; record.l += e.stats.l; record.t += e.stats.t; }
  return {
    program: 'frc', number: Number(n), name: team.nickname || '', city: [team.city, team.state_prov].filter(Boolean).join(', '), season: y,
    events, record, world: null, league: null, region: null, at: Date.now(),
  };
}

const LEVEL = { qm: 'qual', ef: 'playoff', qf: 'playoff', sf: 'playoff', f: 'playoff' };
function normMatch(m) {
  const level = LEVEL[m.comp_level] || 'playoff';
  const red = ((m.alliances && m.alliances.red) || {}), blue = ((m.alliances && m.alliances.blue) || {});
  const rs = num(red.score), bs = num(blue.score);
  const played = rs !== null && bs !== null && rs >= 0 && bs >= 0;
  const t = m.actual_time || m.predicted_time || m.time;
  const label = level === 'qual' ? `Q${m.match_number}` : m.comp_level === 'f' ? `Final ${m.match_number}` : `Playoff ${m.set_number}${m.match_number > 1 ? '-' + m.match_number : ''}`;
  return {
    id: m.key, level, n: num(m.match_number) || 0, series: level === 'qual' ? 0 : num(m.set_number) || 0, label, final: m.comp_level === 'f',
    time: t ? new Date(t * 1000).toISOString() : null, played, rs: played ? rs : null, bs: played ? bs : null,
    red: (red.team_keys || []).map(x => Number(String(x).replace('frc', ''))), blue: (blue.team_keys || []).map(x => Number(String(x).replace('frc', ''))),
    videos: (m.videos || []).filter(v => v.type === 'youtube' && v.key).map(v => ({ id: v.key, title: 'Match video', source: 'FIRST' })),
  };
}

export async function frcEvent(key, cfg) {
  const [e, ms, rk, tl] = await Promise.all([tba(`/event/${key}`, cfg), tba(`/event/${key}/matches`, cfg), tba(`/event/${key}/rankings`, cfg).catch(() => null), tba(`/event/${key}/teams/simple`, cfg).catch(() => null)]);
  if (!e) throw new Error(`FRC event ${key} isn't on The Blue Alliance.`);
  const rankings = {};
  for (const r of (rk && rk.rankings) || []) {
    const rec = r.record || {};
    rankings[Number(String(r.team_key).replace('frc', ''))] = { rank: num(r.rank), w: num(rec.wins) || 0, l: num(rec.losses) || 0, t: num(rec.ties) || 0 };
  }
  const names = {};
  for (const t of tl || []) names[t.team_number] = t.nickname || '';
  return {
    key: 'frc:' + e.key, program: 'frc', code: e.key, name: e.name, start: e.start_date, end: e.end_date || e.start_date,
    type: TYPES[e.event_type] || 'other', city: [e.city, e.state_prov].filter(Boolean).join(', '), venue: e.location_name || '',
    stream: webcastUrl((e.webcasts || [])[0]), website: e.website || '',
    matches: sortMatches((ms || []).map(normMatch)), rankings, names, count: (tl || []).length, at: Date.now(),
  };
}
