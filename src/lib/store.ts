"use client";

// Local-first store. Every change goes through `commit`, which records an undo
// snapshot. Persistence is localStorage for now; Supabase sync plugs in at
// `commit` (see docs/ARCHITECTURE.md) without changing any components.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import { applyActions, type Action } from "./actions";
import type { CalendarEvent, CalendarSubscription, HistoryEntry, Profile, Snapshot } from "./types";
import { toDateKey, toDateTime } from "./dates";
import { mergeSchoolItems } from "./school/merge";
import type { SchoolCourse, SchoolItem } from "./school/types";

export interface SchoolState {
  /** Per Moodle course id: 0 = you have the class on the first date of the pair, 1 = second. */
  days: Record<string, 0 | 1>;
  courses: SchoolCourse[];
  lastSync: string | null; // ISO
  /** External ids of imported tasks you deleted, so re-syncs don't bring them back. */
  dismissed: string[];
}

const HISTORY_LIMIT = 40;

interface State extends Snapshot {
  profile: Profile;
  history: HistoryEntry[];
  commit: (actions: Action[], opts: { label: string; by: "you" | "ai" }) => string | null;
  undo: () => HistoryEntry | null;
  setProfile: (p: Partial<Profile>) => void;
  replaceAll: (s: Snapshot, label: string) => void;
  school: SchoolState;
  setSchool: (p: Partial<SchoolState>) => void;
  importSchool: (items: SchoolItem[], courses: SchoolCourse[]) => { added: number; updated: number };
  calendars: CalendarSubscription[];
  addCalendar: (c: Omit<CalendarSubscription, "id" | "lastSync" | "error" | "enabled">) => string;
  updateCalendar: (id: string, p: Partial<CalendarSubscription>) => void;
  removeCalendar: (id: string) => void;
  /** Replace all events from one subscription (feed refreshes aren't undoable changes). */
  setCalendarEvents: (id: string, events: CalendarEvent[]) => void;
}

const empty: Snapshot = { tasks: [], events: [], projects: [], notes: [] };

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...empty,
      profile: { name: "" },
      history: [],
      commit: (actions, { label, by }) => {
        if (actions.length === 0) return null;
        const s = get();
        const before: Snapshot = {
          tasks: s.tasks,
          events: s.events,
          projects: s.projects,
          notes: s.notes,
        };
        const nowIso = toDateTime(new Date());
        const next = applyActions(before, actions, by === "ai" ? "ai" : "manual", nowIso);
        // Remember deleted imports so the next school sync doesn't re-add them.
        const deletedExt = actions
          .filter((a) => a.type === "delete_task")
          .map((a) => s.tasks.find((t) => t.id === (a as { task_id: string }).task_id)?.externalId)
          .filter((x): x is string => !!x);
        const entry: HistoryEntry = {
          id: nowIso + Math.random().toString(36).slice(2, 6),
          label,
          at: nowIso,
          by,
          before,
        };
        set({
          ...next,
          history: [entry, ...s.history].slice(0, HISTORY_LIMIT),
          ...(deletedExt.length
            ? { school: { ...s.school, dismissed: [...s.school.dismissed, ...deletedExt].slice(-500) } }
            : {}),
        });
        return entry.id;
      },
      undo: () => {
        const s = get();
        const [last, ...rest] = s.history;
        if (!last) return null;
        // Feed events are refreshed outside of history; keep the current ones.
        const feed = s.events.filter((e) => e.subscriptionId);
        set({ ...last.before, events: [...last.before.events.filter((e) => !e.subscriptionId), ...feed], history: rest });
        return last;
      },
      setProfile: (p) => set({ profile: { ...get().profile, ...p } }),
      school: { days: {}, courses: [], lastSync: null, dismissed: [] },
      calendars: [],
      addCalendar: (c) => {
        const id = `cal-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        set({ calendars: [...get().calendars, { ...c, id, enabled: true, lastSync: null, error: null }] });
        return id;
      },
      updateCalendar: (id, p) => {
        const s = get();
        const calendars = s.calendars.map((c) => (c.id === id ? { ...c, ...p } : c));
        // Recolor or hide that calendar's events right away.
        const cal = calendars.find((c) => c.id === id);
        let events = s.events;
        if (cal && p.category) events = events.map((e) => (e.subscriptionId === id ? { ...e, category: cal.category } : e));
        if (cal && p.enabled === false) events = events.filter((e) => e.subscriptionId !== id);
        set({ calendars, events });
      },
      removeCalendar: (id) => {
        const s = get();
        set({ calendars: s.calendars.filter((c) => c.id !== id), events: s.events.filter((e) => e.subscriptionId !== id) });
      },
      setCalendarEvents: (id, incoming) => {
        const s = get();
        set({ events: [...s.events.filter((e) => e.subscriptionId !== id), ...incoming] });
      },
      setSchool: (p) => set({ school: { ...get().school, ...p } }),
      importSchool: (items, courses) => {
        const s = get();
        const now = new Date();
        const nowIso = toDateTime(now);
        const r = mergeSchoolItems(s.tasks, items, new Set(s.school.dismissed), nowIso, toDateKey(now));
        const school = { ...s.school, courses, lastSync: now.toISOString() };
        if (!r.added && !r.updated) {
          set({ school });
          return r;
        }
        const entry: HistoryEntry = {
          id: nowIso + "school",
          label: `School sync: ${r.added} new, ${r.updated} updated`,
          at: nowIso,
          by: "you",
          before: { tasks: s.tasks, events: s.events, projects: s.projects, notes: s.notes },
        };
        set({ tasks: r.tasks, school, history: [entry, ...s.history].slice(0, HISTORY_LIMIT) });
        return r;
      },
      replaceAll: (snap, label) => {
        const s = get();
        const entry: HistoryEntry = {
          id: Date.now().toString(36),
          label,
          at: toDateTime(new Date()),
          by: "you",
          before: { tasks: s.tasks, events: s.events, projects: s.projects, notes: s.notes },
        };
        set({ ...snap, history: [entry, ...s.history].slice(0, HISTORY_LIMIT) });
      },
    }),
    {
      name: "devbot.v1",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: ({ tasks, events, projects, notes, profile, history, school, calendars }) => ({
        calendars,
        tasks,
        events,
        projects,
        notes,
        profile,
        school,
        history: history.slice(0, 15),
      }),
    },
  ),
);

export const snapshotOf = (s: Snapshot): Snapshot => ({
  tasks: s.tasks,
  events: s.events,
  projects: s.projects,
  notes: s.notes,
});

const noopSubscribe = () => () => {};

/** True on the client after hydration (store rehydrated, Date is safe to use). */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

// A shared clock that ticks every 30s while anything is subscribed.
let clockNow: Date | null = null;
const clockSubs = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
function subscribeClock(cb: () => void) {
  clockSubs.add(cb);
  if (!clockTimer) {
    clockTimer = setInterval(() => {
      clockNow = new Date();
      clockSubs.forEach((f) => f());
    }, 30_000);
  }
  return () => {
    clockSubs.delete(cb);
    if (!clockSubs.size && clockTimer) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}
function getClock() {
  if (!clockNow || Date.now() - clockNow.getTime() > 30_000) clockNow = new Date();
  return clockNow;
}

/** Current time, ticking every 30s. Null during server render. */
export function useNow(): Date | null {
  return useSyncExternalStore(subscribeClock, getClock, () => null);
}
