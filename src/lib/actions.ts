// Actions are the single way data changes — whether you click a checkbox or the
// AI proposes something. AI proposals are shown as cards and only applied after
// you confirm, and every applied batch is undoable.

import type {
  CalendarEvent,
  Category,
  Note,
  Priority,
  Project,
  Recurrence,
  Snapshot,
  Task,
  TaskKind,
} from "./types";
import { CATEGORIES, PRIORITIES } from "./types";

export type Action =
  | {
      type: "create_task";
      title: string;
      description: string | null;
      priority: Priority;
      kind: TaskKind;
      category: Category;
      due_date: string | null;
      due_time: string | null;
      scheduled_date: string | null;
      project_name: string | null;
    }
  | {
      type: "update_task";
      task_id: string;
      title: string | null;
      priority: Priority | null;
      due_date: string | null;
      due_time: string | null;
      scheduled_date: string | null;
      category: Category | null;
    }
  | { type: "complete_task"; task_id: string }
  | { type: "reopen_task"; task_id: string }
  | { type: "delete_task"; task_id: string }
  | {
      type: "create_event";
      title: string;
      start: string;
      end: string;
      location: string | null;
      category: Category;
      recurrence: Recurrence | null;
      task_id: string | null;
    }
  | {
      type: "update_event";
      event_id: string;
      title: string | null;
      start: string | null;
      end: string | null;
      location: string | null;
    }
  | {
      // Full edit from the event editor (not exposed to the AI).
      type: "set_event";
      event_id: string;
      title: string;
      start: string;
      end: string;
      location: string | null;
      description: string | null;
      category: Category;
      recurrence: Recurrence | null;
    }
  | { type: "delete_event"; event_id: string }
  | {
      type: "create_project";
      name: string;
      description: string | null;
      target_date: string | null;
    }
  | {
      type: "create_note";
      title: string;
      content: string;
      category: Category;
      project_name: string | null;
    };

export type ActionType = Action["type"];

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const okDate = (v: unknown) => v === null || (typeof v === "string" && DATE.test(v));
const okTime = (v: unknown) => v === null || (typeof v === "string" && TIME.test(v));
const okCat = (v: unknown) => CATEGORIES.includes(v as Category);
const okPri = (v: unknown) => PRIORITIES.includes(v as Priority);
const str = (v: unknown) => typeof v === "string" && v.trim().length > 0;

/** Validate an action from an untrusted source (the model). Returns an error string or null. */
export function validateAction(a: Action, data: Snapshot, today?: string): string | null {
  // Proposals with dates in the past are almost always a wrong year or a made-up date.
  if (today) {
    const yesterday = (() => {
      const [y, m, d] = today.split("-").map(Number);
      const dt = new Date(y, m - 1, d - 1);
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    })();
    const dates =
      a.type === "create_task" || a.type === "update_task"
        ? [a.due_date, a.scheduled_date]
        : a.type === "create_event" || a.type === "update_event"
          ? [a.start?.slice(0, 10) ?? null]
          : a.type === "create_project"
            ? [a.target_date]
            : [];
    if (dates.some((d) => typeof d === "string" && d < yesterday)) return "That date is in the past";
  }
  switch (a.type) {
    case "create_task":
      if (!str(a.title)) return "Task needs a title";
      if (!okPri(a.priority) || !okCat(a.category)) return "Bad priority/category";
      if (!okDate(a.due_date) || !okDate(a.scheduled_date) || !okTime(a.due_time))
        return "Bad date format";
      return null;
    case "update_task":
    case "complete_task":
    case "reopen_task":
    case "delete_task":
      if (!data.tasks.some((t) => t.id === a.task_id)) return "That task doesn't exist";
      if (a.type === "update_task") {
        if (!okDate(a.due_date) || !okDate(a.scheduled_date) || !okTime(a.due_time))
          return "Bad date format";
        if (a.priority !== null && !okPri(a.priority)) return "Bad priority";
        if (a.category !== null && !okCat(a.category)) return "Bad category";
      }
      return null;
    case "create_event":
      if (!str(a.title)) return "Event needs a title";
      if (!DATETIME.test(a.start) || !DATETIME.test(a.end)) return "Bad time format";
      if (a.end <= a.start) return "Event ends before it starts";
      if (!okCat(a.category)) return "Bad category";
      return null;
    case "set_event":
      if (!data.events.some((e) => e.id === a.event_id)) return "That event doesn't exist";
      if (!str(a.title)) return "Event needs a title";
      if (!DATETIME.test(a.start) || !DATETIME.test(a.end)) return "Bad time format";
      if (a.end <= a.start) return "Event ends before it starts";
      return okCat(a.category) ? null : "Bad category";
    case "update_event":
    case "delete_event":
      if (!data.events.some((e) => e.id === a.event_id)) return "That event doesn't exist";
      if (a.type === "update_event") {
        if (a.start !== null && !DATETIME.test(a.start)) return "Bad time format";
        if (a.end !== null && !DATETIME.test(a.end)) return "Bad time format";
      }
      return null;
    case "create_project":
      return str(a.name) && okDate(a.target_date) ? null : "Project needs a name";
    case "create_note":
      return str(a.title) && okCat(a.category) ? null : "Note needs a title";
    default:
      return "Unknown action";
  }
}

