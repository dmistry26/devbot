"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Check, TriangleAlert } from "lucide-react";
import { useStore } from "@/lib/store";
import { decodePayload, matchCourse, parsePayload } from "@/lib/grades/import";
import type { GradesSnapshot } from "@/lib/types";

type State = { kind: "working" } | { kind: "done"; snap: GradesSnapshot } | { kind: "error"; message: string };

/** Landing page for the "Send to devbot" PowerSchool bookmark. Grades arrive in the URL fragment. */
export default function ImportPage() {
  const [state, setState] = useState<State>({ kind: "working" });
  // Effects can run twice (React dev mode); capture the fragment once and import once.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const fragment = window.location.hash;
    // Remove the data from the address bar/history right away.
    history.replaceState(null, "", window.location.pathname);
    // Wait for the persisted store so we match against your real class list.
    const run = () => {
      const parsed = parsePayload(decodePayload(fragment));
      if (!parsed) {
        setState({ kind: "error", message: "No grades came through. Open your PowerSchool grades page, then tap the bookmark again." });
        return;
      }
      const courses = useStore.getState().school.courses.filter((c) => c.hasHomework).map((c) => ({ id: c.id, name: c.name }));
      const snap: GradesSnapshot = {
        source: "powerschool",
        importedAt: new Date().toISOString(),
        terms: parsed.terms,
        classes: parsed.classes.map((c) => ({ ...c, courseId: matchCourse(c.name, courses) })),
      };
      useStore.getState().setGrades(snap);
      setState({ kind: "done", snap });
    };
    if (useStore.persist.hasHydrated()) run();
    else return useStore.persist.onFinishHydration(run);
  }, []);

  return (
    <div className="mx-auto grid min-h-[70dvh] max-w-lg place-items-center px-4 pt-10">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="panel w-full p-6 sm:p-7">
        {state.kind === "working" && <p className="text-sm text-ink-3">Importing grades…</p>}
        {state.kind === "error" && (
          <>
            <div className="mb-3 flex items-center gap-2 text-coral">
              <TriangleAlert size={16} /> <span className="text-sm">Nothing imported</span>
            </div>
            <p className="text-sm leading-relaxed text-ink-2">{state.message}</p>
            <Link href="/settings" className="mt-5 inline-block text-sm text-gold hover:underline">
              How to set up the bookmark →
            </Link>
          </>
        )}
        {state.kind === "done" && (
          <>
            <div className="mb-4 flex items-center gap-2 text-sage">
              <Check size={16} /> <span className="text-sm">Grades updated from PowerSchool</span>
            </div>
            <ul className="divide-y divide-line">
              {state.snap.classes.map((c) => (
                <li key={c.name} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{c.name}</span>
                    {!c.courseId && <span className="block text-[11px] text-ink-4">not matched to a learn.vcs.net class</span>}
                  </span>
                  <span className="shrink-0 font-mono text-sm tabular text-ink-2">
                    {c.current ? `${c.current.letter ?? ""}${c.current.percent !== null ? ` ${c.current.percent}%` : ""}` : "–"}
                  </span>
                </li>
              ))}
            </ul>
            <Link href="/academic" className="mt-5 inline-block rounded-xl bg-gold px-4 py-2 text-sm font-medium text-on-accent">
              Open Academic
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
