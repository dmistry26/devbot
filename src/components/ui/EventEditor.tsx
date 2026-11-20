"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Repeat, Trash2, TriangleAlert, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { findConflicts } from "@/lib/calendar";
import { addDays, format, formatTime, parseDateKey, parseDateTime, timeOf, toDateTime } from "@/lib/dates";
import { CATEGORIES, type CalendarEvent, type Category, type RecurrenceFreq } from "@/lib/types";
import { CATEGORY_META } from "./meta";
import { useUI } from "./ui-store";

interface Draft {
  title: string;
  date: string;
  start: string;
  end: string;
  location: string;
  description: string;
  category: Category;
  repeat: RecurrenceFreq | "none";
  until: string;
}

const field =
  "w-full rounded-xl border border-line bg-ink/[0.025] px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-line-strong";

const REPEATS: { value: Draft["repeat"]; label: string }[] = [
  { value: "none", label: "Doesn't repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Every weekday" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
];

function initialDraft(ev: CalendarEvent | undefined, start?: string, end?: string): Draft {
  if (ev)
    return {
      title: ev.title,
      date: ev.start.slice(0, 10),
      start: timeOf(ev.start),
      end: timeOf(ev.end),
      location: ev.location ?? "",
      description: ev.description ?? "",
      category: ev.category,
      repeat: ev.recurrence?.freq ?? "none",
      until: ev.recurrence?.until ?? "",
    };
  const now = new Date();
  const s = start ?? toDateTime(new Date(Math.ceil(now.getTime() / 1_800_000) * 1_800_000));
  const e = end ?? toDateTime(new Date(parseDateTime(s).getTime() + 3_600_000));
  return {
    title: "",
    date: s.slice(0, 10),
    start: timeOf(s),
    end: timeOf(e),
    location: "",
    description: "",
    category: "academic",
    repeat: "none",
    until: "",
  };
}

export function EventEditor() {
  const target = useUI((s) => s.editingEvent);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && useUI.getState().editEvent(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <AnimatePresence>
      {target && <EventDialogSwitch key={`${target.id}:${target.nonce}`} target={target} />}
    </AnimatePresence>
  );
}

function EventDialogSwitch({ target }: { target: { id: string; start?: string; end?: string } }) {
  const ev = useStore((s) => s.events.find((e) => e.id === target.id));
  return ev?.subscriptionId ? <FeedEventDialog ev={ev} /> : <EventDialog target={target} />;
}

/** Events from subscribed calendars are read-only: show details instead of an editor. */
function FeedEventDialog({ ev }: { ev: CalendarEvent }) {
  const close = () => useUI.getState().editEvent(null);
  const cal = useStore((s) => s.calendars.find((c) => c.id === ev.subscriptionId));
  const startDay = parseDateKey(ev.start.slice(0, 10));
  const lastDay = ev.allDay ? addDays(parseDateKey(ev.end.slice(0, 10)), -1) : startDay;
  const when = ev.allDay
    ? lastDay.getTime() > startDay.getTime()
      ? `${format(startDay, "EEE, MMM d")} – ${format(lastDay, "EEE, MMM d")} · all day`
      : `${format(startDay, "EEEE, MMMM d")} · all day`
    : `${format(startDay, "EEEE, MMMM d")} · ${formatTime(timeOf(ev.start))}–${formatTime(timeOf(ev.end))}`;
  return (
    <motion.div
      className="fixed inset-0 z-40 grid place-items-end bg-black/50 p-3 backdrop-blur-sm sm:place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(e) => e.target === e.currentTarget && close()}
    >
      <motion.div
        initial={{ y: 24, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 16, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="glass w-full max-w-md rounded-3xl p-5 sm:p-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="eyebrow flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: CATEGORY_META[ev.category].color }} />
            {cal?.name ?? "Subscribed calendar"}
          </span>
          <button type="button" onClick={close} aria-label="Close" className="text-ink-3 hover:text-ink">
            <X size={18} />
          </button>
        </div>
        <h3 className="font-display text-[28px] leading-tight text-ink">{ev.title}</h3>
        <p className="mt-2 text-sm text-ink-2">{when}</p>
        {ev.location && <p className="mt-1 text-sm text-ink-3">{ev.location}</p>}
        {ev.description && <p className="mt-3 max-h-40 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-ink-3">{ev.description}</p>}
        <p className="mt-5 text-[12px] text-ink-4">This comes from a subscribed calendar, so it can&apos;t be edited here. Manage calendars in Settings.</p>
      </motion.div>
    </motion.div>
  );
}

function EventDialog({ target }: { target: { id: string; start?: string; end?: string } }) {
  const close = () => useUI.getState().editEvent(null);
  const toast = useUI((s) => s.toast);
  const events = useStore((s) => s.events);
  const commit = useStore((s) => s.commit);
  const existing = target.id !== "new" ? events.find((e) => e.id === target.id) : undefined;
  const [d, setD] = useState<Draft>(() => initialDraft(existing, target.start, target.end));

  const start = `${d.date}T${d.start}`;
  const end = `${d.date}T${d.end}`;
  const valid = d.title.trim() && d.date && d.start && d.end && end > start;
  const recurrence = d.repeat === "none" ? null : { freq: d.repeat, until: d.until || null };

  const conflicts = useMemo(
    () => (d.date && d.start && d.end && end > start ? findConflicts({ id: existing?.id, start, end, recurrence }, events) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [d.date, d.start, d.end, d.repeat, d.until, events, existing?.id],
  );

  const save = () => {
    if (!valid) return;
    const n = (s: string) => (s.trim() ? s.trim() : null);
    if (existing) {
      commit(
        [{ type: "set_event", event_id: existing.id, title: d.title, start, end, location: n(d.location), description: n(d.description), category: d.category, recurrence }],
        { label: `Edited "${d.title}"`, by: "you" },
      );
      toast({ text: "Event updated", undo: true });
    } else {
      commit(
        [{ type: "create_event", title: d.title, start, end, location: n(d.location), category: d.category, recurrence, task_id: null }],
        { label: `Added "${d.title}"`, by: "you" },
      );
      toast({ text: "Event added", undo: true });
    }
    close();
  };

  const remove = () => {
    if (!existing) return;
    commit([{ type: "delete_event", event_id: existing.id }], { label: `Removed "${existing.title}"`, by: "you" });
    toast({ text: existing.recurrence ? `Removed "${existing.title}" (all repeats)` : `Removed "${existing.title}"`, undo: true });
    close();
  };

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
        className="glass max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl p-5 sm:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="eyebrow">{existing ? "Edit event" : "New event"}</span>
          <button type="button" onClick={close} aria-label="Close" className="text-ink-3 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <input
          autoFocus
          value={d.title}
          onChange={(e) => setD({ ...d, title: e.target.value })}
          placeholder="Event name"
          className="mb-4 w-full bg-transparent font-display text-[28px] leading-tight text-ink outline-none placeholder:text-ink-4"
        />

        <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
          <label className="space-y-1.5">
            <span className="eyebrow">Date</span>
            <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} className={field} />
          </label>
          <label className="space-y-1.5">
            <span className="eyebrow">Start</span>
            <input type="time" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} className={field} />
          </label>
          <label className="space-y-1.5">
            <span className="eyebrow">End</span>
            <input type="time" value={d.end} onChange={(e) => setD({ ...d, end: e.target.value })} className={field} />
          </label>
        </div>
        {d.start && d.end && end <= start && <p className="mt-2 text-xs text-coral">The event has to end after it starts.</p>}

        {conflicts.length > 0 && (
          <div className="mt-3 flex gap-2 rounded-xl border border-amber/30 bg-amber/[0.06] px-3 py-2 text-[12.5px] text-amber">
            <TriangleAlert size={14} className="mt-[2px] shrink-0" />
            <span>
              Overlaps{" "}
              {conflicts
                .slice(0, 3)
                .map((c) => `${c.event.title} (${format(parseDateKey(c.day), "EEE MMM d")}, ${formatTime(timeOf(c.event.start))}–${formatTime(timeOf(c.event.end))})`)
                .join(", ")}
              {conflicts.length > 3 ? ` and ${conflicts.length - 3} more` : ""}. You can still save it.
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <label className="space-y-1.5">
            <span className="eyebrow flex items-center gap-1"><Repeat size={10} /> Repeat</span>
            <select value={d.repeat} onChange={(e) => setD({ ...d, repeat: e.target.value as Draft["repeat"] })} className={field}>
              {REPEATS.map((r) => (
                <option key={r.value} value={r.value} className="bg-raise">{r.label}</option>
              ))}
            </select>
          </label>
          {d.repeat !== "none" ? (
            <label className="space-y-1.5">
              <span className="eyebrow">Until (optional)</span>
              <input type="date" value={d.until} min={d.date} onChange={(e) => setD({ ...d, until: e.target.value })} className={field} />
            </label>
          ) : (
            <label className="space-y-1.5">
              <span className="eyebrow">Category</span>
              <select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value as Category })} className={field}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c} className="bg-raise">{CATEGORY_META[c].label}</option>
                ))}
              </select>
            </label>
          )}
          {d.repeat !== "none" && (
            <label className="col-span-2 space-y-1.5">
              <span className="eyebrow">Category</span>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((c) => (
                  <button
                    type="button"
                    key={c}
                    onClick={() => setD({ ...d, category: c })}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${d.category === c ? "border-line-strong bg-ink/[0.05] text-ink" : "border-line text-ink-3"}`}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: CATEGORY_META[c].color }} />
                    {CATEGORY_META[c].label}
                  </button>
                ))}
              </div>
            </label>
          )}
          <label className="col-span-2 space-y-1.5">
            <span className="eyebrow">Location</span>
            <input value={d.location} onChange={(e) => setD({ ...d, location: e.target.value })} placeholder="Optional" className={field} />
          </label>
          <label className="col-span-2 space-y-1.5">
            <span className="eyebrow">Notes</span>
            <textarea value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} rows={2} placeholder="Optional" className={`${field} resize-none`} />
          </label>
        </div>
        {existing?.recurrence && <p className="mt-3 text-[12px] text-ink-4">Changes apply to every repeat of this event.</p>}

        <div className="mt-6 flex items-center justify-between">
          {existing ? (
            <button type="button" onClick={remove} className="flex items-center gap-1.5 text-xs text-ink-3 transition-colors hover:text-coral">
              <Trash2 size={14} /> Delete{existing.recurrence ? " series" : ""}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" disabled={!valid} className="rounded-xl bg-gold px-5 py-2 text-sm font-medium text-on-accent transition-opacity disabled:opacity-40">
            {existing ? "Save" : "Add event"}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}

/** Helper for "new event at this slot" from grids. */
export const slotRange = (day: string, hour: number, minute = 0, lengthMin = 60) => {
  const s = new Date(parseDateKey(day));
  s.setHours(hour, minute, 0, 0);
  return { start: toDateTime(s), end: toDateTime(new Date(s.getTime() + lengthMin * 60000)) };
};
