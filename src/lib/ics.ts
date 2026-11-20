// Minimal iCalendar (.ics) parser for calendar subscriptions (Google Calendar,
// Moodle exports). Handles all-day events, UTC and TZID times, and simple
// RRULEs. Self-contained so it can be tested with node directly.

export interface IcsEvent {
  uid: string;
  title: string;
  description: string | null;
  location: string | null;
  allDay: boolean;
  /** Local floating datetime "YYYY-MM-DDTHH:mm" in the target timezone (all-day: T00:00). */
  start: string;
  /** Exclusive end; for all-day events the day after the last day. */
  end: string;
  recurrence: { freq: "daily" | "weekly" | "monthly"; until: string | null } | null;
}

const pad = (n: number) => String(n).padStart(2, "0");

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescape(v: string) {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

/** Format a UTC instant as local floating time in `tz`. */
function inZone(date: Date, tz: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

/** Interpret a local wall time in `fromTz` as a UTC instant. */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, fromTz: string): Date {
  // Start from the naive UTC guess, then correct by the zone's offset at that moment.
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const asLocal = inZone(new Date(guess), fromTz);
  const [ld, lt] = asLocal.split("T");
  const [ly, lmo, lday] = ld.split("-").map(Number);
  const [lh, lmi] = lt.split(":").map(Number);
  const offset = Date.UTC(ly, lmo - 1, lday, lh, lmi) - guess;
  return new Date(guess - offset);
}

function addDaysKey(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

interface Prop {
  params: Record<string, string>;
  value: string;
}

function parseLine(line: string): [string, Prop] | null {
  const i = line.indexOf(":");
  if (i < 0) return null;
  const [name, ...paramParts] = line.slice(0, i).split(";");
  const params: Record<string, string> = {};
  for (const p of paramParts) {
    const [k, v] = p.split("=");
    if (k && v) params[k.toUpperCase()] = v.replace(/^"|"$/g, "");
  }
  return [name.toUpperCase(), { params, value: line.slice(i + 1) }];
}

/** Returns [floating local datetime, isAllDay]. */
function parseDate(p: Prop, tz: string): [string, boolean] | null {
  const v = p.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (p.params.VALUE === "DATE" || h === undefined) return [`${y}-${mo}-${d}T00:00`, true];
  if (z) return [inZone(new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi)), tz), false];
  const from = p.params.TZID;
  if (from && from !== tz) {
    try {
      return [inZone(zonedToUtc(+y, +mo, +d, +h, +mi, from), tz), false];
    } catch {
      // Unknown TZID: fall through and treat as local time.
    }
  }
  return [`${y}-${mo}-${d}T${h}:${mi}`, false];
}

function parseRrule(v: string, tz: string): IcsEvent["recurrence"] {
  const r = Object.fromEntries(v.split(";").map((kv) => kv.split("=")));
  const freq = ({ DAILY: "daily", WEEKLY: "weekly", MONTHLY: "monthly" } as const)[r.FREQ as "DAILY"];
  if (!freq) return null;
  // Only simple rules map onto devbot's recurrence; complex ones (BYDAY lists, INTERVAL>1) are skipped.
  if ((r.INTERVAL && r.INTERVAL !== "1") || (r.BYDAY && r.BYDAY.includes(",")) || r.COUNT) return null;
  let until: string | null = null;
  if (r.UNTIL) {
    const d = parseDate({ params: {}, value: r.UNTIL }, tz);
    if (d) until = d[0].slice(0, 10);
  }
  return { freq, until };
}

export function parseIcs(text: string, tz: string, from?: string, to?: string): { name: string | null; events: IcsEvent[] } {
  const lines = unfold(text);
  let name: string | null = null;
  const events: IcsEvent[] = [];
  let cur: Record<string, Prop> | null = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      cur = {};
      continue;
    }
    if (line === "END:VEVENT") {
      if (cur) {
        const ev = toEvent(cur, tz);
        if (ev && (!from || ev.end.slice(0, 10) >= from || ev.recurrence) && (!to || ev.start.slice(0, 10) <= to)) events.push(ev);
      }
      cur = null;
      continue;
    }
    const parsed = parseLine(line);
    if (!parsed) continue;
    const [key, prop] = parsed;
    if (cur) {
      if (!(key in cur)) cur[key] = prop;
    } else if (key === "X-WR-CALNAME") name = unescape(prop.value);
  }
  return { name, events };
}

function toEvent(p: Record<string, Prop>, tz: string): IcsEvent | null {
  if (p.STATUS?.value === "CANCELLED" || !p.DTSTART) return null;
  const s = parseDate(p.DTSTART, tz);
  if (!s) return null;
  const [start, allDay] = s;
  let end: string;
  const e = p.DTEND ? parseDate(p.DTEND, tz) : null;
  if (e) end = e[0];
  else if (allDay) end = `${addDaysKey(start.slice(0, 10), 1)}T00:00`;
  else end = start;
  if (end <= start) end = allDay ? `${addDaysKey(start.slice(0, 10), 1)}T00:00` : start;
  return {
    uid: p.UID?.value ?? `${start}-${p.SUMMARY?.value ?? ""}`,
    title: unescape(p.SUMMARY?.value ?? "(untitled)"),
    description: p.DESCRIPTION ? unescape(p.DESCRIPTION.value).slice(0, 2000) || null : null,
    location: p.LOCATION ? unescape(p.LOCATION.value) || null : null,
    allDay,
    start,
    end,
    recurrence: p.RRULE ? parseRrule(p.RRULE.value, tz) : null,
  };
}
