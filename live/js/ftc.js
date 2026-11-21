// FTC data from FTCScout (public, no key). Every function returns the same shapes as frc.js:
//   team summary: { program, number, name, city, season, events: [Event], record, league, world, region, at }
//   Event: { key, code, name, start, end, type, typeLabel, city, region, stats: { rank, w, l, t, of }, status, awards: [string], stream }
//   event detail: { key, code, name, start, end, city, venue, stream, matches: [Match], rankings: { team: { rank, w, l, t } }, count, at }
//   Match: { id, level: 'qual'|'playoff', n, series, label, time, played, rs, bs, red: [team], blue: [team], videos: [] }
import { fetchT, pool, num, day10, todayStr } from './util.js';

const GQL = 'https://api.ftcscout.org/graphql';
const REST = 'https://api.ftcscout.org/rest/v1';

export function ftcSeason(cfg) {
  const o = cfg && cfg.seasons && Number(cfg.seasons.ftc);
  if (o) return o;
  const d = new Date(todayStr() + 'T12:00:00');
  return d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1; // the 2026 season runs Sept 2026 – Apr 2027
}

class SchemaError extends Error {}

async function gql(query, variables) {
  const res = await fetchT(GQL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  if (!res.ok && res.status !== 400) throw new Error('FTCScout returned HTTP ' + res.status);
  const j = await res.json();
  if (j.errors && j.errors.length) throw new SchemaError(j.errors[0].message || 'FTCScout query error');
  return j.data;
}
// Try richer queries first; fall back when FTCScout doesn't know a field. Network errors stop right away.
async function gqlFirst(queries, variables) {
  let last;
  for (const q of queries) {
    try { return { data: await gql(q, variables), level: queries.indexOf(q) }; } catch (e) {
      if (!(e instanceof SchemaError)) throw e;
      last = e;
    }
  }
  throw last;
}
async function rest(path) {
  const res = await fetchT(REST + path);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('FTCScout returned HTTP ' + res.status);
  return res.json();
}

const stat = s => `... on TeamEventStats${s} { rank wins losses ties }`;
const TEAM_Q = s => [
  `query T($n:Int!,$s:Int!){teamByNumber(number:$n){number name location{city state country}
    quickStats(season:$s){tot{value rank} auto{value rank} dc{value rank} eg{value rank} count}
    events(season:$s){eventCode event{code name start end type ongoing finished regionCode leagueCode location{city state country}}
      stats{${stat(s)}} awards{type placement divisionName}}}}`,
  `query T($n:Int!,$s:Int!){teamByNumber(number:$n){number name
    quickStats(season:$s){tot{value rank} auto{value rank} dc{value rank} eg{value rank} count}
    events(season:$s){eventCode event{code name start end type} stats{${stat(s)}}}}}`,
  `query T($n:Int!,$s:Int!){teamByNumber(number:$n){name events(season:$s){eventCode event{name start}}}}`,
];

export function ftcType(t) {
  t = String(t || '');
  if (/first\s*championship/i.test(t)) return 'worlds';
  if (/league\s*tournament/i.test(t)) return 'lt';
  if (/league\s*meet/i.test(t)) return 'meet';
  if (/championship/i.test(t)) return 'champ';
  if (/qualifier/i.test(t)) return 'qual';
  return 'other';
}
const TYPE_LABEL = { meet: 'League meet', lt: 'League tournament', champ: 'Championship', worlds: 'FIRST Championship', qual: 'Qualifier', other: 'Event' };

const AWARD = { Winner: 'Winning Alliance', Finalist: 'Finalist Alliance', TopRanked: 'Top Ranked Team', DeansListFinalist: "Dean's List Finalist",
  DeansListSemiFinalist: "Dean's List Semi-Finalist", DeansListWinner: "Dean's List Winner", JudgesChoice: "Judges' Choice Award" };
export function awardLabel(a) {
  const type = String(a.type || '');
  let s = AWARD[type] || `${type.replace(/([a-z])([A-Z])/g, '$1 $2')} Award`;
  const p = Number(a.placement);
  if (p > 1 && !/Alliance|Dean/.test(s)) s += ` (${p === 2 ? '2nd' : p === 3 ? '3rd' : p + 'th'} place)`;
  if (a.divisionName) s += ` · ${a.divisionName}`;
  return s;
}

function normEvent(code, ev, st, awards) {
  ev = ev || {};
  const loc = ev.location || {};
  const type = ftcType(ev.type);
  return {
    key: 'ftc:' + String(code).toUpperCase(), code: String(code).toUpperCase(), name: ev.name || code,
    start: day10(ev.start), end: day10(ev.end || ev.start), type, typeLabel: TYPE_LABEL[type],
    city: [loc.city, loc.state].filter(Boolean).join(', '), region: ev.regionCode || '', league: ev.leagueCode || '',
    ongoing: ev.ongoing === true, finished: ev.finished === true,
    stats: st && num(st.rank) ? { rank: num(st.rank), w: num(st.wins) || 0, l: num(st.losses) || 0, t: num(st.ties) || 0 } : null,
    awards: (awards || []).map(awardLabel),
  };
}

// Everything about one team's season.
export async function ftcTeam(n, cfg) {
  const s = ftcSeason(cfg);
  const { data, level } = await gqlFirst(TEAM_Q(s), { n: Number(n), s });
  const t = data && data.teamByNumber;
  if (!t) throw new Error(`FTC team ${n} isn't on FTCScout.`);
  let events = (t.events || []).map(e => normEvent(e.eventCode, e.event, e.stats, e.awards));
  let qs = t.quickStats || null;
  if (level === 2) {
    // oldest schema: fill in records, ranks and event details from the REST API
    const [parts, q] = await Promise.all([rest(`/teams/${n}/events/${s}`).catch(() => null), rest(`/teams/${n}/quick-stats?season=${s}`).catch(() => null)]);
    qs = q;
    const infos = await pool(events, 4, e => rest(`/events/${s}/${e.code}`));
    events = events.map((e, i) => {
      const p = (parts || []).find(x => String(x.eventCode).toUpperCase() === e.code);
      return normEvent(e.code, { ...(infos[i] || {}), name: (infos[i] && infos[i].name) || e.name, start: (infos[i] && infos[i].start) || e.start }, p && p.stats, []);
    });
  }
  events.sort((a, b) => String(a.start).localeCompare(String(b.start)));
  const record = { w: 0, l: 0, t: 0 };
  for (const e of events) if (e.stats) { record.w += e.stats.w; record.l += e.stats.l; record.t += e.stats.t; }
  const q = k => (qs && qs[k] && typeof qs[k] === 'object' ? { value: num(qs[k].value), rank: num(qs[k].rank) } : null);
  const world = qs && q('tot') ? { tot: q('tot'), auto: q('auto'), dc: q('dc'), eg: q('eg'), count: num(qs.count) } : null;
  const loc = t.location || {};
  const sum = {
    program: 'ftc', number: Number(n), name: t.name || '', city: [loc.city, loc.state].filter(Boolean).join(', '), season: s,
    events, record, world, league: null, region: null, at: Date.now(),
  };
  // where the team's league stands, and its rank in its home region (both optional extras)
  const [league, region] = await Promise.all([leagueStanding(Number(n), s, events).catch(() => null), regionRank(Number(n), s, events).catch(() => null)]);
  sum.league = league;
  sum.region = region;
  return sum;
}

async function leagueStanding(n, s, events) {
  const leagueEvents = events.filter(e => e.type === 'meet' || e.type === 'lt');
  const started = leagueEvents.filter(e => e.start && e.start <= todayStr());
  const ev = started.pop() || leagueEvents[0];
  if (!ev) return null;
  const d = await gql(`query L($s:Int!,$c:String!){eventByCode(season:$s,code:$c){leagueRankings{league{code name} teams{teamNumber avgRp stats{${stat(s)}}}}}}`, { s, c: ev.code });
  let lr = d && d.eventByCode && d.eventByCode.leagueRankings;
  if (Array.isArray(lr)) lr = lr[0];
  if (!lr || !lr.teams || !lr.teams.length) return null;
  const rows = lr.teams.slice().sort((a, b) => ((a.stats && a.stats.rank) || 999) - ((b.stats && b.stats.rank) || 999));
  const i = rows.findIndex(x => Number(x.teamNumber) === n);
  if (i < 0) return null;
  const me = rows[i];
  const st = me.stats || {};
  return { code: (lr.league && lr.league.code) || ev.league, name: (lr.league && lr.league.name) || 'League', rank: num(st.rank) || i + 1, count: rows.length,
    w: num(st.wins), l: num(st.losses), t: num(st.ties), avgRp: num(me.avgRp) };
}

async function regionRank(n, s, events) {
  const counts = {};
  for (const e of events) if (e.region && e.type !== 'worlds') counts[e.region] = (counts[e.region] || 0) + 1;
  const region = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  if (!region) return null;
  const d = await gql(`query R($n:Int!,$s:Int!,$r:RegionOption){teamByNumber(number:$n){quickStats(season:$s,region:$r){tot{value rank} count}}}`, { n, s, r: region });
  const q = d && d.teamByNumber && d.teamByNumber.quickStats;
  if (!q || !q.tot || !num(q.tot.rank)) return null;
  return { code: region, rank: num(q.tot.rank), count: num(q.count) };
}

const scoreFrag = s => `scores{... on MatchScores${s}{red{totalPoints} blue{totalPoints}}}`;
const EVENT_Q = s => [
  `query E($s:Int!,$c:String!){eventByCode(season:$s,code:$c){code name start end type ongoing finished liveStreamURL website location{venue city state country}
    teams{teamNumber team{name} stats{${stat(s)}}}
    matches{matchNum series tournamentLevel description hasBeenPlayed scheduledStartTime actualStartTime ${scoreFrag(s)} teams{teamNumber alliance station}}}}`,
  `query E($s:Int!,$c:String!){eventByCode(season:$s,code:$c){code name start end type
    teams{teamNumber team{name} stats{${stat(s)}}}
    matches{matchNum series tournamentLevel hasBeenPlayed scheduledStartTime actualStartTime ${scoreFrag(s)} teams{teamNumber alliance station}}}}`,
  `query E($s:Int!,$c:String!){eventByCode(season:$s,code:$c){code name start teams{teamNumber team{name}} matches{matchNum tournamentLevel teams{teamNumber alliance station}}}}`,
];

const stationNum = st => { const m = String(st ?? '').match(/(\d)|one|two|three/i); return !m ? 9 : m[1] ? Number(m[1]) : ({ one: 1, two: 2, three: 3 }[m[0].toLowerCase()] || 9); };
const isRed = a => /red/i.test(String(a || ''));
const total = side => (side == null ? null : typeof side === 'number' ? side : num(side.totalPoints ?? side.total));

function normMatch(m) {
  const qual = /qual/i.test(String(m.tournamentLevel || 'Quals'));
  const teams = (m.teams || []).slice().sort((a, b) => stationNum(a.station) - stationNum(b.station));
  const n = num(m.matchNum ?? m.matchNumber) || 0, series = num(m.series) || 0;
  const sc = m.scores || {};
  const rs = total(sc.red ?? sc.redScore), bs = total(sc.blue ?? sc.blueScore);
  const played = m.hasBeenPlayed !== false && rs !== null && bs !== null;
  const label = qual ? `Q${n}` : /final/i.test(String(m.tournamentLevel)) ? `Final ${n || 1}` : `Playoff ${series || n}${series && n > 1 ? `-${n}` : ''}`;
  return {
    id: `${qual ? 'q' : 'p'}${series}-${n}`, level: qual ? 'qual' : 'playoff', n, series, label: qual ? label : (m.description && /\d/.test(m.description) ? m.description : label),
    final: /final/i.test(String(m.tournamentLevel)), time: m.actualStartTime || m.scheduledStartTime || null, scheduled: m.scheduledStartTime || null,
    played, rs: played ? rs : null, bs: played ? bs : null,
    red: teams.filter(t => isRed(t.alliance)).map(t => Number(t.teamNumber)).filter(Boolean),
    blue: teams.filter(t => t.alliance && !isRed(t.alliance)).map(t => Number(t.teamNumber)).filter(Boolean),
    videos: [],
  };
}

export function sortMatches(list) {
  return list.sort((a, b) => (a.level === b.level ? 0 : a.level === 'qual' ? -1 : 1)
    || (a.level === 'qual' ? a.n - b.n : (a.final - b.final) || String(a.time || '').localeCompare(String(b.time || '')) || a.series - b.series || a.n - b.n));
}

// One event's schedule, results, rankings and stream link.
export async function ftcEvent(code, cfg) {
  const s = ftcSeason(cfg);
  code = String(code).toUpperCase();
  const { data, level } = await gqlFirst(EVENT_Q(s), { s, c: code });
  const e = data && data.eventByCode;
  if (!e) throw new Error(`Event ${code} isn't on FTCScout.`);
  let matches = (e.matches || []).map(normMatch);
  const rankings = {};
  for (const t of e.teams || []) {
    const st = t.stats || {};
    if (num(st.rank)) rankings[t.teamNumber] = { rank: num(st.rank), w: num(st.wins) || 0, l: num(st.losses) || 0, t: num(st.ties) || 0 };
  }
  let info = e;
  if (level === 2) {
    const [ml, tl, inf] = await Promise.all([rest(`/events/${s}/${code}/matches`).catch(() => null), rest(`/events/${s}/${code}/teams`).catch(() => null), rest(`/events/${s}/${code}`).catch(() => null)]);
    if (ml) matches = ml.map(normMatch);
    for (const p of tl || []) { const st = p.stats || {}; if (num(st.rank)) rankings[p.teamNumber] = { rank: num(st.rank), w: num(st.wins) || 0, l: num(st.losses) || 0, t: num(st.ties) || 0 }; }
    info = { ...e, ...(inf || {}) };
  }
  const names = {};
  for (const t of e.teams || []) if (t.team && t.team.name) names[t.teamNumber] = t.team.name;
  const loc = info.location || {};
  return {
    key: 'ftc:' + code, program: 'ftc', code, name: info.name || code, start: day10(info.start), end: day10(info.end || info.start),
    type: ftcType(info.type), city: [loc.city, loc.state].filter(Boolean).join(', '), venue: loc.venue || '',
    stream: info.liveStreamURL || '', website: info.website || '',
    matches: sortMatches(matches.filter(m => m.red.length || m.blue.length)), rankings, names, count: (e.teams || []).length, at: Date.now(),
  };
}
