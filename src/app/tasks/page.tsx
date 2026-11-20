"use client";

import { Plus } from "lucide-react";
import { useNow, useStore } from "@/lib/store";
import { addDays, relativeDay, toDateKey } from "@/lib/dates";
import { PRIORITY_ORDER, type Task } from "@/lib/types";
import { TaskRow } from "@/components/home/Priorities";
import { PageHeader } from "@/components/ui/PageHeader";
import { useUI } from "@/components/ui/ui-store";

export default function TasksPage() {
  const now = useNow();
  const tasks = useStore((s) => s.tasks);
  const editTask = useUI((s) => s.editTask);
  if (!now) return null;

  const today = toDateKey(now);
  const week = toDateKey(addDays(now, 7));
  const open = tasks
    .filter((t) => t.status === "todo")
    .sort((a, b) => (a.scheduledDate ?? a.dueDate ?? "9").localeCompare(b.scheduledDate ?? b.dueDate ?? "9") || PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  const day = (t: Task) => t.scheduledDate ?? t.dueDate;
  const buckets: [string, Task[]][] = [
    ["Today & overdue", open.filter((t) => day(t) !== null && day(t)! <= today)],
    ["This week", open.filter((t) => day(t) !== null && day(t)! > today && day(t)! <= week)],
    ["Later", open.filter((t) => day(t) !== null && day(t)! > week)],
    ["Someday", open.filter((t) => day(t) === null)],
  ];
  const done = tasks.filter((t) => t.status === "done").slice(-20).reverse();

  return (
    <div className="mx-auto max-w-[860px] px-4 pt-6 sm:px-8 md:pt-12">
      <PageHeader eyebrow="Tasks" title={<>Everything on your <em>plate</em>.</>}>
        {open.length} open · {done.length ? `${tasks.filter((t) => t.status === "done").length} done` : "nothing done yet"}
      </PageHeader>
      <button onClick={() => editTask("new")} className="mb-6 flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-ink-2 hover:text-ink">
        <Plus size={14} /> New task
      </button>
      <div className="space-y-5">
        {buckets.map(([label, list]) =>
          list.length ? (
            <section key={label} className="panel p-3">
              <div className="flex items-baseline justify-between px-3 pb-1 pt-2">
                <h2 className="eyebrow">{label}</h2>
                <span className="tabular text-[11px] text-ink-4">{list.length}</span>
              </div>
              <ul>
                {list.map((t) => (
                  <div key={t.id} className="relative">
                    {label !== "Today & overdue" && day(t) && (
                      <span className="pointer-events-none absolute right-14 top-3.5 hidden text-[11px] text-ink-4 sm:block">{relativeDay(day(t)!, now)}</span>
                    )}
                    <TaskRow task={t} now={now} />
                  </div>
                ))}
              </ul>
            </section>
          ) : null,
        )}
        {done.length > 0 && (
          <section className="panel p-3 opacity-80">
            <h2 className="eyebrow px-3 pb-1 pt-2">Recently completed</h2>
            <ul>
              {done.map((t) => (
                <TaskRow key={t.id} task={t} now={now} />
              ))}
            </ul>
          </section>
        )}
        {open.length === 0 && done.length === 0 && <p className="text-sm text-ink-3">No tasks yet. Press ⌘K and tell devbot what you need to do.</p>}
      </div>
    </div>
  );
}
