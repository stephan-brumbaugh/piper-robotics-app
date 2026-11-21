// Piper Robotics Live: public schedules, results, rankings, streams and videos for the teams a family follows.
import { $, esc, f1, ago, fmtDate, fmtRange, fmtTime, daysUntil, isOn, isOver, isAhead, todayStr } from './util.js';
import { state, loadConfig, allTeams, followed, teamLabel, setFollow, addExtra, refreshTeams, refreshEvent, refreshVideos,
  activeEvents, upcoming, teamsAt } from './data.js';
import { videosForEvent, searchUrl, channelUrl } from './videos.js';
import { downloadIcs, googleCalUrl } from './calendar.js';
import { regionName } from './regions.js';
import { ftcSeason } from './ftc.js';

export const APP_VERSION = '1.0.0'; // keep in step with VERSION in sw.js

const ui = {
  view: 'home', eventKey: '', expanded: {}, hideDone: false, embed: {}, pickSel: null, busy: false, renderTimer: null,
};

// ---------------------------------------------------------------- small pieces

const S = () => state.cfg;
const evUrl = ev => (ev.key.startsWith('frc:') ? `https://www.thebluealliance.com/event/${ev.code || ev.key.split(':')[1]}` : `https://ftcscout.org/events/${ftcSeason(state.cfg)}/${ev.code || ev.key.split(':')[1]}`);
const appUrl = () => location.href.split('#')[0];
const twitchChannel = url => { const m = String(url || '').match(/twitch\.tv\/([\w]+)/i); return m ? m[1] : ''; };

function streamFor(ev, detail) {
  const program = ev.key.split(':')[0];
  return (detail && detail.stream) || ev.stream || (S().streams && S().streams[program]) || '';
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast';
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.className = 'toast hidden'; }, 2600);
}

function calendarButtons(ev, teams) {
  return `<button data-act="ics" data-key="${esc(ev.key)}">Add to calendar</button>
    <a class="btn ghost" href="${esc(googleCalUrl(ev, teams.map(t => t.name || t.number), appUrl()))}" target="_blank" rel="noopener">Google Calendar</a>`;
}

function streamButtons(ev, detail, { live = false } = {}) {
  const url = streamFor(ev, detail);
  if (!url) return '';
  const ch = twitchChannel(url);
  if (live) {
    return `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">▶ Watch live${ch ? ' on Twitch' : ''}</a>
      ${ch ? `<button data-act="embed" data-key="${esc(ev.key)}">${ui.embed[ev.key] ? 'Close player' : 'Play here'}</button>` : ''}`;
  }
  if (!isOver(ev)) return `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Where to watch${ch ? ' (Twitch)' : ''}</a>`;
  return ch ? `<a class="btn" href="https://www.twitch.tv/${esc(ch)}/videos?filter=archives" target="_blank" rel="noopener">Past broadcasts on Twitch</a>` : '';
}

// ---------------------------------------------------------------- render

function render() {
  clearTimeout(ui.renderTimer);
  document.title = S().liveTitle || 'Robotics Live';
  $('#brandName').textContent = S().liveTitle || 'Robotics Live';
  const y = window.scrollY;
  $('#view').innerHTML = !state.follow || ui.pickSel ? pickerView() : ui.view === 'event' ? eventPage(ui.eventKey) : home();
  window.scrollTo(0, ui.keepScroll === false ? 0 : y);
  ui.keepScroll = true;
  renderHeader();
}
function renderSoon(ms = 300) { clearTimeout(ui.renderTimer); ui.renderTimer = setTimeout(render, ms); }
function renderHeader() {
  const on = navigator.onLine !== false;
  $('#hdrNet').textContent = on ? (ui.busy ? 'Updating…' : 'Online') : 'Offline';
  $('#hdrNet').className = 'net ' + (on ? 'on' : 'off');
}

// ---------------------------------------------------------------- choose teams

