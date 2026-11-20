"use client";

// Local-first store. Every change goes through `commit`, which records an undo
// snapshot. Persistence is localStorage for now; Supabase sync plugs in at
// `commit` (see docs/ARCHITECTURE.md) without changing any components.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useSyncExternalStore } from "react";
import { applyActions, type Action } from "./actions";
import type { HistoryEntry, Profile, Snapshot } from "./types";
import { toDateTime } from "./dates";

const HISTORY_LIMIT = 40;

interface State extends Snapshot {
  profile: Profile;
  history: HistoryEntry[];
  commit: (actions: Action[], opts: { label: string; by: "you" | "ai" }) => string | null;
  undo: () => HistoryEntry | null;
  setProfile: (p: Partial<Profile>) => void;
  replaceAll: (s: Snapshot, label: string) => void;
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
        const entry: HistoryEntry = {
          id: nowIso + Math.random().toString(36).slice(2, 6),
          label,
          at: nowIso,
          by,
          before,
        };
        set({ ...next, history: [entry, ...s.history].slice(0, HISTORY_LIMIT) });
        return entry.id;
      },
      undo: () => {
        const [last, ...rest] = get().history;
        if (!last) return null;
        set({ ...last.before, history: rest });
        return last;
      },
      setProfile: (p) => set({ profile: { ...get().profile, ...p } }),
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
      partialize: ({ tasks, events, projects, notes, profile, history }) => ({
        tasks,
        events,
        projects,
        notes,
        profile,
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
