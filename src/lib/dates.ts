import {
  addDays,
  differenceInCalendarDays,
  differenceInMinutes,
  format,
  getDay,
  parse,
} from "date-fns";
import type { CalendarEvent } from "./types";

export const toDateKey = (d: Date) => format(d, "yyyy-MM-dd");
export const toDateTime = (d: Date) => format(d, "yyyy-MM-dd'T'HH:mm");
export const parseDateKey = (s: string) => parse(s, "yyyy-MM-dd", new Date());
export const parseDateTime = (s: string) =>
  parse(s, "yyyy-MM-dd'T'HH:mm", new Date());

export const daysUntil = (dateKey: string, now: Date) =>
  differenceInCalendarDays(parseDateKey(dateKey), now);

export function relativeDay(dateKey: string, now: Date): string {
  const d = daysUntil(dateKey, now);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d === -1) return "Yesterday";
  if (d < 0) return `${-d}d overdue`;
  if (d < 7) return format(parseDateKey(dateKey), "EEEE");
  return format(parseDateKey(dateKey), "MMM d");
}

export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${String(m).padStart(2, "0")}${suffix}`;
}

export const timeOf = (dt: string) => dt.slice(11, 16);
export const dateOf = (dt: string) => dt.slice(0, 10);

export function greetingFor(now: Date): string {
  const h = now.getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** Does a (possibly recurring) event occur on the given day? Returns the concrete occurrence. */
export function occurrenceOn(
  ev: CalendarEvent,
  dateKey: string,
): CalendarEvent | null {
  const startDay = dateOf(ev.start);
  if (!ev.recurrence) return startDay === dateKey ? ev : null;
  if (dateKey < startDay) return null;
  if (ev.recurrence.until && dateKey > ev.recurrence.until) return null;
  const day = parseDateKey(dateKey);
  const first = parseDateKey(startDay);
  let hit = false;
  switch (ev.recurrence.freq) {
    case "daily":
      hit = true;
      break;
    case "weekdays":
      hit = getDay(day) !== 0 && getDay(day) !== 6;
      break;
    case "weekly":
      hit = getDay(day) === getDay(first);
      break;
    case "monthly":
      hit = day.getDate() === first.getDate();
      break;
  }
  if (!hit) return null;
  const durMin = differenceInMinutes(parseDateTime(ev.end), parseDateTime(ev.start));
  const start = parseDateTime(`${dateKey}T${timeOf(ev.start)}`);
  return {
    ...ev,
    start: toDateTime(start),
    end: toDateTime(new Date(start.getTime() + durMin * 60000)),
  };
}

export function eventsOn(events: CalendarEvent[], dateKey: string): CalendarEvent[] {
  return events
    .map((e) => occurrenceOn(e, dateKey))
    .filter((e): e is CalendarEvent => e !== null)
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function minutesBetween(a: string, b: string) {
  return differenceInMinutes(parseDateTime(b), parseDateTime(a));
}

export { addDays, format };
