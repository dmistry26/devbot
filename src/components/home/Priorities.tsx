"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { groupTasks, todaysTasks } from "@/lib/derive";
import { addDays, formatTime, relativeDay, toDateKey } from "@/lib/dates";
import type { Task } from "@/lib/types";
import { Check, CategoryTag, PriorityBars, SectionHeader } from "@/components/ui/primitives";
import { useUI } from "@/components/ui/ui-store";

export function TaskRow({ task, now }: { task: Task; now: Date }) {
  const commit = useStore((s) => s.commit);
  const projects = useStore((s) => s.projects);
  const toast = useUI((s) => s.toast);
  const editTask = useUI((s) => s.editTask);
  const project = projects.find((p) => p.id === task.projectId);
  const done = task.status === "done";
  const today = toDateKey(now);
  const overdue = !done && task.dueDate !== null && task.dueDate < today;

  const toggle = () => {
    // Read fresh state so a double click can't complete/reopen twice.
    const current = useStore.getState().tasks.find((t) => t.id === task.id);
    if (!current || current.status !== task.status) return;
    if (done) {
      commit([{ type: "reopen_task", task_id: task.id }], { label: `Reopened "${task.title}"`, by: "you" });
    } else {
      commit([{ type: "complete_task", task_id: task.id }], { label: `Completed "${task.title}"`, by: "you" });
      toast({ text: `Done — ${task.title}`, undo: true });
    }
  };

  const tomorrow = () => {
    const d = toDateKey(addDays(now, 1));
    commit(
      [{ type: "update_task", task_id: task.id, title: null, priority: null, category: null, due_date: null, due_time: null, scheduled_date: d }],
      { label: `Moved "${task.title}" to tomorrow`, by: "you" },
    );
    toast({ text: `Moved to tomorrow`, undo: true });
  };

  const remove = () => {
    commit([{ type: "delete_task", task_id: task.id }], { label: `Deleted "${task.title}"`, by: "you" });
    toast({ text: `Deleted "${task.title}"`, undo: true });
  };

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex items-start gap-3.5 rounded-2xl px-3 py-3 transition-colors hover:bg-white/[0.025]"
    >
      <div className="pt-[1px]">
        <Check checked={done} onChange={toggle} label={`Complete ${task.title}`} />
      </div>
      <button onClick={() => editTask(task.id)} className="min-w-0 flex-1 text-left">
        <div className={`truncate text-[15px] leading-snug transition-colors ${done ? "text-ink-4 line-through decoration-ink-4" : "text-ink"}`}>
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <CategoryTag category={task.category} label={project?.name} />
          {task.dueDate && (
            <span className={`tabular text-[11.5px] ${overdue ? "text-coral" : "text-ink-3"}`}>
              {task.kind === "deadline" ? "Due " : ""}
              {relativeDay(task.dueDate, now)}
              {task.dueTime ? ` · ${formatTime(task.dueTime)}` : ""}
            </span>
          )}
          {task.source === "ai" && <span className="text-[11px] text-ice/80">via devbot</span>}
          {task.source === "school" && <span className="text-[11px] text-ice/80">from school</span>}
        </div>
      </button>
      <div className="flex items-center gap-1 pt-1">
        {!done && (
          <div className="hidden items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 md:flex">
            <IconBtn label="Edit" onClick={() => editTask(task.id)}><Pencil size={13} /></IconBtn>
            <IconBtn label="Move to tomorrow" onClick={tomorrow}><ArrowRight size={13} /></IconBtn>
            <IconBtn label="Delete" onClick={remove} danger><Trash2 size={13} /></IconBtn>
          </div>
        )}
        <span className="ml-1.5"><PriorityBars priority={task.priority} /></span>
      </div>
    </motion.li>
  );
}

