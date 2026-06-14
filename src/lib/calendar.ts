// Génération des liens « Ajouter à mon agenda » (Google, Outlook) et du fichier .ics.
// L'heure des événements est du texte libre (ex. « 18h », « 18h30 ») : on la parse au mieux,
// sinon l'événement est marqué « toute la journée ». Fuseau : America/Toronto (gère l'heure avancée).

export interface CalEvent {
  id?: string;
  title: string;
  date: string; // 'YYYY-MM-DD'
  time?: string; // texte libre
  location?: string;
  description?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function parseTime(timeStr?: string): { h: number; m: number } | null {
  if (!timeStr) return null;
  const m = timeStr.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = m[2] ? parseInt(m[2], 10) : 0;
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

// Offset GMT (en ms) de America/Toronto à la date donnée — gère EDT (-4h) / EST (-5h).
function torontoOffsetMs(dateStr: string): number {
  try {
    const d = new Date(dateStr + 'T12:00:00Z');
    const s = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Toronto', timeZoneName: 'longOffset' }).format(d);
    const m = s.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (m) {
      const sign = m[1] === '-' ? -1 : 1;
      return sign * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10)) * 60 * 1000;
    }
  } catch {
    /* fallback ci-dessous */
  }
  return -5 * 3600 * 1000; // EST par défaut
}

interface CalTimes {
  allDay: boolean;
  startMs: number;
  endMs: number;
}

function calTimes(ev: CalEvent): CalTimes {
  const t = parseTime(ev.time);
  if (!t) {
    const startMs = Date.parse(ev.date + 'T00:00:00Z');
    return { allDay: true, startMs, endMs: startMs + 86400000 };
  }
  const offsetMs = torontoOffsetMs(ev.date);
  const [y, mo, da] = ev.date.split('-').map(Number);
  // Heure murale locale traitée comme UTC, puis on retire l'offset pour obtenir le vrai instant UTC.
  const startMs = Date.UTC(y, mo - 1, da, t.h, t.m, 0) - offsetMs;
  return { allDay: false, startMs, endMs: startMs + 3 * 3600 * 1000 }; // durée 3 h
}

function fmtZ(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function fmtDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function q(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
}

export function googleCalUrl(ev: CalEvent): string {
  const ct = calTimes(ev);
  const dates = ct.allDay ? `${fmtDay(ct.startMs)}/${fmtDay(ct.endMs)}` : `${fmtZ(ct.startMs)}/${fmtZ(ct.endMs)}`;
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&' + q({
    text: ev.title,
    dates,
    location: ev.location || '',
    details: ev.description || '',
  });
}

export function outlookCalUrl(ev: CalEvent): string {
  const ct = calTimes(ev);
  const base: Record<string, string> = {
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: ev.title,
    location: ev.location || '',
    body: ev.description || '',
  };
  if (ct.allDay) {
    base.allday = 'true';
    base.startdt = new Date(ct.startMs).toISOString().slice(0, 10);
    base.enddt = new Date(ct.endMs).toISOString().slice(0, 10);
  } else {
    base.startdt = new Date(ct.startMs).toISOString();
    base.enddt = new Date(ct.endMs).toISOString();
  }
  return 'https://outlook.office.com/calendar/0/deeplink/compose?' + q(base);
}

export function buildIcs(ev: CalEvent): string {
  const ct = calTimes(ev);
  const esc = (s: string) => (s || '').replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
  const uid = `${ev.id || fmtZ(ct.startMs)}@groupefinancierstefoy.com`;
  const dtstart = ct.allDay ? `DTSTART;VALUE=DATE:${fmtDay(ct.startMs)}` : `DTSTART:${fmtZ(ct.startMs)}`;
  const dtend = ct.allDay ? `DTEND;VALUE=DATE:${fmtDay(ct.endMs)}` : `DTEND:${fmtZ(ct.endMs)}`;
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Groupe Financier Ste-Foy//Evenements//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmtZ(ct.startMs)}`,
    dtstart,
    dtend,
    `SUMMARY:${esc(ev.title)}`,
    ev.location ? `LOCATION:${esc(ev.location)}` : '',
    ev.description ? `DESCRIPTION:${esc(ev.description)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}