function findProjectId(data: Snapshot, name: string | null): string | null {
  if (!name) return null;
  const n = name.trim().toLowerCase();
  return (
    data.projects.find((p) => p.name.toLowerCase() === n)?.id ??
    data.projects.find((p) => p.name.toLowerCase().includes(n))?.id ??
    null
  );
}

/** Pure: apply actions in order and return the new snapshot. */
export function applyActions(
  data: Snapshot,
  actions: Action[],
  source: "manual" | "ai",
  nowIso: string,
): Snapshot {
  let { tasks, events, projects, notes } = data;
  for (const a of actions) {
    const snap = { tasks, events, projects, notes };
    switch (a.type) {
      case "create_task": {
        const t: Task = {
          id: uid(),
          title: a.title.trim(),
          description: a.description,
          status: "todo",
          priority: a.priority,
          kind: a.kind,
          category: a.category,
          dueDate: a.due_date,
          dueTime: a.due_time,
          scheduledDate: a.scheduled_date,
          projectId: findProjectId(snap, a.project_name),
          source,
          createdAt: nowIso,
          updatedAt: nowIso,
          completedAt: null,
        };
        tasks = [...tasks, t];
        break;
      }
      case "update_task":
        tasks = tasks.map((t) =>
          t.id !== a.task_id
            ? t
            : {
                ...t,
                title: a.title ?? t.title,
                priority: a.priority ?? t.priority,
                category: a.category ?? t.category,
                dueDate: a.due_date ?? t.dueDate,
                dueTime: a.due_time ?? t.dueTime,
                scheduledDate: a.scheduled_date ?? t.scheduledDate,
                updatedAt: nowIso,
              },
        );
        break;
      case "complete_task":
        tasks = tasks.map((t) =>
          t.id === a.task_id
            ? { ...t, status: "done", completedAt: nowIso, updatedAt: nowIso }
            : t,
        );
        break;
      case "reopen_task":
        tasks = tasks.map((t) =>
          t.id === a.task_id ? { ...t, status: "todo", completedAt: null, updatedAt: nowIso } : t,
        );
        break;
      case "delete_task":
        tasks = tasks.filter((t) => t.id !== a.task_id);
        events = events.map((e) => (e.taskId === a.task_id ? { ...e, taskId: null } : e));
        break;
      case "create_event": {
        const e: CalendarEvent = {
          id: uid(),
          title: a.title.trim(),
          description: null,
          start: a.start,
          end: a.end,
          location: a.location,
          category: a.category,
          recurrence: a.recurrence,
          taskId: a.task_id && tasks.some((t) => t.id === a.task_id) ? a.task_id : null,
          source,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        events = [...events, e];
        break;
      }
      case "update_event":
        events = events.map((e) =>
          e.id !== a.event_id
            ? e
            : {
                ...e,
                title: a.title ?? e.title,
                start: a.start ?? e.start,
                end: a.end ?? e.end,
                location: a.location ?? e.location,
                updatedAt: nowIso,
              },
        );
        break;
      case "set_event":
        events = events.map((e) =>
          e.id !== a.event_id
            ? e
            : {
                ...e,
                title: a.title.trim(),
                start: a.start,
                end: a.end,
                location: a.location,
                description: a.description,
                category: a.category,
                recurrence: a.recurrence,
                updatedAt: nowIso,
              },
        );
        break;
      case "delete_event":
        events = events.filter((e) => e.id !== a.event_id);
        break;
      case "create_project": {
        const p: Project = {
          id: uid(),
          name: a.name.trim(),
          description: a.description,
          status: "active",
          startDate: nowIso.slice(0, 10),
          targetDate: a.target_date,
          notes: null,
          source,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        projects = [...projects, p];
        break;
      }
      case "create_note": {
        const n: Note = {
          id: uid(),
          title: a.title.trim(),
          content: a.content,
          category: a.category,
          projectId: findProjectId(snap, a.project_name),
          source,
          createdAt: nowIso,
        };
        notes = [...notes, n];
        break;
      }
    }
  }
  return { tasks, events, projects, notes };
}

/** Human-readable one-liner for a confirm card. */
export function describeAction(a: Action, data: Snapshot): { verb: string; detail: string } {
  const task = (id: string) => data.tasks.find((t) => t.id === id)?.title ?? "a task";
  const ev = (id: string) => data.events.find((e) => e.id === id)?.title ?? "an event";
  switch (a.type) {
    case "create_task":
      return { verb: a.kind === "deadline" ? "Add deadline" : "Add task", detail: a.title };
    case "update_task":
      return { verb: "Update", detail: task(a.task_id) };
    case "complete_task":
      return { verb: "Complete", detail: task(a.task_id) };
    case "reopen_task":
      return { verb: "Reopen", detail: task(a.task_id) };
    case "delete_task":
      return { verb: "Delete task", detail: task(a.task_id) };
    case "create_event":
      return { verb: a.task_id ? "Block time" : "Add event", detail: a.title };
    case "update_event":
      return { verb: "Move event", detail: ev(a.event_id) };
    case "set_event":
      return { verb: "Edit event", detail: a.title };
    case "delete_event":
      return { verb: "Remove event", detail: ev(a.event_id) };
    case "create_project":
      return { verb: "New project", detail: a.name };
    case "create_note":
      return { verb: "Save note", detail: a.title };
  }
}

/** Consequential = destroys or rewrites existing data. */
export const isDestructive = (a: Action) =>
  a.type === "delete_task" || a.type === "delete_event";
