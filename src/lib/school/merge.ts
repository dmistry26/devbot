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

  for (const item of items) {
    if (dismissed.has(item.externalId)) continue;
    const title = schoolTitle(item);
    const existing = byExt.get(item.externalId);
    if (existing) {
      // Don't touch finished work or anything you've edited by hand since import.
      if (existing.status === "done" || existing.updatedAt > existing.createdAt) continue;
      if (existing.title !== title || existing.context !== item.courseName || existing.dueDate !== item.dueDate || (existing.dueTime ?? null) !== (item.dueTime ?? null)) {
        changes.set(existing.id, {
          ...existing,
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
      description: `From ${item.courseName} lesson plan${item.assignedDate ? ` (${item.assignedDate})` : ""}`,
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
