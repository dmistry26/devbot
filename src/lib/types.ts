// Core domain types. Dates are stored as local "floating" strings:
//   date:      "YYYY-MM-DD"
//   time:      "HH:mm"
//   datetime:  "YYYY-MM-DDTHH:mm"
// This keeps a single-user app simple. When Supabase is added, these map to
// date / time / timestamptz columns plus the user's IANA timezone.

export type Priority = "urgent" | "high" | "normal" | "low";
export type Category =
  | "academic"
  | "project"
  | "personal"
  | "health"
  | "social"
  | "other";

export type TaskStatus = "todo" | "done";
export type TaskKind = "task" | "deadline";
export type Source = "manual" | "ai" | "school" | "sample";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  kind: TaskKind;
  category: Category;
  dueDate: string | null; // YYYY-MM-DD
  dueTime: string | null; // HH:mm
  scheduledDate: string | null; // the day you plan to work on it
  projectId: string | null;
  source: Source;
  /** Stable id from an import source (e.g. "vcs:<cmid>:<chapter>:<n>"), used to dedupe re-syncs. */
  externalId?: string | null;
  /** Link back to where the task came from, e.g. the Moodle book chapter. */
  sourceUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type RecurrenceFreq = "daily" | "weekdays" | "weekly" | "monthly";
export interface Recurrence {
  freq: RecurrenceFreq;
  until: string | null; // YYYY-MM-DD inclusive
}

export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start: string; // YYYY-MM-DDTHH:mm
  end: string; // YYYY-MM-DDTHH:mm
  location: string | null;
  category: Category;
  recurrence: Recurrence | null;
  taskId: string | null; // set when this is a focus block for a task
  source: Source;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStatus = "active" | "paused" | "done";
export interface Project {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  targetDate: string | null;
  notes: string | null;
  source: Source;
  createdAt: string;
  updatedAt: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  category: Category;
  projectId: string | null;
  source: Source;
  createdAt: string;
}

export interface Profile {
  name: string;
}

export interface Snapshot {
  tasks: Task[];
  events: CalendarEvent[];
  projects: Project[];
  notes: Note[];
}

/** One undoable change, recorded before it was applied. */
export interface HistoryEntry {
  id: string;
  label: string;
  at: string;
  by: "you" | "ai";
  before: Snapshot;
}

export const PRIORITY_ORDER: Record<Priority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export const CATEGORIES: Category[] = [
  "academic",
  "project",
  "personal",
  "health",
  "social",
  "other",
];
export const PRIORITIES: Priority[] = ["urgent", "high", "normal", "low"];
