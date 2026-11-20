"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, Plus, Repeat, TriangleAlert } from "lucide-react";
import { useNow, useStore } from "@/lib/store";
import { conflictIdsOn, dueOn, layoutDay } from "@/lib/calendar";
import { addDays, eventsOn, format, formatTime, parseDateKey, timeOf, toDateKey } from "@/lib/dates";
import type { CalendarEvent, Task } from "@/lib/types";
import { CATEGORY_META } from "@/components/ui/meta";
import { useUI } from "@/components/ui/ui-store";
import { slotRange } from "@/components/ui/EventEditor";
import { Skeleton } from "@/components/ui/primitives";

type View = "month" | "week" | "day" | "agenda";
const VIEWS: View[] = ["month", "week", "day", "agenda"];
const START_HOUR = 6;
const END_HOUR = 24;
const HOUR_PX = 48;

const startOfWeek = (d: Date) => addDays(d, -d.getDay()); // Sunday
const VIEW_KEY = "devbot.calendar.view";

function readView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY) as View | null;
    if (v && VIEWS.includes(v)) return v;
  } catch {}
  return typeof window !== "undefined" && window.innerWidth < 640 ? "day" : "week";
}

export function CalendarView() {
  const now = useNow();
  if (!now) return <CalendarSkeleton />;
  return <Calendar now={now} />;
}

