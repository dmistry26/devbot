"use client";

import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { toDateKey } from "@/lib/dates";
import { useUI } from "@/components/ui/ui-store";
import type { SchoolSyncResponse } from "./types";

export interface SyncOutcome {
  ok: boolean;
  error?: SchoolSyncResponse["error"];
  message?: string;
  student?: string;
  added: number;
  updated: number;
}

let inFlight: Promise<SyncOutcome> | null = null;

/** Pull homework from learn.vcs.net (via our server) and merge it into tasks. */
export function syncSchool(): Promise<SyncOutcome> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const { school } = useStore.getState();
      const res = await fetch("/api/school/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ today: toDateKey(new Date()), days: school.days }),
      });
      const data = (await res.json()) as SchoolSyncResponse;
      if (!data.ok) return { ok: false, error: data.error, message: data.message, added: 0, updated: 0 };
      const r = useStore.getState().importSchool(data.items, data.courses);
      return { ok: true, student: data.student, ...r };
    } catch {
      return { ok: false, error: "unreachable" as const, message: "Couldn't reach the devbot server.", added: 0, updated: 0 };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

const STALE_MS = 3 * 60 * 60 * 1000;
let triedThisSession = false;

/** Sync quietly when devbot opens, if the last sync is older than 3 hours. */
export function useSchoolAutoSync() {
  useEffect(() => {
    if (triedThisSession) return;
    triedThisSession = true;
    const last = useStore.getState().school.lastSync;
    if (last && Date.now() - new Date(last).getTime() < STALE_MS) return;
    syncSchool().then((r) => {
      if (r.ok && r.added > 0) {
        useUI.getState().toast({
          text: `${r.added} new assignment${r.added === 1 ? "" : "s"} from school`,
          undo: true,
        });
      }
    });
  }, []);
}
