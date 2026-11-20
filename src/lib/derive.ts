// Pure functions that turn raw data into what the home screen shows.
// Insights here are computed from your real data — nothing is invented.

import type { CalendarEvent, Snapshot, Task } from "./types";
import { PRIORITY_ORDER } from "./types";
import {
  addDays,
  daysUntil,
  timedEventsOn,
  format,
  minutesBetween,
  parseDateKey,
  relativeDay,
  toDateKey,
  toDateTime,
} from "./dates";

export function todaysTasks(tasks: Task[], today: string) {
  return tasks.filter((t) => {
    if (t.status === "done") return t.completedAt?.slice(0, 10) === today;
    const day = t.scheduledDate ?? t.dueDate;
    return day !== null && day <= today;
  });
}

export interface TaskGroups {
  focus: Task[]; // urgent/high or overdue
  next: Task[]; // normal
  later: Task[]; // low
  done: Task[];
}

export function groupTasks(tasks: Task[], today: string): TaskGroups {
  const open = tasks
    .filter((t) => t.status === "todo")
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        (a.dueTime ?? "99").localeCompare(b.dueTime ?? "99") ||
        a.createdAt.localeCompare(b.createdAt),
    );
  const overdue = (t: Task) => t.dueDate !== null && t.dueDate < today;
  return {
    focus: open.filter((t) => t.priority === "urgent" || t.priority === "high" || overdue(t)),
    next: open.filter((t) => t.priority === "normal" && !overdue(t)),
    later: open.filter((t) => t.priority === "low" && !overdue(t)),
    done: tasks.filter((t) => t.status === "done"),
  };
}

export interface DeadlineItem {
  task: Task;
  days: number;
  prepScheduled: boolean;
}

/** Deadlines in the next `horizon` days (plus overdue), soonest first. */
export function upcomingDeadlines(data: Snapshot, now: Date, horizon = 10): DeadlineItem[] {
  return data.tasks
    .filter((t) => t.status === "todo" && t.dueDate && (t.kind === "deadline" || t.priority !== "low"))
    .map((t) => ({ task: t, days: daysUntil(t.dueDate!, now) }))
    .filter(({ task, days }) => days <= horizon && (days > 0 || task.kind === "deadline"))
    .map(({ task, days }) => ({ task, days, prepScheduled: hasPrep(data, task) }))
    .sort((a, b) => a.days - b.days || PRIORITY_ORDER[a.task.priority] - PRIORITY_ORDER[b.task.priority]);
}

function hasPrep(data: Snapshot, t: Task) {
  if (data.events.some((e) => e.taskId === t.id)) return true;
  const key = t.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3)[0];
  if (!key) return false;
  return data.tasks.some(
    (o) => o.id !== t.id && o.status === "todo" && o.kind === "task" && o.title.toLowerCase().includes(key),
  );
}

export interface Gap {
  start: string;
  end: string;
  minutes: number;
}

/** Free gaps between now and `dayEnd` today, given events. */
export function freeGaps(events: CalendarEvent[], now: Date, dayEnd = "22:00"): Gap[] {
  const today = toDateKey(now);
  const end = `${today}T${dayEnd}`;
  let cursor = toDateTime(now);
  const gaps: Gap[] = [];
  for (const e of timedEventsOn(events, today)) {
    if (e.end <= cursor) continue;
    if (e.start > cursor) {
      const m = minutesBetween(cursor, e.start < end ? e.start : end);
      if (m >= 30) gaps.push({ start: cursor, end: e.start, minutes: m });
    }
    if (e.end > cursor) cursor = e.end;
    if (cursor >= end) break;
  }
  if (cursor < end) {
    const m = minutesBetween(cursor, end);
    if (m >= 30) gaps.push({ start: cursor, end, minutes: m });
  }
  return gaps;
}

export type InsightTone = "warn" | "info" | "good";
export interface Insight {
  id: string;
  tone: InsightTone;
  text: string;
  prompt?: string; // what to send the AI if you tap it
  href?: string; // or a link to open instead
}

