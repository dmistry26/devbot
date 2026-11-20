// Pure merge of imported school homework into the task list.
import type { Task } from "@/lib/types";
import type { SchoolItem } from "./types";

export interface MergeResult {
  tasks: Task[];
  added: number;
  updated: number;
}

/** Bare test names get the class added ("Test" → "AP US History test"); the class shows as a label otherwise. */
export function schoolTitle(item: SchoolItem) {
  const t = item.title.trim();
  if (/^((unit|chapter|module)\s*\d+\s+)?(test|quiz|exam|midterm|final|group quiz|unit test)$/i.test(t)) return `${item.courseName} ${t.toLowerCase()}`;
  return t;
}

/** Homework goes on your list the day before it's due (or today, if that's later). Tests stay on the horizon. */
function planDay(item: SchoolItem, today: string): string | null {
  if (item.kind === "deadline" || !item.dueDate) return item.kind === "deadline" ? null : today;
  const [y, m, d] = item.dueDate.split("-").map(Number);
  const prev = new Date(y, m - 1, d - 1);
  const key = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-${String(prev.getDate()).padStart(2, "0")}`;
  return key < today ? today : key;
}

const testType = (s: string) => (/\b(midterm|final|exam)/i.test(s) ? "exam" : /\bquiz/i.test(s) ? "quiz" : /\btest/i.test(s) ? "test" : null);
const dayDiff = (a: string, b: string) => {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.abs(Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) / 86_400_000;
};

/**
 * A test imported earlier may have a different id (ids changed as parsing got
 * smarter, or the date moved). Treat the same class + kind of test within 3 days
 * (quizzes) or 8 days (tests/exams) as the same test, so it updates instead of duplicating.
 */
function findSameTest(tasks: Task[], item: SchoolItem, claimed: Set<string>): Task | undefined {
  if (item.kind !== "deadline" || !item.dueDate) return undefined;
  const type = testType(item.title);
  return tasks.find(
    (t) =>
      !claimed.has(t.id) &&
      t.source === "school" &&
      t.kind === "deadline" &&
      t.context === item.courseName &&
      t.dueDate !== null &&
      testType(t.title) === type &&
      // Quizzes can be weekly, so only match nearby ones; a test that moves a week is still the same test.
      dayDiff(t.dueDate, item.dueDate!) <= (type === "quiz" ? 3 : 8),
  );
}

/** Was this test deleted before, possibly under an older id for the same class/week/type? */
function wasDismissed(item: SchoolItem, dismissed: Set<string>): boolean {
  if (dismissed.has(item.externalId)) return true;
  if (item.kind !== "deadline") return false;
  const m = item.externalId.match(/^(vcs:\d+:deadline:)([^:]+):(\w+)$/);
  if (!m) return false;
  const [, prefix, type, week] = m;
  for (const id of dismissed) {
    if (id.startsWith(prefix) && id.endsWith(`:${week}`) && id.slice(prefix.length).includes(type)) return true;
  }
  return false;
}

export function mergeSchoolItems(
  tasks: Task[],
  items: SchoolItem[],
  dismissed: Set<string>,
  nowIso: string,
  today: string,
): MergeResult {
  const byExt = new Map(tasks.filter((t) => t.externalId).map((t) => [t.externalId!, t]));
  let added = 0;
  let updated = 0;
  const changes = new Map<string, Task>();
  const created: Task[] = [];
  const claimed = new Set<string>();

  for (const item of items) {
    if (wasDismissed(item, dismissed)) continue;
    const title = schoolTitle(item) + (item.note ? " (check date)" : "");
    let existing = byExt.get(item.externalId);
    if (!existing) {
      const same = findSameTest(tasks, item, claimed);
      if (same && same.externalId && dismissed.has(same.externalId)) continue;
      if (same) {
        existing = same;
        // Adopt the new id so future syncs match directly.
        if (same.externalId !== item.externalId) {
          changes.set(same.id, { ...(changes.get(same.id) ?? same), externalId: item.externalId });
        }
      }
    }
    if (existing) {
      claimed.add(existing.id);
      // Don't touch finished work or anything you've edited by hand since import.
      if (existing.status === "done" || existing.updatedAt > existing.createdAt) continue;
      const base = changes.get(existing.id) ?? existing;
      if (existing.title !== title || existing.context !== item.courseName || existing.dueDate !== item.dueDate || (existing.dueTime ?? null) !== (item.dueTime ?? null)) {
        changes.set(existing.id, {
          ...base,
          title,
          dueDate: item.dueDate,
          dueTime: item.dueTime ?? null,
          context: item.courseName,
          kind: item.kind,
          scheduledDate: planDay(item, today),
          updatedAt: existing.createdAt,
        });
        updated++;
      }
      continue;
    }
    created.push({
      id: crypto.randomUUID(),
      title,
      description: `From ${item.courseName} lesson plan${item.assignedDate ? ` (${item.assignedDate})` : ""}${item.note ? `. ${item.note}` : ""}`,
      status: "todo",
      priority: item.priority,
      kind: item.kind,
      category: "academic",
      dueDate: item.dueDate,
      dueTime: item.dueTime ?? null,
      scheduledDate: planDay(item, today),
      projectId: null,
      source: "school",
      externalId: item.externalId,
      context: item.courseName,
      sourceUrl: item.sourceUrl,
      createdAt: nowIso,
      updatedAt: nowIso,
      completedAt: null,
    });
    added++;
  }

  if (!added && !updated) return { tasks, added, updated };
  return { tasks: [...tasks.map((t) => changes.get(t.id) ?? t), ...created], added, updated };
}
