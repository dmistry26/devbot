// Calendar helpers: expanding recurring events over a range, conflict
// detection, and side-by-side layout for overlapping events.

import type { CalendarEvent, Task } from "./types";
import { addDays, eventsOn, minutesBetween, occurrenceOn, parseDateKey, toDateKey } from "./dates";

export interface Occurrence extends CalendarEvent {
  /** The base event id (same as id); occurrences of a series share it. */
  day: string;
}

/** All occurrences between two date keys (inclusive). */
export function occurrencesInRange(events: CalendarEvent[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = [];
  let d = parseDateKey(from);
  const end = parseDateKey(to);
  while (d <= end) {
    const key = toDateKey(d);
    for (const e of eventsOn(events, key)) out.push({ ...e, day: key });
    d = addDays(d, 1);
  }
  return out;
}

export interface Conflict {
  event: CalendarEvent;
  day: string;
}

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart < bEnd && bStart < aEnd;

/**
 * Events that overlap a candidate. For a recurring candidate, checks its
 * occurrences over the next `horizonDays` and reports the first clash per event.
 */
export function findConflicts(
  candidate: Pick<CalendarEvent, "start" | "end" | "recurrence"> & { id?: string },
  events: CalendarEvent[],
  horizonDays = 28,
): Conflict[] {
  const others = events.filter((e) => e.id !== candidate.id);
  const first = candidate.start.slice(0, 10);
  const days = candidate.recurrence ? horizonDays : 1;
  const probe = { ...candidate, id: "__probe__", title: "", description: null, location: null, category: "other" as const, taskId: null, source: "manual" as const, createdAt: "", updatedAt: "" };
  const seen = new Set<string>();
  const out: Conflict[] = [];
  for (let i = 0; i < days; i++) {
    const day = toDateKey(addDays(parseDateKey(first), i));
    const occ = occurrenceOn(probe, day);
    if (!occ) continue;
    for (const e of eventsOn(others, day)) {
      if (seen.has(e.id)) continue;
      if (overlaps(occ.start, occ.end, e.start, e.end)) {
        seen.add(e.id);
        out.push({ event: e, day });
      }
    }
  }
  return out;
}

/** Pairs of overlapping events on a day — used to badge clashes in the calendar. */
export function conflictIdsOn(events: CalendarEvent[], day: string): Set<string> {
  const list = eventsOn(events, day);
  const ids = new Set<string>();
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++)
      if (overlaps(list[i].start, list[i].end, list[j].start, list[j].end)) {
        // Focus blocks inside a long all-day-ish event (like "School") aren't real clashes.
        if (list[i].taskId || list[j].taskId) continue;
        ids.add(list[i].id);
        ids.add(list[j].id);
      }
  return ids;
}

export interface Placed {
  event: CalendarEvent;
  top: number; // minutes from view start
  height: number; // minutes
  lane: number;
  lanes: number;
}

/** Assign overlapping events to side-by-side lanes for a time-grid column. */
export function layoutDay(events: CalendarEvent[], day: string, startHour: number, endHour: number): Placed[] {
  const viewStart = `${day}T${String(startHour).padStart(2, "0")}:00`;
  const viewEnd = `${day}T${String(endHour).padStart(2, "0")}:00`;
  const list = eventsOn(events, day).filter((e) => e.end > viewStart && e.start < viewEnd);
  const placed: Placed[] = [];
  let cluster: Placed[] = [];
  let clusterEnd = "";
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1));
    cluster.forEach((p) => (p.lanes = lanes));
    placed.push(...cluster);
    cluster = [];
  };
  for (const e of list) {
    const s = e.start < viewStart ? viewStart : e.start;
    const en = e.end > viewEnd ? viewEnd : e.end;
    if (cluster.length && s >= clusterEnd) flush();
    const used = new Set(cluster.filter((p) => p.event.end > s).map((p) => p.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ event: e, top: minutesBetween(viewStart, s), height: Math.max(20, minutesBetween(s, en)), lane, lanes: 1 });
    if (en > clusterEnd) clusterEnd = en;
  }
  if (cluster.length) flush();
  return placed;
}

/** Tasks due (or deadlines) on a given day. */
export function dueOn(tasks: Task[], day: string): Task[] {
  return tasks.filter((t) => t.status === "todo" && t.dueDate === day);
}