function IconBtn({ children, label, onClick, danger }: { children: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid size-7 place-items-center rounded-lg text-ink-3 transition-colors hover:bg-white/[0.05] ${danger ? "hover:text-coral" : "hover:text-ink"}`}
    >
      {children}
    </button>
  );
}

function Group({ title, hint, tasks, now, accent }: { title: string; hint?: string; tasks: Task[]; now: Date; accent?: string }) {
  if (!tasks.length) return null;
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2 px-3">
        {accent && <span className="size-1.5 translate-y-[-1px] rounded-full" style={{ background: accent, boxShadow: `0 0 8px ${accent}` }} />}
        <span className="text-[12.5px] font-medium text-ink-2">{title}</span>
        {hint && <span className="text-[11.5px] text-ink-4">{hint}</span>}
        <span className="tabular ml-auto text-[11px] text-ink-4">{tasks.length}</span>
      </div>
      <ul>
        <AnimatePresence initial={false}>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} now={now} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

export function Priorities({ now, onLoadSample }: { now: Date; onLoadSample: () => void }) {
  const tasks = useStore((s) => s.tasks);
  const total = useStore((s) => s.tasks.length + s.events.length);
  const editTask = useUI((s) => s.editTask);
  const openCommand = useUI((s) => s.openCommand);
  const [showDone, setShowDone] = useState(false);
  const today = toDateKey(now);
  const g = groupTasks(todaysTasks(tasks, today), today);
  const openCount = g.focus.length + g.next.length + g.later.length;

  return (
    <section className="panel p-3 sm:p-4">
      <div className="px-3 pt-2">
        <SectionHeader
          label="Today's priorities"
          right={
            <button
              onClick={() => editTask("new")}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-3 transition-colors hover:bg-white/[0.04] hover:text-ink"
            >
              <Plus size={13} /> Task
            </button>
          }
        />
      </div>

      {total === 0 ? (
        <div className="px-3 pb-6 pt-4">
          <p className="font-display text-[26px] leading-tight text-ink">
            Nothing here yet. <em className="text-ink-2">Tell me what&apos;s on your plate.</em>
          </p>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-3">
            Paste a messy list of everything you have going on — tests, practices, projects — and devbot will sort it into tasks and events for you to approve.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => openCommand("Brain dump: ")}
              className="ai-ring rounded-xl px-4 py-2 text-sm text-ink transition-colors hover:bg-white/[0.04]"
            >
              Start a brain dump
            </button>
            <button onClick={() => editTask("new")} className="rounded-xl border border-line px-4 py-2 text-sm text-ink-2 hover:text-ink">
              Add a task
            </button>
            <button onClick={onLoadSample} className="rounded-xl px-4 py-2 text-sm text-ink-3 hover:text-ink-2">
              Preview with sample data
            </button>
          </div>
        </div>
      ) : openCount === 0 && g.done.length === 0 ? (
        <div className="px-3 pb-6 pt-2 text-sm text-ink-3">Nothing scheduled for today. Enjoy it — or pull something forward.</div>
      ) : (
        <div className="space-y-4">
          {openCount === 0 && (
            <div className="px-3 py-3">
              <p className="font-display text-2xl text-ink">All clear for today.</p>
              <p className="mt-1 text-sm text-ink-3">Everything on today&apos;s list is done.</p>
            </div>
          )}
          <Group title="Focus" hint="highest impact" tasks={g.focus} now={now} accent="var(--coral)" />
          <Group title="Up next" tasks={g.next} now={now} accent="var(--gold)" />
          <Group title="If there's time" tasks={g.later} now={now} accent="var(--ink-4)" />
          {g.done.length > 0 && (
            <div>
              <button onClick={() => setShowDone((v) => !v)} className="flex w-full items-center gap-2 px-3 py-1 text-[12.5px] text-ink-3 hover:text-ink-2">
                <ChevronDown size={13} className={`transition-transform ${showDone ? "" : "-rotate-90"}`} />
                Completed <span className="tabular ml-auto text-[11px] text-ink-4">{g.done.length}</span>
              </button>
              {showDone && (
                <ul>
                  {g.done.map((t) => (
                    <TaskRow key={t.id} task={t} now={now} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