function pickerView() {
  const first = !state.follow;
  const sel = ui.pickSel || new Set(state.follow || []);
  const all = allTeams();
  return `<section class="card picker">
    <h2>${first ? `Welcome to ${esc(S().liveTitle)}` : 'Teams you follow'}</h2>
    <p>${first ? 'Which teams do you want to follow? Pick one or more. You can change this any time.' : 'Tap to follow or stop following.'}</p>
    <div class="pickgrid">${all.map(t => `<button class="pickteam ${sel.has(t.key) ? 'on' : ''}" style="--tc:${t.color}" data-act="toggleFollow" data-key="${esc(t.key)}">
        <i></i><span><b>${t.program.toUpperCase()} ${t.number}</b><small>${esc(t.name || (state.teams[t.key] || {}).name || '')}</small></span><em>${sel.has(t.key) ? '✓' : ''}</em></button>`).join('')}</div>
    <details class="addteam"><summary>Follow another team</summary>
      <div class="row"><select id="addProg"><option value="ftc">FTC</option><option value="frc">FRC</option></select>
        <input id="addNum" inputmode="numeric" placeholder="Team number" autocomplete="off"><button data-act="addTeam">Add</button></div>
    </details>
    <div class="btnrow"><button class="primary big" data-act="pickDone" ${sel.size ? '' : 'disabled'}>${first ? 'Continue' : 'Done'}</button>
      ${first ? '' : '<button class="ghost" data-act="pickCancel">Cancel</button>'}</div>
  </section>`;
}

// ---------------------------------------------------------------- home

function home() {
  const list = followed();
  const act = activeEvents();
  return `
  <section class="card followbar">
    <div class="chips">${list.map(t => `<span class="chip wchip" style="--tc:${t.color}"><i class="dot"></i>${esc(teamLabel(t))}</span>`).join('')}</div>
    <button class="ghost" data-act="pick">Change teams</button>
  </section>
  ${act.length ? act.map(liveCard).join('') : noEventCard()}
  <h2 class="section">How ${list.length > 1 ? 'our teams are' : 'the team is'} doing</h2>
  ${list.map(teamCard).join('')}
  ${footer()}`;
}

function footer() {
  const sources = [...new Set(followed().map(t => (t.program === 'frc' ? 'The Blue Alliance' : 'FTCScout')))];
  const at = Math.max(0, ...followed().map(t => (state.teams[t.key] || {}).at || 0));
  return `<footer class="muted small">
    <p>Updated ${esc(ago(at))} · <button class="linkbtn" data-act="refresh">Update now</button></p>
    <p>Results from ${esc(sources.join(' and ') || 'FTCScout')}, which copy FIRST's official results. Public information only.${S().youtube && S().youtube.channel ? ` Videos from <a href="${esc(channelUrl(S()))}" target="_blank" rel="noopener">our YouTube channel</a>.` : ''}</p>
    <p>Version ${APP_VERSION}</p>
  </footer>`;
}

function noEventCard() {
  const up = upcoming();
  const loading = followed().some(t => !state.teams[t.key]) && !Object.keys(state.errors).length;
  if (loading) return `<section class="card"><p class="busy">Loading the latest results…</p></section>`;
  return `<section class="card nextup">
    <h2>No events today</h2>
    ${up.length ? `<p class="muted small">Coming up:</p>${groupByEvent(up).map(({ ev, teams }) => {
      const d = daysUntil(ev.start);
      return `<div class="nextev" data-act="openEvent" data-key="${esc(ev.key)}">
        <div><b>${esc(ev.name)}</b> <span class="muted small">${esc(ev.typeLabel || '')}</span></div>
        <div class="small">${esc(fmtRange(ev))}${d != null ? ` · ${d === 1 ? 'tomorrow' : `in ${d} days`}` : ''}${ev.city ? ' · ' + esc(ev.city) : ''}</div>
        <div class="small">${teams.map(t => `<span class="tagteam" style="--tc:${t.color}"><i></i>${esc(t.name || t.number)}</span>`).join(' ')}</div>
      </div>
      <div class="btnrow">${calendarButtons(ev, teams)}${streamButtons(ev, null)}</div>`;
    }).join('')}` : '<p class="muted">No upcoming events are posted yet.</p>'}
  </section>`;
}

function groupByEvent(items) {
  const m = new Map();
  for (const { team, ev } of items) {
    if (!m.has(ev.key)) m.set(ev.key, { ev, teams: [] });
    m.get(ev.key).teams.push(team);
  }
  return [...m.values()];
}

// ---------------------------------------------------------------- live event

