"use client";

import { Fragment } from "react";
import { motion } from "framer-motion";
import { MapPin, Plus, Repeat, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { addDays, eventsOn, formatTime, minutesBetween, timeOf, toDateKey, toDateTime } from "@/lib/dates";
import type { CalendarEvent, Task } from "@/lib/types";
import { SectionHeader } from "@/components/ui/primitives";
import { CATEGORY_META } from "@/components/ui/meta";
import { useUI } from "@/components/ui/ui-store";

function until(mins: number) {
  if (mins < 60) return `in ${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `in ${h}h${m ? ` ${m}m` : ""}`;
}

type Item =
  | { kind: "event"; at: string; ev: CalendarEvent }
  | { kind: "due"; at: string; task: Task };

function NowLine({ now }: { now: Date }) {
  return (
    <div className="relative my-1 flex items-center gap-3 py-1.5" aria-label="Now">
      <span className="tabular w-[52px] shrink-0 text-right font-mono text-[10.5px] text-gold">
        {formatTime(toDateTime(now).slice(11))}
      </span>
      <span className="relative size-2 shrink-0 rounded-full bg-gold shadow-[0_0_12px_var(--gold)]">
        <span className="absolute inset-0 animate-ping rounded-full bg-gold/60" />
      </span>
      <span className="h-px flex-1 bg-gradient-to-r from-gold/60 to-transparent" />
    </div>
  );
}

function EventRow({ ev, now, past }: { ev: CalendarEvent; now: Date; past: boolean }) {
  const commit = useStore((s) => s.commit);
  const toast = useUI((s) => s.toast);
  const color = CATEGORY_META[ev.category].color;
  const nowStr = toDateTime(now);
  const live = ev.start <= nowStr && ev.end > nowStr;
  const startsIn = minutesBetween(nowStr, ev.start);
  const remove = () => {
    commit([{ type: "delete_event", event_id: ev.id }], { label: `Removed "${ev.title}"`, by: "you" });
    toast({ text: ev.recurrence ? `Removed "${ev.title}" (all repeats)` : `Removed "${ev.title}"`, undo: true });
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: past ? 0.38 : 1, x: 0 }}
      className="group flex items-stretch gap-3"
    >
      <div className="tabular w-[52px] shrink-0 pt-2.5 text-right font-mono text-[10.5px] leading-tight text-ink-3">
        {formatTime(timeOf(ev.start))}
        <div className="text-ink-4">{formatTime(timeOf(ev.end))}</div>
      </div>
      <div className="relative flex w-2 shrink-0 justify-center">
        <span className="absolute inset-y-0 w-px bg-line" />
        <span className="relative mt-3 size-2 rounded-full border" style={{ borderColor: color, background: live ? color : "var(--bg)" }} />
      </div>
      <div
        className="relative mb-2 min-w-0 flex-1 overflow-hidden rounded-xl border px-3.5 py-2.5 transition-colors"
        style={{
          borderColor: live ? `color-mix(in srgb, ${color} 45%, transparent)` : "var(--line)",
          background: `linear-gradient(90deg, color-mix(in srgb, ${color} ${live ? 14 : 7}%, transparent), transparent 70%)`,
        }}
      >
        <span className="absolute inset-y-2 left-0 w-[2px] rounded-full" style={{ background: color }} />
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm text-ink">{ev.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[11.5px] text-ink-3">
              <span>{CATEGORY_META[ev.category].label}</span>
              {ev.location && (
                <span className="flex items-center gap-1"><MapPin size={10} />{ev.location}</span>
              )}
              {ev.recurrence && <Repeat size={10} aria-label="Repeats" />}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {live && <span className="rounded-full px-2 py-0.5 text-[10.5px]" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>Now</span>}
            {!live && !past && startsIn <= 90 && <span className="tabular text-[10.5px] text-ink-2">{until(startsIn)}</span>}
            <button onClick={remove} aria-label={`Remove ${ev.title}`} className="grid size-6 place-items-center rounded-md text-ink-4 opacity-0 transition-opacity hover:text-coral group-hover:opacity-100">
              <X size={12} />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function DueRow({ task, now }: { task: Task; now: Date }) {
  const past = `${toDateKey(now)}T${task.dueTime}` < toDateTime(now);
  return (
    <div className={`flex items-center gap-3 py-1.5 ${past ? "opacity-40" : ""}`}>
      <span className="tabular w-[52px] shrink-0 text-right font-mono text-[10.5px] text-coral/90">{formatTime(task.dueTime!)}</span>
      <span className="flex w-2 shrink-0 justify-center"><span className="size-[7px] rotate-45 bg-coral/90" /></span>
      <span className="truncate text-[12.5px] text-ink-2">
        <span className="text-coral/90">Due</span> · {task.title}
      </span>
    </div>
  );
}

export function Schedule({ now }: { now: Date }) {
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const openCommand = useUI((s) => s.openCommand);
  const today = toDateKey(now);
  const nowStr = toDateTime(now);
  const todays = eventsOn(events, today);
  const dues = tasks.filter((t) => t.status === "todo" && t.dueDate === today && t.dueTime);
  const items: Item[] = [
    ...todays.map((ev) => ({ kind: "event" as const, at: ev.start, ev })),
    ...dues.map((task) => ({ kind: "due" as const, at: `${today}T${task.dueTime}`, task })),
  ].sort((a, b) => a.at.localeCompare(b.at));
  const nowIndex = items.findIndex((i) => (i.kind === "event" ? i.ev.end > nowStr : i.at > nowStr));
  const tomorrow = eventsOn(events, toDateKey(addDays(now, 1)));

  return (
    <section className="panel flex flex-col p-5 sm:p-6">
      <SectionHeader
        label="Schedule"
        right={
          <button
            onClick={() => openCommand("Add an event ")}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-ink-3 transition-colors hover:bg-white/[0.04] hover:text-ink"
          >
            <Plus size={13} /> Event
          </button>
        }
      />
      {items.length === 0 ? (
        <div className="py-6">
          <p className="text-sm text-ink-3">No events today.</p>
          <button onClick={() => openCommand("Add an event ")} className="mt-2 text-sm text-ice hover:underline">
            Tell devbot about one →
          </button>
        </div>
      ) : (
        <div>
          {items.map((it, i) => (
            <Fragment key={it.kind === "event" ? it.ev.id + it.at : it.task.id}>
              {i === nowIndex && <NowLine now={now} />}
              {it.kind === "event" ? (
                <EventRow ev={it.ev} now={now} past={it.ev.end <= nowStr} />
              ) : (
                <DueRow task={it.task} now={now} />
              )}
            </Fragment>
          ))}
          {nowIndex === -1 && <NowLine now={now} />}
        </div>
      )}

      {tomorrow.length > 0 && (
        <div className="mt-auto pt-5">
          <div className="rule mb-4" />
          <div className="eyebrow mb-2">Tomorrow</div>
          <ul className="space-y-1.5">
            {tomorrow.slice(0, 4).map((e) => (
              <li key={e.id + e.start} className="flex items-center gap-3 text-[12.5px]">
                <span className="tabular w-[52px] shrink-0 text-right font-mono text-[10.5px] text-ink-4">{formatTime(timeOf(e.start))}</span>
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: CATEGORY_META[e.category].color }} />
                <span className="truncate text-ink-2">{e.title}</span>
              </li>
            ))}
            {tomorrow.length > 4 && <li className="pl-[64px] text-[11.5px] text-ink-4">+{tomorrow.length - 4} more</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
