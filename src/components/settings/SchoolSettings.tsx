"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useStore } from "@/lib/store";
import { syncSchool, type SyncOutcome } from "@/lib/school/client";
import { format, parseDateKey } from "@/lib/dates";
import { useUI } from "@/components/ui/ui-store";

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const short = (d: string) => format(parseDateKey(d), "MMM d");

export function SchoolSettings() {
  const school = useStore((s) => s.school);
  const setSchool = useStore((s) => s.setSchool);
  const toast = useUI((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SyncOutcome | null>(null);

  const run = async () => {
    setBusy(true);
    const r = await syncSchool();
    setResult(r);
    setBusy(false);
    if (r.ok) toast({ text: r.added || r.updated ? `School sync: ${r.added} new, ${r.updated} updated` : "School sync: you're up to date", undo: r.added + r.updated > 0 });
  };

  const setDay = (courseId: number, day: 0 | 1) => {
    setSchool({ days: { ...school.days, [String(courseId)]: day } });
  };

  const notConfigured = result?.error === "not_configured" || (!school.lastSync && !result);
  const classes = school.courses.filter((c) => c.hasHomework);

  return (
    <section className="panel p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="eyebrow">School · learn.vcs.net</h2>
        <button
          onClick={run}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-ink-2 transition-colors hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} /> {busy ? "Syncing…" : "Sync now"}
        </button>
      </div>

      {result && !result.ok && result.error !== "not_configured" && (
        <p className="mb-4 rounded-xl border border-coral/30 bg-coral/5 px-3 py-2 text-sm text-coral">{result.message}</p>
      )}

      {school.lastSync && (!result || result.ok) && (
        <p className="mb-4 text-sm text-ink-2">
          <span className="mr-1.5 inline-block size-1.5 rounded-full bg-sage align-middle" />
          Connected{result?.student ? ` as ${result.student}` : ""}. Last synced {ago(school.lastSync)}. devbot checks for new homework whenever you open it.
        </p>
      )}

      {notConfigured && (
        <div className="space-y-3 text-sm leading-relaxed text-ink-2">
          <p>Connect once and your homework appears automatically. You never have to open learn.vcs.net.</p>
          <ol className="list-decimal space-y-1.5 pl-5 text-ink-3">
            <li>On learn.vcs.net, click your profile picture → <span className="text-ink-2">Preferences</span> → <span className="text-ink-2">Security keys</span>.</li>
            <li>Copy the key in the <span className="text-ink-2">Moodle mobile web service</span> row.</li>
            <li>
              In <code className="rounded bg-white/[0.05] px-1 text-[12px]">.env.local</code>, add:
              <pre className="mt-1.5 overflow-x-auto rounded-lg border border-line bg-black/30 p-2.5 font-mono text-[12px] text-ink-2">{`MOODLE_URL=https://learn.vcs.net\nMOODLE_TOKEN=your-key-here`}</pre>
            </li>
            <li>Restart devbot, then press <span className="text-ink-2">Sync now</span>.</li>
          </ol>
          <p className="text-[12.5px] text-ink-4">The key stays on the server and only reads your own courses. You can revoke it from the same Security keys page at any time.</p>
        </div>
      )}

      {classes.length > 0 && (
        <div className="mt-5">
          <div className="mb-1 text-sm text-ink-2">Which day do you have each class?</div>
          <p className="mb-3 text-[12.5px] text-ink-4">Lesson plans list two dates (A/B days). Pick yours so due dates are right.</p>
          <ul className="divide-y divide-line rounded-xl border border-line">
            {classes.map((c) => {
              const day = school.days[String(c.id)] ?? 0;
              const [a, b] = c.sampleDates;
              return (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <span className="min-w-0 truncate text-sm text-ink">{c.name}</span>
                  <div className="flex shrink-0 rounded-lg bg-white/[0.03] p-0.5 text-xs">
                    {([0, 1] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setDay(c.id, d)}
                        className={`rounded-md px-2.5 py-1 transition-colors ${day === d ? "bg-white/[0.08] text-ink" : "text-ink-3 hover:text-ink-2"}`}
                      >
                        {d === 0 ? (a ? short(a) : "1st date") : b ? short(b) : "2nd date"}
                      </button>
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[12px] text-ink-4">After changing days, press Sync now. Homework you haven&apos;t edited updates to the new dates.</p>
        </div>
      )}
    </section>
  );
}