export function computeInsights(data: Snapshot, now: Date): Insight[] {
  const out: Insight[] = [];
  const today = toDateKey(now);

  const overdue = data.tasks.filter((t) => t.status === "todo" && t.dueDate && t.dueDate < today);
  if (overdue.length)
    out.push({
      id: "overdue",
      tone: "warn",
      text:
        overdue.length === 1
          ? `"${overdue[0].title}" is overdue.`
          : `${overdue.length} tasks are overdue — the oldest is "${overdue[0].title}".`,
      prompt: "Help me deal with my overdue tasks — reschedule them realistically.",
    });

  for (const d of upcomingDeadlines(data, now, 7)) {
    if (d.days < 1 || d.prepScheduled) continue;
    if (d.task.kind !== "deadline" && d.task.priority !== "urgent") continue;
    out.push({
      id: "prep-" + d.task.id,
      tone: "warn",
      text: `${d.task.title} is ${relativeDay(d.task.dueDate!, now).toLowerCase() === "tomorrow" ? "tomorrow" : "on " + relativeDay(d.task.dueDate!, now)} and nothing is scheduled to prepare.`,
      prompt: `I have "${d.task.title}" due ${d.task.dueDate}. Help me prepare — schedule prep sessions in my free time.`,
    });
    if (out.length >= 3) break;
  }

  for (const p of data.projects.filter((p) => p.status === "active")) {
    const open = data.tasks.filter((t) => t.projectId === p.id && t.status === "todo");
    if (open.length >= 2) {
      out.push({
        id: "proj-" + p.id,
        tone: "info",
        text: `${p.name} has ${open.length} open tasks${p.targetDate ? `, target ${relativeDay(p.targetDate, now)}` : ""}.`,
        prompt: `What should I do next on ${p.name}?`,
      });
    }
  }

  const tomorrow = toDateKey(addDays(now, 1));
  const tmrEvents = timedEventsOn(data.events, tomorrow);
  const tmrBusyMin = tmrEvents.reduce((m, e) => m + minutesBetween(e.start, e.end), 0);
  const tmrTasks = data.tasks.filter(
    (t) => t.status === "todo" && (t.dueDate === tomorrow || t.scheduledDate === tomorrow),
  ).length;
  if (tmrBusyMin >= 240 || tmrTasks >= 5 || (tmrEvents.length >= 3 && tmrTasks >= 3))
    out.push({
      id: "tmr",
      tone: "info",
      text: `Tomorrow is heavy: ${tmrEvents.length} event${tmrEvents.length === 1 ? "" : "s"} and ${tmrTasks} task${tmrTasks === 1 ? "" : "s"} due. Getting ahead tonight would help.`,
      prompt: "Tomorrow looks busy. What can I get done tonight to lighten it?",
    });

  if (now.getHours() < 21) {
    const best = freeGaps(data.events, now).sort((a, b) => b.minutes - a.minutes)[0];
    const open = data.tasks.filter((t) => t.status === "todo").length;
    if (best && best.minutes >= 60 && open > 0) {
      const h = Math.floor(best.minutes / 60);
      const m = best.minutes % 60;
      out.push({
        id: "gap",
        tone: "good",
        text: `You have ${h ? `${h}h` : ""}${m ? ` ${m}m` : ""} free from ${format(new Date(best.start), "h:mm a").toLowerCase()} — a good block for focused work.`,
        prompt: "Plan my day — fit my most important tasks into my free time today.",
      });
    }
  }

  return out.slice(0, 5);
}

/** One-sentence summary of the day. */
export function daySummary(data: Snapshot, now: Date): string {
  const today = toDateKey(now);
  const open = todaysTasks(data.tasks, today).filter((t) => t.status === "todo");
  const events = timedEventsOn(data.events, today).filter((e) => e.end > toDateTime(now));
  const next = upcomingDeadlines(data, now, 7).find((d) => d.days >= 0);
  const parts: string[] = [];
  if (open.length === 0 && events.length === 0) parts.push("Your day is clear");
  else {
    if (open.length) parts.push(`${open.length} task${open.length === 1 ? "" : "s"} to go`);
    if (events.length) parts.push(`${events.length} event${events.length === 1 ? "" : "s"} ahead`);
  }
  let s = parts.join(" and ");
  s = s.charAt(0).toUpperCase() + s.slice(1);
  if (next) s += `. Next deadline: ${next.task.title}, ${relativeDay(next.task.dueDate!, now).toLowerCase()}`;
  return s + ".";
}

export function weekdayLong(dateKey: string) {
  return format(parseDateKey(dateKey), "EEEE");
}
