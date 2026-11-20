"use client";

import { useStore } from "./store";
import { addDays, toDateKey, toDateTime } from "./dates";
import type { CalendarEvent, CalendarSubscription } from "./types";
import type { FeedResponse } from "@/app/api/calendar/feed/route";

/** The two calendars embedded on learn.vcs.net's home page ("High School Events Calendar"). */
export const VCS_CALENDARS: Pick<CalendarSubscription, "name" | "url" | "category">[] = [
  {
    name: "VCS High School Events",
    url: "https://calendar.google.com/calendar/ical/aq75vrqvvahusiakip8gif88f2tpkca7%40import.calendar.google.com/public/basic.ics",
    category: "social",
  },
  {
    name: "VCS A/B Days",
    url: "https://calendar.google.com/calendar/ical/621uhaha31a79mekg48ecj6j4tpthloa%40import.calendar.google.com/public/basic.ics",
    category: "academic",
  },
];

export async function syncCalendar(cal: CalendarSubscription): Promise<{ ok: boolean; count: number; error?: string; name?: string | null }> {
  const now = new Date();
  try {
    const res = await fetch("/api/calendar/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: cal.url,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        from: toDateKey(addDays(now, -30)),
        to: toDateKey(addDays(now, 365)),
      }),
    });
    const data = (await res.json()) as FeedResponse;
    const store = useStore.getState();
    if (!data.ok || !data.events) {
      store.updateCalendar(cal.id, { error: data.error ?? "Sync failed." });
      return { ok: false, count: 0, error: data.error };
    }
    const stamp = toDateTime(now);
    const events: CalendarEvent[] = data.events.map((e) => ({
      id: `${cal.id}:${e.uid}:${e.start}`,
      title: e.title,
      description: e.description,
      start: e.start,
      end: e.end,
      location: e.location,
      category: cal.category,
      recurrence: e.recurrence,
      taskId: null,
      source: "calendar",
      allDay: e.allDay,
      subscriptionId: cal.id,
      createdAt: stamp,
      updatedAt: stamp,
    }));
    store.setCalendarEvents(cal.id, events);
    store.updateCalendar(cal.id, { lastSync: now.toISOString(), error: null });
    return { ok: true, count: events.length, name: data.name };
  } catch {
    useStore.getState().updateCalendar(cal.id, { error: "Couldn't reach the devbot server." });
    return { ok: false, count: 0, error: "Couldn't reach the devbot server." };
  }
}

const STALE_MS = 6 * 60 * 60 * 1000;
let tried = false;

/** Refresh subscribed calendars when devbot opens, if older than 6 hours. */
export function autoSyncCalendars() {
  if (tried) return;
  tried = true;
  for (const cal of useStore.getState().calendars) {
    if (!cal.enabled) continue;
    if (cal.lastSync && Date.now() - new Date(cal.lastSync).getTime() < STALE_MS) continue;
    void syncCalendar(cal);
  }
}