function Calendar({ now }: { now: Date }) {
  const [view, setViewState] = useState<View>(readView);
  const [anchor, setAnchor] = useState(() => toDateKey(now));
  const events = useStore((s) => s.events);
  const tasks = useStore((s) => s.tasks);
  const today = toDateKey(now);

  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  const step = (dir: 1 | -1) => {
    const a = parseDateKey(anchor);
    if (view === "month") setAnchor(toDateKey(new Date(a.getFullYear(), a.getMonth() + dir, 1)));
    else if (view === "week") setAnchor(toDateKey(addDays(a, 7 * dir)));
    else if (view === "day") setAnchor(toDateKey(addDays(a, dir)));
    else setAnchor(toDateKey(addDays(a, 14 * dir)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]") || e.metaKey || e.ctrlKey) return;
      if (useUI.getState().commandOpen || useUI.getState().editingEvent || useUI.getState().editingTaskId) return;
      const map: Record<string, View> = { m: "month", w: "week", d: "day", a: "agenda" };
      if (map[e.key]) setView(map[e.key]);
      else if (e.key === "t") setAnchor(toDateKey(new Date()));
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const a = parseDateKey(anchor);
  const title =
    view === "month" || view === "agenda" ? (
      <>
        {format(a, "MMMM")} <span className="text-ink-3">{format(a, "yyyy")}</span>
      </>
    ) : view === "week" ? (
      (() => {
        const s = startOfWeek(a);
        const e = addDays(s, 6);
        return s.getMonth() === e.getMonth() ? (
          <>
            {format(s, "MMMM d")}–{format(e, "d")}
          </>
        ) : (
          <>
            {format(s, "MMM d")} – {format(e, "MMM d")}
          </>
        );
      })()
    ) : (
      <>
        {format(a, "EEEE")}, <em className="text-ink-2">{format(a, "MMMM d")}</em>
      </>
    );

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pt-6 sm:px-8 md:pt-10">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="eyebrow mb-2">Calendar</div>
          <h1 className="font-display text-[38px] leading-none text-ink sm:text-[48px]">{title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-line bg-white/[0.02] p-0.5">
            {VIEWS.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`relative rounded-[10px] px-3 py-1.5 text-xs capitalize transition-colors ${view === v ? "text-ink" : "text-ink-3 hover:text-ink-2"}`}
              >
                {view === v && <motion.span layoutId="cal-view" className="absolute inset-0 rounded-[10px] border border-line-strong bg-white/[0.06]" />}
                <span className="relative">{v}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center rounded-xl border border-line">
            <button onClick={() => step(-1)} aria-label="Previous" className="grid size-8 place-items-center text-ink-3 hover:text-ink"><ChevronLeft size={16} /></button>
            <button onClick={() => setAnchor(today)} className="px-2 text-xs text-ink-2 hover:text-ink">Today</button>
            <button onClick={() => step(1)} aria-label="Next" className="grid size-8 place-items-center text-ink-3 hover:text-ink"><ChevronRight size={16} /></button>
          </div>
          <button
            onClick={() => useUI.getState().editEvent({ id: "new", ...slotRange(anchor === today ? today : anchor, Math.min(21, Math.max(8, now.getHours() + 1))) })}
            className="flex items-center gap-1.5 rounded-xl bg-gold px-3 py-1.5 text-xs font-medium text-[#14110a]"
          >
            <Plus size={14} /> Event
          </button>
        </div>
      </header>

      {view === "month" && <MonthView anchor={anchor} today={today} events={events} tasks={tasks} onPickDay={(d) => { setAnchor(d); setView("day"); }} />}
      {view === "week" && <TimeGrid days={Array.from({ length: 7 }, (_, i) => toDateKey(addDays(startOfWeek(a), i)))} now={now} events={events} tasks={tasks} onPickDay={(d) => { setAnchor(d); setView("day"); }} />}
      {view === "day" && <TimeGrid days={[anchor]} now={now} events={events} tasks={tasks} />}
      {view === "agenda" && <AgendaView anchor={anchor} today={today} events={events} tasks={tasks} />}

      <p className="mt-4 hidden text-[11.5px] text-ink-4 sm:block">
        Shortcuts: <span className="text-ink-3">M W D A</span> switch views · <span className="text-ink-3">← →</span> move · <span className="text-ink-3">T</span> today · click an empty slot to add an event
      </p>
    </div>
  );
}

/* ───────────────────────────── Month ───────────────────────────── */

function MonthView({ anchor, today, events, tasks, onPickDay }: { anchor: string; today: string; events: CalendarEvent[]; tasks: Task[]; onPickDay: (d: string) => void }) {
  const a = parseDateKey(anchor);
  const first = new Date(a.getFullYear(), a.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const editEvent = useUI((s) => s.editEvent);
  const editTask = useUI((s) => s.editTask);

  return (
    <div className="panel overflow-hidden">
      <div className="grid grid-cols-7 border-b border-line">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="eyebrow px-2 py-2.5 text-center !text-[9.5px]">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => {
          const key = toDateKey(d);
          const inMonth = d.getMonth() === a.getMonth();
          const evs = eventsOn(events, key);
          const dues = dueOn(tasks, key);
          const items = [
            ...dues.filter((t) => t.kind === "deadline").map((t) => ({ kind: "due" as const, t })),
            ...evs.map((e) => ({ kind: "ev" as const, e })),
            ...dues.filter((t) => t.kind !== "deadline").map((t) => ({ kind: "due" as const, t })),
          ];
          const shown = items.slice(0, 3);
          return (
            <div
              key={key}
              onClick={(e) => e.target === e.currentTarget && editEvent({ id: "new", ...slotRange(key, 16) })}
              className={`group relative min-h-[96px] border-line p-1.5 sm:min-h-[118px] ${i % 7 !== 6 ? "border-r" : ""} ${i < 35 ? "border-b" : ""} ${inMonth ? "" : "bg-black/20"} cursor-default`}
            >
              <button
                onClick={() => onPickDay(key)}
                className={`mb-1 grid size-6 place-items-center rounded-full text-[11.5px] tabular transition-colors ${key === today ? "bg-gold font-medium text-[#14110a]" : inMonth ? "text-ink-2 hover:bg-white/[0.06]" : "text-ink-4"}`}
              >
                {d.getDate()}
              </button>
              <div className="space-y-[3px]">
                {shown.map((it) =>
                  it.kind === "ev" ? (
                    <button
                      key={it.e.id + it.e.start}
                      onClick={() => editEvent({ id: it.e.id })}
                      className="flex w-full items-center gap-1 truncate rounded-md px-1 py-[1px] text-left text-[10.5px] text-ink-2 hover:bg-white/[0.05]"
                    >
                      <span className="size-1.5 shrink-0 rounded-full" style={{ background: CATEGORY_META[it.e.category].color }} />
                      <span className="hidden shrink-0 text-ink-4 tabular sm:inline">{formatTime(timeOf(it.e.start))}</span>
                      <span className="truncate">{it.e.title}</span>
                    </button>
                  ) : (
                    <button
                      key={it.t.id}
                      onClick={() => editTask(it.t.id)}
                      className={`flex w-full items-center gap-1 truncate rounded-md px-1 py-[1px] text-left text-[10.5px] hover:bg-white/[0.05] ${it.t.kind === "deadline" ? "text-coral" : "text-ink-3"}`}
                    >
                      <span className={`size-[6px] shrink-0 rotate-45 ${it.t.kind === "deadline" ? "bg-coral" : "border border-ink-3"}`} />
                      <span className="truncate">{it.t.title}</span>
                    </button>
                  ),
                )}
                {items.length > 3 && (
                  <button onClick={() => onPickDay(key)} className="px-1 text-[10.5px] text-ink-4 hover:text-ink-2">+{items.length - 3} more</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── Week / Day ─────────────────────────── */

function TimeGrid({ days, now, events, tasks, onPickDay }: { days: string[]; now: Date; events: CalendarEvent[]; tasks: Task[]; onPickDay?: (d: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const today = toDateKey(now);
  const editEvent = useUI((s) => s.editEvent);
  const editTask = useUI((s) => s.editTask);
  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const nowMin = (now.getHours() - START_HOUR) * 60 + now.getMinutes();

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = days.includes(today) ? Math.max(0, nowMin - 120) : (8 - START_HOUR) * 60;
    el.scrollTop = (target / 60) * HOUR_PX;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.join()]);

  const layouts = useMemo(() => days.map((d) => ({ d, placed: layoutDay(events, d, START_HOUR, END_HOUR), clashes: conflictIdsOn(events, d) })), [days, events]);
  const hasAllDay = days.some((d) => dueOn(tasks, d).length);
  const multi = days.length > 1;

  const clickSlot = (day: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const y = e.nativeEvent.offsetY;
    const mins = Math.floor((y / HOUR_PX) * 2) * 30; // snap to 30 min
    const h = START_HOUR + Math.floor(mins / 60);
    editEvent({ id: "new", ...slotRange(day, Math.min(h, 23), mins % 60) });
  };

  return (
    <div className="panel overflow-hidden">
      <div className={multi ? "overflow-x-auto scroll-thin" : ""}>
        <div className={multi ? "min-w-[720px]" : ""}>
          {/* Headers */}
          <div className="flex border-b border-line">
            <div className="w-14 shrink-0" />
            {days.map((d) => {
              const dt = parseDateKey(d);
              const isToday = d === today;
              return (
                <button
                  key={d}
                  onClick={() => onPickDay?.(d)}
                  disabled={!onPickDay}
                  className="flex flex-1 flex-col items-center gap-0.5 border-l border-line py-2.5 enabled:hover:bg-white/[0.02]"
                >
                  <span className={`eyebrow !text-[9.5px] ${isToday ? "!text-gold" : ""}`}>{format(dt, "EEE")}</span>
                  <span className={`grid size-8 place-items-center rounded-full font-display text-[20px] leading-none ${isToday ? "bg-gold text-[#14110a]" : "text-ink"}`}>{dt.getDate()}</span>
                </button>
              );
            })}
          </div>

          {/* Due today row */}
          {hasAllDay && (
            <div className="flex border-b border-line">
              <div className="eyebrow flex w-14 shrink-0 items-center justify-end pr-2 !text-[8.5px]">Due</div>
              {days.map((d) => (
                <div key={d} className="min-w-0 flex-1 space-y-1 border-l border-line p-1">
                  {(() => {
                    const all = dueOn(tasks, d).sort((x, y) => Number(y.kind === "deadline") - Number(x.kind === "deadline"));
                    const limit = multi ? 3 : 8;
                    return (
                      <>
                  {all.slice(0, limit).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => editTask(t.id)}
                      className={`flex w-full items-center gap-1.5 truncate rounded-md px-1.5 py-1 text-left text-[11px] ${t.kind === "deadline" ? "bg-coral/10 text-coral" : "bg-white/[0.03] text-ink-2"}`}
                    >
                      <span className={`size-[6px] shrink-0 rotate-45 ${t.kind === "deadline" ? "bg-coral" : "border border-ink-3"}`} />
                      <span className="truncate">{t.title}</span>
                    </button>
                  ))}
                  {all.length > limit && (
                    <button onClick={() => onPickDay?.(d)} className="px-1.5 text-[10.5px] text-ink-4 hover:text-ink-2">
                      +{all.length - limit} more
                    </button>
                  )}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}

          {/* Grid */}
          <div ref={scrollRef} className="scroll-thin relative max-h-[62vh] overflow-y-auto">
            <div className="relative flex" style={{ height: hours.length * HOUR_PX }}>
              <div className="relative w-14 shrink-0">
                {hours.map((h) => (
                  <div key={h} className="absolute right-2 -translate-y-1/2 font-mono text-[10px] tabular text-ink-4" style={{ top: (h - START_HOUR) * HOUR_PX }}>
                    {h === START_HOUR ? "" : formatTime(`${String(h).padStart(2, "0")}:00`)}
                  </div>
                ))}
              </div>
              {layouts.map(({ d, placed, clashes }) => (
                <div key={d} className="relative flex-1 border-l border-line" onClick={(e) => clickSlot(d, e)}>
                  {hours.map((h) => (
                    <div key={h} className="pointer-events-none absolute inset-x-0 border-t border-line/70" style={{ top: (h - START_HOUR) * HOUR_PX }} />
                  ))}
                  {placed.map((p) => {
                    const c = CATEGORY_META[p.event.category].color;
                    const clash = clashes.has(p.event.id);
                    const w = 100 / p.lanes;
                    const short = p.height < 40;
                    return (
                      <button
                        key={p.event.id + p.event.start}
                        onClick={() => editEvent({ id: p.event.id })}
                        className="absolute overflow-hidden rounded-lg border px-2 py-1 text-left transition-[filter] hover:brightness-125"
                        style={{
                          top: (p.top / 60) * HOUR_PX + 1,
                          height: (p.height / 60) * HOUR_PX - 2,
                          left: `calc(${p.lane * w}% + 2px)`,
                          width: `calc(${w}% - 4px)`,
                          borderColor: clash ? "var(--amber)" : `color-mix(in srgb, ${c} 40%, transparent)`,
                          background: `linear-gradient(180deg, color-mix(in srgb, ${c} 20%, var(--bg-raise)), color-mix(in srgb, ${c} 10%, var(--bg-raise)))`,
                        }}
                      >
                        <span className="absolute inset-y-1 left-0 w-[2px] rounded-full" style={{ background: c }} />
                        <div className={`flex items-center gap-1 text-[11.5px] font-medium leading-tight text-ink ${short ? "truncate" : ""}`}>
                          {clash && <TriangleAlert size={10} className="shrink-0 text-amber" aria-label="Overlaps another event" />}
                          <span className="truncate">{p.event.title}</span>
                        </div>
                        {!short && (
                          <div className="mt-0.5 truncate font-mono text-[10px] text-ink-3 tabular">
                            {formatTime(timeOf(p.event.start))}–{formatTime(timeOf(p.event.end))}
                            {p.event.recurrence && <Repeat size={9} className="ml-1 inline" />}
                          </div>
                        )}
                        {!short && p.height >= 75 && p.event.location && (
                          <div className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-ink-3"><MapPin size={9} />{p.event.location}</div>
                        )}
                      </button>
                    );
                  })}
                  {d === today && nowMin >= 0 && nowMin <= (END_HOUR - START_HOUR) * 60 && (
                    <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: (nowMin / 60) * HOUR_PX }}>
                      <span className="-ml-1 size-2 rounded-full bg-gold shadow-[0_0_10px_var(--gold)]" />
                      <span className="h-px flex-1 bg-gold/70" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Agenda ───────────────────────────── */

function AgendaView({ anchor, today, events, tasks }: { anchor: string; today: string; events: CalendarEvent[]; tasks: Task[] }) {
  const editEvent = useUI((s) => s.editEvent);
  const editTask = useUI((s) => s.editTask);
  const start = anchor < today && parseDateKey(anchor).getMonth() === parseDateKey(today).getMonth() ? today : anchor;
  const days = Array.from({ length: 30 }, (_, i) => toDateKey(addDays(parseDateKey(start), i)));
  const rows = days
    .map((d) => ({ d, evs: eventsOn(events, d), dues: dueOn(tasks, d), clashes: conflictIdsOn(events, d) }))
    .filter((r) => r.evs.length || r.dues.length);

  if (!rows.length)
    return (
      <div className="panel p-8 text-center">
        <p className="font-display text-2xl text-ink">Nothing in the next 30 days.</p>
        <p className="mt-2 text-sm text-ink-3">Add an event, or tell devbot about one with ⌘K.</p>
      </div>
    );

  return (
    <div className="space-y-3">
      {rows.map(({ d, evs, dues, clashes }) => {
        const dt = parseDateKey(d);
        const rel = d === today ? "Today" : d === toDateKey(addDays(parseDateKey(today), 1)) ? "Tomorrow" : null;
        return (
          <section key={d} className="panel flex flex-col gap-3 p-4 sm:flex-row sm:gap-6 sm:p-5">
            <div className="w-28 shrink-0">
              <div className={`font-display text-[28px] leading-none ${d === today ? "text-gold" : "text-ink"}`}>{format(dt, "d")}</div>
              <div className="eyebrow mt-1">{format(dt, "EEE · MMM")}</div>
              {rel && <div className="mt-1 text-[11px] text-ink-3">{rel}</div>}
            </div>
            <ul className="min-w-0 flex-1 space-y-1.5">
              {dues.map((t) => (
                <li key={t.id}>
                  <button onClick={() => editTask(t.id)} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.03]">
                    <span className="w-24 shrink-0 font-mono text-[10.5px] tabular text-coral/90">{t.dueTime ? `Due ${formatTime(t.dueTime)}` : "Due"}</span>
                    <span className={`size-[7px] shrink-0 rotate-45 ${t.kind === "deadline" ? "bg-coral" : "border border-ink-3"}`} />
                    <span className={`truncate text-sm ${t.kind === "deadline" ? "text-ink" : "text-ink-2"}`}>{t.title}</span>
                    {t.context && <span className="ml-auto hidden shrink-0 text-[11px] text-ink-4 sm:inline">{t.context}</span>}
                  </button>
                </li>
              ))}
              {evs.map((e) => (
                <li key={e.id + e.start}>
                  <button onClick={() => editEvent({ id: e.id })} className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.03]">
                    <span className="w-24 shrink-0 font-mono text-[10.5px] tabular text-ink-3">{formatTime(timeOf(e.start))}–{formatTime(timeOf(e.end))}</span>
                    <span className="size-2 shrink-0 rounded-full" style={{ background: CATEGORY_META[e.category].color }} />
                    <span className="truncate text-sm text-ink">{e.title}</span>
                    {clashes.has(e.id) && <TriangleAlert size={12} className="shrink-0 text-amber" aria-label="Overlaps another event" />}
                    {e.recurrence && <Repeat size={11} className="shrink-0 text-ink-4" />}
                    {e.location && <span className="ml-auto hidden shrink-0 items-center gap-1 text-[11px] text-ink-4 sm:flex"><MapPin size={10} />{e.location}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function CalendarSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pt-6 sm:px-8 md:pt-10">
      <Skeleton className="mb-2 h-3 w-24" />
      <Skeleton className="mb-6 h-12 w-72" />
      <Skeleton className="h-[60vh] w-full" />
    </div>
  );
}
