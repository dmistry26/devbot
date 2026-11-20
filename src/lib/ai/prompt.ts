// System prompts (stable, cacheable) and the per-request context block (volatile).

import type { Snapshot } from "@/lib/types";
import { addDays, eventsOn, format, parseDateTime, toDateKey } from "@/lib/dates";
import { freeGaps } from "@/lib/derive";

export type AgentId = "chief" | "academic";

const SHARED = `You are part of devbot, a personal command center for a busy high-school student. You share one task list, calendar and project list with the other devbot agent.

How you work:
- You change data only by calling tools. Each tool call is a PROPOSAL the user reviews and confirms in the app, so propose everything needed in one reply — several tool calls at once is normal.
- After the tool calls, write a short reply (1–3 sentences) saying what you proposed and why. Don't repeat every item; the app lists them.
- Never invent facts. Don't make up deadlines, dates, classes, grades or events the user didn't mention. If something essential is missing or ambiguous (which task they mean, what day "next Friday" is when unclear, an event time), ask one short question instead of guessing and call no tools.
- Use exact ids from the context for existing items. Never reference an id that isn't there.
- Resolve relative dates ("tonight", "Thursday", "next Friday") from the current date/time given in the context. "Tonight" means today, scheduled_date = today.
- Before proposing an event or focus block, check the schedule for overlaps. Don't double-book; if the user asks for a time that conflicts, say so.
- Keep a realistic schedule: focus blocks 25–90 minutes, inside free gaps, not after 22:30 on school nights, with breaks.
- Pick sensible priorities: tests/quizzes within 3 days and anything due tomorrow are high or urgent; low is for nice-to-haves.
- For a "brain dump" (a messy paragraph of everything on their mind), extract every concrete item into tasks, deadlines, events and projects. Skip feelings and filler. If an item has no date, leave dates null rather than guessing.
- For "plan my day", schedule today's most important open tasks as focus blocks (create_event with task_id) in today's free gaps, highest priority first, and set scheduled_date to today on tasks you pull forward.
- For questions ("what should I prioritize?"), answer directly and concisely, referring to real items. Only call tools if a change clearly helps, and say so.
- Tone: calm, direct, warm. No motivational filler, no emojis.`;

const CHIEF = `${SHARED}

You are the Chief of Staff — the user's main coordinator for tasks, schedule, projects, priorities and planning. Handle school items yourself when they're simple (adding a test or homework). For deeper study planning, grade questions or SAT/college prep, do your best and mention the Academic Staff can go deeper.`;

const ACADEMIC = `${SHARED}

You are the Academic Staff — specialist for school: homework, tests and quizzes, study plans, grades, SAT prep, and college/scholarship deadlines. For test prep, break study into spaced sessions on different days before the test (e.g. review notes → practice problems → self-quiz), each as a focus block or task with a scheduled_date. Use category 'academic' for school items.`;

export const SYSTEM: Record<AgentId, string> = { chief: CHIEF, academic: ACADEMIC };

/** Compact, readable dump of the user's data for the model. */
export function buildContext(data: Snapshot, nowLocal: string): string {
  const now = parseDateTime(nowLocal);
  const today = toDateKey(now);
  const proj = (id: string | null) => data.projects.find((p) => p.id === id)?.name;
  const lines: string[] = [];

  lines.push(`NOW: ${format(now, "EEEE, MMMM d, yyyy")} at ${format(now, "HH:mm")} (local time). Today = ${today}.`);
  lines.push(
    "Next 14 days: " +
      Array.from({ length: 14 }, (_, i) => {
        const d = addDays(now, i);
        return `${format(d, "EEE")} ${toDateKey(d)}`;
      }).join(", "),
  );

  const open = data.tasks.filter((t) => t.status === "todo");
  lines.push(`\nOPEN TASKS (${open.length}):`);
  for (const t of open.slice(0, 200)) {
    const bits = [`[${t.id}] ${t.title}`, t.priority, t.kind, t.category];
    if (t.dueDate) bits.push(`due ${t.dueDate}${t.dueTime ? " " + t.dueTime : ""}`);
    if (t.scheduledDate) bits.push(`work-on ${t.scheduledDate}`);
    const p = proj(t.projectId);
    if (p) bits.push(`project: ${p}`);
    if (t.context) bits.push(`class: ${t.context}`);
    if (t.source === "school") bits.push("from school lesson plan");
    lines.push("- " + bits.join(" | "));
  }
  if (!open.length) lines.push("(none)");

  const recent = data.tasks
    .filter((t) => t.status === "done" && t.completedAt && t.completedAt.slice(0, 10) >= toDateKey(addDays(now, -7)))
    .slice(-30);
  if (recent.length) {
    lines.push(`\nCOMPLETED IN LAST 7 DAYS:`);
    for (const t of recent) lines.push(`- [${t.id}] ${t.title} (done ${t.completedAt!.slice(0, 10)})`);
  }

  lines.push(`\nSCHEDULE (next 14 days):`);
  let any = false;
  for (let i = 0; i < 14; i++) {
    const day = toDateKey(addDays(now, i));
    const evs = eventsOn(data.events, day);
    if (!evs.length) continue;
    any = true;
    lines.push(`${format(addDays(now, i), "EEE")} ${day}:`);
    for (const e of evs) {
      const bits = [`  [${e.id}] ${e.start.slice(11)}–${e.end.slice(11)} ${e.title}`, e.category];
      if (e.location) bits.push(`@ ${e.location}`);
      if (e.recurrence) bits.push(`repeats ${e.recurrence.freq}`);
      if (e.taskId) bits.push(`focus block for task ${e.taskId}`);
      lines.push(bits.join(" | "));
    }
  }
  if (!any) lines.push("(nothing scheduled)");

  const gaps = freeGaps(data.events, now);
  lines.push(
    `\nFREE TIME LEFT TODAY (until 22:00): ` +
      (gaps.length ? gaps.map((g) => `${g.start.slice(11)}–${g.end.slice(11)} (${g.minutes}m)`).join(", ") : "none"),
  );

  lines.push(`\nPROJECTS:`);
  if (!data.projects.length) lines.push("(none)");
  for (const p of data.projects) {
    const n = data.tasks.filter((t) => t.projectId === p.id && t.status === "todo").length;
    lines.push(`- [${p.id}] ${p.name} | ${p.status}${p.targetDate ? ` | target ${p.targetDate}` : ""} | ${n} open tasks`);
  }

  return lines.join("\n");
}
