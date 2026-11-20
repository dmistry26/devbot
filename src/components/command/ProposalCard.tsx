"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, CalendarPlus, FolderPlus, ListPlus, NotebookPen, PenLine, Trash2, Undo2, CircleCheck, RotateCcw } from "lucide-react";
import { describeAction, isDestructive, validateAction, type Action } from "@/lib/actions";
import { formatTime, relativeDay, timeOf, toDateKey } from "@/lib/dates";
import { snapshotOf, useStore } from "@/lib/store";
import { findConflicts } from "@/lib/calendar";
import type { CalendarEvent } from "@/lib/types";
import { useUI } from "@/components/ui/ui-store";
import type { ProposalState } from "./chat-store";

const ICON: Record<Action["type"], typeof ListPlus> = {
  create_task: ListPlus,
  update_task: PenLine,
  complete_task: CircleCheck,
  reopen_task: RotateCcw,
  delete_task: Trash2,
  create_event: CalendarPlus,
  update_event: PenLine,
  set_event: PenLine,
  delete_event: Trash2,
  create_project: FolderPlus,
  create_note: NotebookPen,
};

function subline(a: Action, now: Date): string | null {
  switch (a.type) {
    case "create_task": {
      const parts: string[] = [a.priority];
      if (a.due_date) parts.push(`due ${relativeDay(a.due_date, now).toLowerCase()}${a.due_time ? " " + formatTime(a.due_time) : ""}`);
      if (a.scheduled_date) parts.push(`work on ${relativeDay(a.scheduled_date, now).toLowerCase()}`);
      if (a.project_name) parts.push(a.project_name);
      return parts.join(" · ");
    }
    case "update_task": {
      const parts: string[] = [];
      if (a.title) parts.push(`rename → ${a.title}`);
      if (a.priority) parts.push(`priority → ${a.priority}`);
      if (a.due_date) parts.push(`due → ${relativeDay(a.due_date, now).toLowerCase()}`);
      if (a.due_time) parts.push(`at ${formatTime(a.due_time)}`);
      if (a.scheduled_date) parts.push(`work on → ${relativeDay(a.scheduled_date, now).toLowerCase()}`);
      return parts.join(" · ") || null;
    }
    case "create_event":
      return `${relativeDay(a.start.slice(0, 10), now)} ${formatTime(timeOf(a.start))}–${formatTime(timeOf(a.end))}${a.recurrence ? ` · repeats ${a.recurrence.freq}` : ""}${a.location ? ` · ${a.location}` : ""}`;
    case "update_event":
      return a.start ? `→ ${relativeDay(a.start.slice(0, 10), now)} ${formatTime(timeOf(a.start))}` : null;
    case "create_project":
      return a.target_date ? `target ${relativeDay(a.target_date, now).toLowerCase()}` : null;
    default:
      return null;
  }
}

/** Name of an existing event a proposed event/move would overlap, if any. */
function clashFor(a: Action, events: CalendarEvent[]): string | null {
  if (a.type === "create_event") {
    if (a.task_id) return null; // focus blocks are planned around existing events
    const c = findConflicts({ start: a.start, end: a.end, recurrence: a.recurrence }, events);
    return c.length ? c.map((x) => x.event.title).slice(0, 2).join(", ") : null;
  }
  if (a.type === "update_event" && (a.start || a.end)) {
    const ev = events.find((e) => e.id === a.event_id);
    if (!ev) return null;
    const c = findConflicts({ id: ev.id, start: a.start ?? ev.start, end: a.end ?? ev.end, recurrence: ev.recurrence }, events);
    return c.length ? c.map((x) => x.event.title).slice(0, 2).join(", ") : null;
  }
  return null;
}

export function ProposalCard({
  actions,
  state,
  onResolve,
}: {
  actions: Action[];
  state: ProposalState;
  onResolve: (s: ProposalState) => void;
}) {
  const [entryId, setEntryId] = useState<string | null>(null);
  const canUndo = useStore((s) => s.history[0]?.id === entryId);
  const data = useStore();
  const commit = useStore((s) => s.commit);
  const undo = useStore((s) => s.undo);
  const toast = useUI((s) => s.toast);
  const snap = snapshotOf(data);
  const now = new Date();
  const checked = actions.map((a) => validateAction(a, snap, toDateKey(now)));
  const [on, setOn] = useState(() => actions.map((_, i) => checked[i] === null));
  const selected = actions.filter((_, i) => on[i] && checked[i] === null);

  const apply = () => {
    if (!selected.length) return;
    const label = selected.length === 1 ? `${describeAction(selected[0], snap).verb}: ${describeAction(selected[0], snap).detail}` : `${selected.length} changes from devbot`;
    setEntryId(commit(selected, { label, by: "ai" }));
    onResolve("applied");
    toast({ text: selected.length === 1 ? label : `Applied ${selected.length} changes`, undo: true });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 overflow-hidden rounded-2xl border border-line-strong bg-white/[0.02]"
    >
      <ul className="divide-y divide-line">
        {actions.map((a, i) => {
          const d = describeAction(a, snap);
          const Icon = ICON[a.type] ?? ListPlus;
          const err = checked[i];
          const danger = isDestructive(a);
          const sub = subline(a, now);
          const clash = !err ? clashFor(a, snap.events) : null;
          return (
            <li key={i}>
              <label className={`flex items-start gap-3 px-3.5 py-2.5 ${state === "pending" && !err ? "cursor-pointer hover:bg-white/[0.02]" : ""}`}>
                {state === "pending" && (
                  <input
                    type="checkbox"
                    disabled={!!err}
                    checked={on[i] && !err}
                    onChange={() => setOn(on.map((v, j) => (j === i ? !v : v)))}
                    className="mt-1 size-3.5 accent-[#e9c27d]"
                  />
                )}
                <Icon size={14} className={`mt-[3px] shrink-0 ${danger ? "text-coral" : "text-ice"}`} />
                <span className="min-w-0 flex-1">
                  <span className="text-[13px] text-ink">
                    <span className={danger ? "text-coral" : "text-ink-2"}>{d.verb}</span> {d.detail}
                  </span>
                  {sub && <span className="mt-0.5 block text-[11.5px] text-ink-3">{sub}</span>}
                  {clash && <span className="mt-0.5 block text-[11.5px] text-amber">Overlaps {clash}</span>}
                  {err && <span className="mt-0.5 block text-[11.5px] text-coral">Can&apos;t apply: {err}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-line bg-white/[0.015] px-3.5 py-2.5">
        {state === "pending" ? (
          <>
            <button onClick={() => onResolve("discarded")} className="text-xs text-ink-3 hover:text-ink-2">Discard</button>
            <button
              onClick={apply}
              disabled={!selected.length}
              className="flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-xs font-medium text-[#14110a] disabled:opacity-40"
            >
              <Check size={13} /> Apply {selected.length} {selected.length === 1 ? "change" : "changes"}
            </button>
          </>
        ) : state === "applied" ? (
          <>
            <span className="flex items-center gap-1.5 text-xs text-sage"><Check size={13} /> Applied</span>
            {canUndo && <button
              onClick={() => {
                const e = undo();
                if (e) {
                  onResolve("discarded");
                  toast({ text: `Undid: ${e.label}` });
                }
              }}
              className="flex items-center gap-1 text-xs text-ink-3 hover:text-ink"
            >
              <Undo2 size={12} /> Undo
            </button>}
          </>
        ) : (
          <span className="text-xs text-ink-4">Not applied</span>
        )}
      </div>
    </motion.div>
  );
}