function liveCard(a) {
  const detail = state.events[a.key];
  const ev = detail ? { ...a.ev, ...detail, typeLabel: a.ev.typeLabel } : a.ev;
  const ch = twitchChannel(streamFor(a.ev, detail));
  return `<section class="card live">
    <div class="livehead"><span class="pill livepill">● Today</span> <span class="muted small">${esc(a.ev.typeLabel || '')}${ev.city ? ' · ' + esc(ev.city) : ''}</span></div>
    <h2 class="evtitle" data-act="openEvent" data-key="${esc(a.key)}">${esc(ev.name)}</h2>
    <div class="btnrow">${streamButtons(a.ev, detail, { live: true })}</div>
    ${ui.embed[a.key] && ch ? `<div class="player"><iframe src="https://player.twitch.tv/?channel=${esc(ch)}&parent=${esc(location.hostname)}&muted=true" allowfullscreen title="Live stream"></iframe></div>` : ''}
    ${scheduleBlock(a.key, a.teams)}
  </section>`;
}

// Schedule, results, rank and videos at one event for the followed teams there.
function scheduleBlock(key, teams) {
  const d = state.events[key];
  const err = state.errors[key];
  if (!d) return err ? `<p class="banner warn">${esc(err)}</p>` : '<p class="busy">Loading the schedule…</p>';
  const W = new Map(teams.map(t => [t.number, t]));
  const mine = m => [...m.red, ...m.blue].filter(n => W.has(n));
  const rows = d.matches.filter(m => mine(m).length);
  const side = (m, n) => (m.red.includes(n) ? 'R' : m.blue.includes(n) ? 'B' : '');
  const pos = (m, n) => (m.red.includes(n) ? `Red ${m.red.indexOf(n) + 1}` : m.blue.includes(n) ? `Blue ${m.blue.indexOf(n) + 1}` : '');
  const result = (m, n) => {
    if (!m.played) return '';
    const a = side(m, n) === 'R' ? m.rs : m.bs, b = side(m, n) === 'R' ? m.bs : m.rs;
    return a > b ? 'W' : a < b ? 'L' : 'T';
  };
  const nextM = rows.find(m => !m.played);
  const shown = ui.hideDone ? rows.filter(m => !m.played) : rows;
  const days = new Set(rows.map(m => String(m.time || '').slice(0, 10)).filter(Boolean));
  const when = m => (m.time ? `${days.size > 1 ? fmtDate(String(m.time).slice(0, 10), { weekday: 'short' }) + ' ' : ''}${fmtTime(m.time)}` : '');
  // our channel's videos for this event
  const ours = videosForEvent(state.videos, allTeams(), state.teams, d);
  const hasKey = !!(S().youtube && S().youtube.apiKey);
  const meetNo = n => {
    const sum = state.teams[[...W.values()].find(t => t.number === n).key] || {};
    const meets = (sum.events || []).filter(e => e.type === 'meet');
    const i = meets.findIndex(e => e.key === key);
    return i >= 0 ? `Meet ${i + 1} ` : '';
  };
  const videoCell = m => {
    if (!m.played) return '';
    const links = [...(ours[m.id] || []), ...m.videos.map(v => ({ ...v, source: 'FIRST' }))];
    if (links.length) return links.map(v => `<a class="vid" href="https://www.youtube.com/watch?v=${esc(v.id)}" target="_blank" rel="noopener" title="${esc(v.title)}">▶ ${v.source === 'FIRST' ? 'FIRST' : 'Video'}${v.how === 'order' ? '?' : ''}</a>`).join(' ');
    if (hasKey || !S().youtube || !S().youtube.channel) return '';
    const n = mine(m)[0], t = W.get(n);
    const q = `${t.program.toUpperCase()} ${t.videoNames && t.videoNames[0] ? t.videoNames[0] : t.name || n} ${meetNo(n)}${m.level === 'qual' ? 'Match ' + m.n : m.label}`;
    return `<a class="vid find" href="${esc(searchUrl(S(), q))}" target="_blank" rel="noopener">Find video</a>`;
  };

  const cards = teams.map(t => {
    const ms = rows.filter(m => side(m, t.number));
    const rec = { W: 0, L: 0, T: 0 };
    for (const m of ms) { const r = result(m, t.number); if (r) rec[r]++; }
    const rk = d.rankings[t.number];
    const nx = ms.find(m => !m.played);
    return `<div class="tcard" style="--tc:${t.color}">
      <div class="tcard-h"><i></i><b>${t.number}</b> <span class="tname">${esc(t.name || d.names[t.number] || '')}</span></div>
      <div class="small">${rk ? `Rank <b>#${rk.rank}</b> of ${d.count} · ` : ''}${rec.W + rec.L + rec.T ? `Record here <b>${rec.W}-${rec.L}-${rec.T}</b>` : 'No matches played yet'}</div>
      <div class="small">${nx ? `Next <b>${esc(nx.label)}</b>${nx.time ? ' at <b>' + when(nx) + '</b>' : ''} · ${pos(nx, t.number)}` : ms.length ? 'All matches done' : 'Not on the schedule yet'}</div>
      <div class="ms">${ms.map(m => { const r = result(m, t.number); return `<span class="${side(m, t.number) === 'R' ? 'r' : 'b'} ${m.played ? 'done' : ''}">${esc(m.label)}${r ? ` <small class="wl ${r}">${r}</small>` : ''}</span>`; }).join('')}</div>
    </div>`;
  }).join('');

  const cell = n => {
    const t = W.get(n);
    return `<span class="st ${t ? 'w' : ''}" ${t ? `style="--tc:${t.color}"` : ''} title="${esc(d.names[n] || '')}">${n}</span>`;
  };
  return `
    <div class="tcards">${cards}</div>
    ${!rows.length ? `<p class="banner warn">${d.matches.length ? 'None of these teams are on the schedule.' : "The match schedule isn't posted yet. It usually appears shortly before matches start."}</p>` : `
    <label class="check"><input type="checkbox" data-change="hideDone" ${ui.hideDone ? 'checked' : ''}> Hide finished matches</label>
    <div class="tablewrap"><table class="tbl sched">
      <thead><tr><th>Match</th><th>Time</th><th>Red</th><th>Blue</th><th>Score</th><th>Our teams</th><th>Video</th></tr></thead>
      <tbody>${shown.map(m => `<tr class="${m.played ? 'done' : ''} ${nextM && m.id === nextM.id ? 'next' : ''}">
        <td class="mn">${esc(m.label)}${nextM && m.id === nextM.id ? ' <span class="pill ok">next</span>' : ''}</td>
        <td class="tm">${when(m) || '–'}</td>
        <td class="side red">${m.red.map(cell).join('')}</td>
        <td class="side blue">${m.blue.map(cell).join('')}</td>
        <td class="scorecell">${m.played ? `<span class="${m.rs > m.bs ? 'win' : ''} r">${m.rs}</span>–<span class="${m.bs > m.rs ? 'win' : ''} b">${m.bs}</span>` : ''}</td>
        <td>${mine(m).map(n => { const r = result(m, n); return `<span class="tres" style="--tc:${W.get(n).color}"><i></i><b>${n}</b> ${pos(m, n)}${r ? ` <span class="wl ${r}">${r}</span>` : ''}</span>`; }).join('')}</td>
        <td class="vids">${videoCell(m)}</td>
      </tr>`).join('')}</tbody></table></div>`}
    <p class="muted small">Updated ${esc(ago(d.at))}${err ? ' · ' + esc(err) : ''}. Times are shown in this phone's time zone.${Object.values(ours).some(l => l.some(v => v.how === 'order')) ? ' A "?" on a video means its title used the team\'s own match count, so it\'s a best guess.' : ''}</p>`;
}

// ---------------------------------------------------------------- season summary per team

function teamCard(t) {
  const s = state.teams[t.key];
  const err = state.errors[t.key];
  const head = `<div class="tcard-h big"><i></i><b>${t.program.toUpperCase()} ${t.number}</b> <span class="tname">${esc(t.name || (s && s.name) || '')}</span>${s && s.city ? ` <span class="muted small">${esc(s.city)}</span>` : ''}</div>`;
  if (!s) return `<section class="card tsum" style="--tc:${t.color}">${head}${err ? `<p class="banner warn">${esc(err)}</p>` : '<p class="busy">Loading…</p>'}</section>`;
  const played = s.events.filter(e => e.stats);
  const seasonLabel = t.program === 'frc' ? `${s.season} season` : `${s.season}–${String(s.season + 1).slice(2)} season`;
  const awards = s.events.flatMap(e => e.awards.map(a => ({ a, e })));
  const next = s.events.find(isAhead);
  const nowEv = s.events.find(e => isOn(e));
  const w = s.world;
  const exp = ui.expanded[t.key];
  return `<section class="card tsum" style="--tc:${t.color}">
    ${head}
    <p class="muted small">${esc(seasonLabel)}${nowEv ? ` · at <b>${esc(nowEv.name)}</b> today` : ''}</p>
    <div class="kpis">
      <div><b>${s.record.w}-${s.record.l}-${s.record.t}</b><span>season record</span></div>
      <div><b>${played.length}</b><span>event${played.length === 1 ? '' : 's'} played</span></div>
      ${s.league ? `<div><b>#${s.league.rank}</b><span>of ${s.league.count} in ${esc(s.league.name)}</span></div>` : ''}
      ${w && w.tot && w.tot.rank ? `<div><b>#${w.tot.rank.toLocaleString()}</b><span>in the world${w.count ? ` of ${w.count.toLocaleString()}` : ''}</span></div>` : ''}
    </div>
    ${s.league ? `<p class="small"><b>League:</b> #${s.league.rank} of ${s.league.count} in ${esc(s.league.name)}${s.league.w != null ? ` · ${s.league.w}-${s.league.l}-${s.league.t}` : ''}${s.league.avgRp != null ? ` · ${f1(s.league.avgRp)} ranking points per match` : ''}</p>` : ''}
    ${w && w.tot && w.tot.rank ? `<p class="small"><b>Rankings by Total NP</b> (FTCScout's points-per-match score): #${w.tot.rank.toLocaleString()} in the world${s.region ? ` · #${s.region.rank} in ${esc(regionName(s.region.code))}${s.region.count ? ` of ${s.region.count}` : ''}` : ''}
      <br><span class="muted">Auto #${(w.auto && w.auto.rank) || '–'} · TeleOp #${(w.dc && w.dc.rank) || '–'} · Endgame #${(w.eg && w.eg.rank) || '–'} in the world</span></p>` : ''}
    ${awards.length ? `<div class="small"><b>Awards</b><ul class="awards">${awards.map(({ a, e }) => `<li>🏆 ${esc(a)} <span class="muted">· ${esc(e.name)}</span></li>`).join('')}</ul></div>` : ''}
    ${next ? `<div class="nextbox"><div class="small"><b>Next:</b> ${esc(next.name)} · ${esc(fmtRange(next))}${daysUntil(next.start) != null ? ` (in ${daysUntil(next.start)} day${daysUntil(next.start) === 1 ? '' : 's'})` : ''}${next.city ? ' · ' + esc(next.city) : ''}</div>
      <div class="btnrow">${calendarButtons(next, [t])}${streamButtons(next, state.events[next.key])}</div></div>` : ''}
    <button class="linkbtn" data-act="expand" data-key="${esc(t.key)}">${exp ? 'Hide events' : `Show all ${s.events.length} event${s.events.length === 1 ? '' : 's'}`}</button>
    ${exp ? `<ul class="evlist">${s.events.map(e => `<li><button class="evrow" data-act="openEvent" data-key="${esc(e.key)}">
        <span class="evd">${esc(fmtDate(e.start, { month: 'short', day: 'numeric' }))}</span>
        <span class="evn"><b>${esc(e.name)}</b><small class="muted">${esc(e.typeLabel || '')}${e.city ? ' · ' + esc(e.city) : ''}</small>
          ${e.awards.length ? `<small>🏆 ${esc(e.awards.join(', '))}</small>` : ''}</span>
        <span class="evr">${e.stats ? `<b>#${e.stats.rank}</b><small>${e.stats.w}-${e.stats.l}-${e.stats.t}</small>` : isAhead(e) ? '<small class="pill">upcoming</small>' : isOn(e) ? '<small class="pill livepill">today</small>' : ''}${e.status ? `<small class="muted">${esc(e.status)}</small>` : ''}</span>
      </button></li>`).join('')}</ul>` : ''}
    ${err ? `<p class="muted small">Couldn't update just now: ${esc(err)}</p>` : ''}
  </section>`;
}

// ---------------------------------------------------------------- one event on demand

function eventPage(key) {
  const summaryEv = followed().map(t => ((state.teams[t.key] || {}).events || []).find(e => e.key === key)).find(Boolean);
  const d = state.events[key];
  const ev = { ...(summaryEv || {}), ...(d || {}), key, typeLabel: (summaryEv && summaryEv.typeLabel) || '' };
  const teams = teamsAt(key);
  return `<section class="card">
    <button class="ghost back" data-act="home">‹ Back</button>
    <h2>${esc(ev.name || key.split(':')[1])}</h2>
    <p class="muted small">${esc(ev.typeLabel || '')}${ev.start ? ' · ' + esc(fmtRange(ev)) : ''}${ev.venue || ev.city ? ' · ' + esc([ev.venue, ev.city].filter(Boolean).join(', ')) : ''}${isOn(ev) ? ' · <b>today</b>' : ''}</p>
    <div class="btnrow">${isAhead(ev) ? calendarButtons(ev, teams) : ''}${streamButtons(ev, d, { live: isOn(ev) })}
      <a class="btn ghost" href="${esc(evUrl(ev))}" target="_blank" rel="noopener">Full results</a></div>
    ${scheduleBlock(key, teams)}
  </section>`;
}

// ---------------------------------------------------------------- data refresh

async function refreshAll({ force = false } = {}) {
  if (navigator.onLine === false || ui.busy || !state.follow) { renderHeader(); return; }
  ui.busy = true;
  renderHeader();
  try {
    await refreshTeams({ force });
    const keys = activeEvents().map(a => a.key);
    if (ui.view === 'event' && ui.eventKey) keys.push(ui.eventKey);
    await Promise.all([...new Set(keys)].map(k => refreshEvent(k, { force })));
    if (keys.length) await refreshVideos({ force });
  } finally {
    ui.busy = false;
    const typing = document.activeElement && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (!typing && !ui.pickSel) render(); else renderHeader();
  }
}

// ---------------------------------------------------------------- actions

const actions = {
  pick: () => { ui.pickSel = new Set(state.follow || []); ui.keepScroll = false; render(); },
  toggleFollow: el => {
    ui.pickSel = ui.pickSel || new Set(state.follow || []);
    const k = el.dataset.key;
    if (ui.pickSel.has(k)) ui.pickSel.delete(k); else ui.pickSel.add(k);
    render();
  },
  addTeam: () => {
    const program = $('#addProg').value, n = Number(($('#addNum').value || '').trim());
    if (!n) return toast('Type a team number.');
    addExtra(program, n);
    ui.pickSel = ui.pickSel || new Set(state.follow || []);
    ui.pickSel.add(`${program}:${n}`);
    render();
  },
  pickDone: () => {
    if (!ui.pickSel || !ui.pickSel.size) return;
    const order = allTeams().map(t => t.key).filter(k => ui.pickSel.has(k));
    setFollow(order);
    ui.pickSel = null; ui.view = 'home'; ui.keepScroll = false;
    render();
    refreshAll();
  },
  pickCancel: () => { ui.pickSel = null; render(); },
  expand: el => { ui.expanded[el.dataset.key] = !ui.expanded[el.dataset.key]; render(); },
  openEvent: el => {
    ui.view = 'event'; ui.eventKey = el.dataset.key; ui.keepScroll = false;
    render();
    refreshEvent(ui.eventKey).then(() => refreshVideos()).then(render);
  },
  home: () => { ui.view = 'home'; ui.keepScroll = false; render(); },
  refresh: () => refreshAll({ force: true }),
  embed: el => { ui.embed[el.dataset.key] = !ui.embed[el.dataset.key]; render(); },
  ics: el => {
    const key = el.dataset.key;
    const ev = followed().map(t => ((state.teams[t.key] || {}).events || []).find(e => e.key === key)).find(Boolean);
    if (!ev) return;
    const d = state.events[key] || {};
    downloadIcs({ ...ev, venue: d.venue || '', stream: streamFor(ev, d) }, teamsAt(key).map(t => t.name || t.number), appUrl());
  },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.tagName === 'A') return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.change === 'hideDone') { ui.hideDone = el.checked; render(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'addNum') actions.addTeam(); });
window.addEventListener('online', () => refreshAll());
window.addEventListener('offline', renderHeader);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAll(); });
// every minute while open: live events refresh each minute, everything else when it's out of date
setInterval(() => { if (!document.hidden) refreshAll(); }, 60000);

// ---------------------------------------------------------------- start

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    const show = w => { ui.waitingSW = w; $('#updateBar').classList.remove('hidden'); };
    if (reg.waiting && navigator.serviceWorker.controller) show(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (w) w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) show(w); });
    });
  }).catch(() => {});
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && ui.waitingSW) { reloaded = true; location.reload(); } });
}
actions.applyUpdate = () => { if (ui.waitingSW) ui.waitingSW.postMessage('skipWaiting'); else location.reload(); };

render();
loadConfig().then(() => { render(); refreshAll(); });

window.__prl = { state, ui, actions, render, refreshAll };
