"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, toDateKey } from "@/lib/dates";
import { CATEGORIES, PRIORITIES, type Category, type Priority, type Task, type TaskKind } from "@/lib/types";
import { CATEGORY_META, PRIORITY_META } from "./meta";
import { useUI } from "./ui-store";

interface Draft {
  title: string;
  description: string;
  priority: Priority;
  category: Category;
  kind: TaskKind;
  dueDate: string;
  dueTime: string;
  scheduledDate: string;
  projectId: string;
}

const field =
  "w-full rounded-xl border border-line bg-white/[0.025] px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-line-strong";

function initialDraft(task: Task | null | undefined): Draft {
  return task
    ? {
        title: task.title,
        description: task.description ?? "",
        priority: task.priority,
        category: task.category,
        kind: task.kind,
        dueDate: task.dueDate ?? "",
        dueTime: task.dueTime ?? "",
        scheduledDate: task.scheduledDate ?? "",
        projectId: task.projectId ?? "",
      }
    : {
        title: "",
        description: "",
        priority: "normal",
        category: "academic",
        kind: "task",
        dueDate: "",
        dueTime: "",
        scheduledDate: toDateKey(new Date()),
        projectId: "",
      };
}

export function TaskEditor() {
  const id = useUI((s) => s.editingTaskId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && useUI.getState().editTask(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return <AnimatePresence>{id && <EditorDialog key={id} id={id} />}</AnimatePresence>;
}

function EditorDialog({ id }: { id: string }) {
  const close = () => useUI.getState().editTask(null);
  const toast = useUI((s) => s.toast);
  const tasks = useStore((s) => s.tasks);
  const projects = useStore((s) => s.projects);
  const commit = useStore((s) => s.commit);
  const task = id !== "new" ? tasks.find((t) => t.id === id) : null;
  const [d, setD] = useState<Draft>(() => initialDraft(task));

  const save = () => {
    if (!d.title.trim()) return;
    const n = (s: string) => (s ? s : null);
    const projectName = projects.find((p) => p.id === d.projectId)?.name ?? null;
    if (task) {
      commit(
        [
          {
            type: "update_task",
            task_id: task.id,
            title: d.title,
            priority: d.priority,
            category: d.category,
            due_date: n(d.dueDate),
            due_time: n(d.dueTime),
            scheduled_date: n(d.scheduledDate),
          },
        ],
        { label: `Edited "${d.title}"`, by: "you" },
      );
      // update_task merges nulls as "unchanged", so clear fields explicitly when emptied.
      useStore.setState((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === task.id
            ? {
                ...t,
                description: n(d.description),
                kind: d.kind,
                projectId: n(d.projectId),
                dueDate: n(d.dueDate),
                dueTime: n(d.dueTime),
                scheduledDate: n(d.scheduledDate),
              }
            : t,
        ),
      }));
      toast({ text: "Task updated", undo: true });
    } else {
      commit(
        [
          {
            type: "create_task",
            title: d.title,
            description: n(d.description),
            priority: d.priority,
            kind: d.kind,
            category: d.category,
            due_date: n(d.dueDate),
            due_time: n(d.dueTime),
            scheduled_date: n(d.scheduledDate),
            project_name: projectName,
          },
        ],
        { label: `Added "${d.title}"`, by: "you" },
      );
      toast({ text: "Task added", undo: true });
    }
    close();
  };

  const remove = () => {
    if (!task) return;
    commit([{ type: "delete_task", task_id: task.id }], { label: `Deleted "${task.title}"`, by: "you" });
    toast({ text: `Deleted "${task.title}"`, undo: true });
    close();
  };

  const quick = (days: number) => setD({ ...d, scheduledDate: toDateKey(addDays(new Date(), days)) });

  return (
        <motion.div
          className="fixed inset-0 z-40 grid place-items-end bg-black/50 p-3 backdrop-blur-sm sm:place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <motion.form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="glass w-full max-w-lg rounded-3xl p-5 sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="eyebrow">{task ? "Edit task" : "New task"}</span>
              <button type="button" onClick={close} aria-label="Close" className="text-ink-3 hover:text-ink">
                <X size={18} />
              </button>
            </div>

            <input
              autoFocus
              value={d.title}
              onChange={(e) => setD({ ...d, title: e.target.value })}
              placeholder="What needs doing?"
              className="mb-3 w-full bg-transparent font-display text-[28px] leading-tight text-ink outline-none placeholder:text-ink-4"
            />
            <textarea
              value={d.description}
              onChange={(e) => setD({ ...d, description: e.target.value })}
              placeholder="Notes (optional)"
              rows={2}
              className={`${field} mb-4 resize-none`}
            />

            <div className="mb-4 flex flex-wrap gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setD({ ...d, priority: p })}
                  className="rounded-full border px-3 py-1 text-xs transition-colors"
                  style={{
                    borderColor: d.priority === p ? PRIORITY_META[p].color : "var(--line)",
                    color: d.priority === p ? "var(--ink)" : "var(--ink-3)",
                    background: d.priority === p ? "rgba(255,255,255,0.04)" : "transparent",
                  }}
                >
                  {PRIORITY_META[p].label}
                </button>
              ))}
              <span className="mx-1 w-px bg-line" />
              {(["task", "deadline"] as const).map((k) => (
                <button
                  type="button"
                  key={k}
                  onClick={() => setD({ ...d, kind: k })}
                  className={`rounded-full border px-3 py-1 text-xs capitalize transition-colors ${d.kind === k ? "border-line-strong bg-white/[0.04] text-ink" : "border-line text-ink-3"}`}
                >
                  {k}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-1.5">
                <span className="eyebrow">Category</span>
                <select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as Category })} className={field}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-raise">
                      {CATEGORY_META[c].label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="eyebrow">Project</span>
                <select value={d.projectId} onChange={(e) => setD({ ...d, projectId: e.target.value })} className={field}>
                  <option value="" className="bg-raise">None</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id} className="bg-raise">
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="eyebrow">Due</span>
                <input type="date" value={d.dueDate} onChange={(e) => setD({ ...d, dueDate: e.target.value })} className={field} />
              </label>
              <label className="space-y-1.5">
                <span className="eyebrow">Due time</span>
                <input type="time" value={d.dueTime} onChange={(e) => setD({ ...d, dueTime: e.target.value })} className={field} />
              </label>
              <label className="col-span-2 space-y-1.5">
                <span className="eyebrow">Work on it</span>
                <div className="flex gap-2">
                  <input type="date" value={d.scheduledDate} onChange={(e) => setD({ ...d, scheduledDate: e.target.value })} className={field} />
                  <button type="button" onClick={() => quick(0)} className="rounded-xl border border-line px-3 text-xs text-ink-2 hover:text-ink">Today</button>
                  <button type="button" onClick={() => quick(1)} className="rounded-xl border border-line px-3 text-xs text-ink-2 hover:text-ink">Tmrw</button>
                </div>
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between">
              {task ? (
                <button type="button" onClick={remove} className="flex items-center gap-1.5 text-xs text-ink-3 transition-colors hover:text-coral">
                  <Trash2 size={14} /> Delete
                </button>
              ) : (
                <span />
              )}
              <button
                type="submit"
                disabled={!d.title.trim()}
                className="rounded-xl bg-gold px-5 py-2 text-sm font-medium text-[#14110a] transition-opacity disabled:opacity-40"
              >
                {task ? "Save" : "Add task"}
              </button>
            </div>
          </motion.form>
        </motion.div>
  );
}
