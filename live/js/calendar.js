// "Add to calendar" for an event: an .ics file (Apple / Outlook calendars) or a Google Calendar link.

const ymd = s => String(s || '').slice(0, 10).replace(/-/g, '');
function dayAfter(s) {
  const d = new Date(String(s).slice(0, 10) + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
const icsText = s => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function eventTitle(ev, teams) {
  return `${teams.length ? teams.join(' & ') + ' at ' : ''}${ev.name}`;
}

export function icsFor(ev, teams, url) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Piper Robotics Live//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${ev.key.replace(/[^\w]/g, '-')}-${ymd(ev.start)}@robotics-live`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')}`,
    `DTSTART;VALUE=DATE:${ymd(ev.start)}`,
    `DTEND;VALUE=DATE:${dayAfter(ev.end || ev.start)}`,
    `SUMMARY:${icsText(eventTitle(ev, teams))}`,
    ev.venue || ev.city ? `LOCATION:${icsText([ev.venue, ev.city].filter(Boolean).join(', '))}` : '',
    `DESCRIPTION:${icsText(`${ev.typeLabel || 'Robotics event'}${ev.stream ? '\nWatch live: ' + ev.stream : ''}${url ? '\nSchedule and results: ' + url : ''}`)}`,
    url ? `URL:${url}` : '',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n') + '\r\n';
}

export function downloadIcs(ev, teams, url) {
  const blob = new Blob([icsFor(ev, teams, url)], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${ev.code}.ics`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}

export function googleCalUrl(ev, teams, url) {
  const p = new URLSearchParams({
    action: 'TEMPLATE', text: eventTitle(ev, teams), dates: `${ymd(ev.start)}/${dayAfter(ev.end || ev.start)}`,
    details: `${ev.typeLabel || 'Robotics event'}${ev.stream ? '\nWatch live: ' + ev.stream : ''}${url ? '\nSchedule and results: ' + url : ''}`,
    location: [ev.venue, ev.city].filter(Boolean).join(', '),
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}
