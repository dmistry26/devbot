"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowUpRight, ChevronDown, GraduationCap, RefreshCw, Sparkles } from "lucide-react";
import { useNow, useStore } from "@/lib/store";
import { syncSchool } from "@/lib/school/client";
import { addDays, daysUntil, format, parseDateKey, relativeDay, toDateKey } from "@/lib/dates";
import type { Task } from "@/lib/types";
import type { SchoolCourse } from "@/lib/school/types";
import { TaskRow } from "@/components/home/Priorities";
import { Skeleton } from "@/components/ui/primitives";
import { useUI } from "@/components/ui/ui-store";
import { useChat } from "@/components/command/chat-store";

const MOODLE = "https://learn.vcs.net";

/** School tasks carry their Moodle course id in the external id: vcs:<courseId>:... */
function courseIdOf(t: Task): number | null {
  const m = t.externalId?.match(/^vcs:(\d+):/);
  return m ? Number(m[1]) : null;
}

/** "AP Calculus BC - Mr. Nie" → "Mr. Nie" (Moodle names may contain HTML entities). */
function teacherOf(fullname: string): string | null {
  const clean = fullname.replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"');
  const m = clean.match(/\s[-–—]\s+((?:mr|mrs|ms|miss|dr|prof|coach|sr|señor|senor)\.?\s.+)$/i);
  return m ? m[1].trim() : null;
}

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

interface ClassData {
  course: SchoolCourse;
  day: string | null;
  tests: Task[];
  homework: Task[];
  done: Task[];
  next: Task | null;
  overdue: number;
  sortKey: string;
}

export function AcademicView() {
  const now = useNow();
  if (!now) return <AcademicSkeleton />;
  return <Academic now={now} />;
}

function Academic({ now }: { now: Date }) {
  const tasks = useStore((s) => s.tasks);
  const school = useStore((s) => s.school);
  const gradesUrl = useStore((s) => s.profile.gradesUrl ?? "");
  const toast = useUI((s) => s.toast);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const today = toDateKey(now);
  const weekEnd = toDateKey(addDays(now, 7));
  const recent = toDateKey(addDays(now, -14));

  const classes: ClassData[] = useMemo(() => {
    return school.courses
      .filter((c) => c.hasHomework)
      .map((course) => {
        const mine = tasks.filter((t) => courseIdOf(t) === course.id || (!t.externalId && t.context === course.name));
        const open = mine.filter((t) => t.status === "todo");
        const byDue = (a: Task, b: Task) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999");
        const tests = open.filter((t) => t.kind === "deadline").sort(byDue);
        const homework = open.filter((t) => t.kind !== "deadline").sort(byDue);
        const done = mine
          .filter((t) => t.status === "done" && (t.completedAt ?? "").slice(0, 10) >= recent)
          .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
        // Only label A/B once it's been chosen in Settings → School (don't guess).
        const pick = school.days[String(course.id)];
        const day = course.sampleDates.length >= 2 && pick !== undefined ? (pick === 1 ? "B day" : "A day") : null;
        const sorted = [...open].sort(byDue);
        const overdue = sorted.filter((t) => t.dueDate && t.dueDate < today).length;
        // "next" is the first thing still ahead (today or later); overdue work is counted separately.
        const next = sorted.find((t) => !t.dueDate || t.dueDate >= today) ?? null;
        return { course, day, tests, homework, done, next, overdue, sortKey: sorted[0]?.dueDate ?? "9999" };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey) || a.course.name.localeCompare(b.course.name));
  }, [school.courses, school.days, tasks, recent, today]);

  const active = classes.find((c) => c.course.id === selected) ?? classes[0];
  const dueThisWeek = classes.reduce((n, c) => n + c.homework.filter((t) => t.dueDate && t.dueDate <= weekEnd).length, 0);
  const testsSoon = classes.reduce((n, c) => n + c.tests.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate <= toDateKey(addDays(now, 14))).length, 0);

  const sync = async () => {
    setBusy(true);
    const r = await syncSchool();
    setBusy(false);
    toast(r.ok ? { text: r.added || r.updated ? `School sync: ${r.added} new, ${r.updated} updated` : "You're up to date", undo: r.added + r.updated > 0 } : { text: r.message ?? "Sync failed", tone: "error" });
  };

  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pt-6 sm:px-8 md:pt-10">
      <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="eyebrow mb-3 flex items-center gap-2">
            <GraduationCap size={12} /> Academic Staff
          </div>
          <h1 className="font-display text-[40px] leading-[1.02] text-ink sm:text-[52px]">
            School, <em className="text-ink-2">handled</em>.
          </h1>
          {classes.length > 0 && (
            <p className="mt-3 text-[15px] text-ink-2">
              {dueThisWeek} homework due this week · {testsSoon} test{testsSoon === 1 ? "" : "s"} in the next two weeks
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {school.lastSync && <span className="text-[12px] text-ink-4">Synced {ago(school.lastSync)}</span>}
          <button onClick={sync} disabled={busy} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs text-ink-2 hover:text-ink disabled:opacity-50">
            <RefreshCw size={12} className={busy ? "animate-spin" : ""} /> {busy ? "Syncing…" : "Sync now"}
          </button>
          <GradesButton url={gradesUrl} />
        </div>
      </header>

      {classes.length === 0 ? (
        <div className="panel p-8 text-center">
          <p className="font-display text-2xl text-ink">No classes yet.</p>
          <p className="mt-2 text-sm text-ink-3">Connect learn.vcs.net in Settings and your classes and homework show up here automatically.</p>
          <Link href="/settings" className="mt-4 inline-block rounded-xl border border-line-strong px-4 py-2 text-sm text-ink-2 hover:text-ink">
            Open Settings
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
          <ul className="space-y-2">
            {classes.map((c) => {
              const on = c.course.id === active?.course.id;
              return (
                <li key={c.course.id}>
                  <button
                    onClick={() => {
                      setSelected(c.course.id);
                      // On narrow screens the details sit below the list: bring them into view.
                      if (window.innerWidth < 1024) {
                        requestAnimationFrame(() => document.getElementById("class-detail")?.scrollIntoView({ behavior: "smooth", block: "start" }));
                      }
                    }}
                    aria-pressed={on}
                    className={`w-full rounded-2xl border p-4 text-left transition-colors ${on ? "border-gold/60 bg-gold/[0.06]" : "border-line hover:border-line-strong hover:bg-ink/[0.02]"}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[15px] leading-snug text-ink">{c.course.name}</span>
                      {c.day && <span className="shrink-0 rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-ink-3">{c.day}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                      <span className="text-ink-3">{c.homework.length} homework</span>
                      {c.tests.length > 0 && <span className="text-coral">{c.tests.length} test{c.tests.length === 1 ? "" : "s"}</span>}
                      {c.overdue > 0 && <span className="text-coral">{c.overdue} overdue</span>}
                      {c.next?.dueDate && <span className="text-ink-4">next due {relativeDay(c.next.dueDate, now).toLowerCase()}</span>}
                      {!c.next && c.overdue === 0 && <span className="text-sage">all caught up</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {active && <ClassDetail key={active.course.id} data={active} now={now} gradesUrl={gradesUrl} />}
        </div>
      )}
    </div>
  );
}

function GradesButton({ url, compact }: { url: string; compact?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(url);
  const setProfile = useStore((s) => s.setProfile);
  if (editing || !url) {
    if (!editing && compact) return null;
    return editing ? (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = draft.trim();
          if (v && !/^https:\/\//i.test(v)) return;
          setProfile({ gradesUrl: v });
          setEditing(false);
        }}
        className="flex items-center gap-1.5"
      >
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="https://… your PowerSchool link"
          className="w-64 rounded-xl border border-line bg-ink/[0.025] px-3 py-1.5 text-xs text-ink outline-none placeholder:text-ink-4 focus:border-line-strong"
        />
        <button className="rounded-xl border border-line-strong px-3 py-1.5 text-xs text-ink-2 hover:text-ink">Save</button>
      </form>
    ) : (
      <button onClick={() => setEditing(true)} className="rounded-xl border border-dashed border-line-strong px-3 py-1.5 text-xs text-ink-3 hover:text-ink">
        + Add PowerSchool link
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl bg-gold px-3 py-1.5 text-xs font-medium text-on-accent">
        Grades in PowerSchool <ArrowUpRight size={12} />
      </a>
      {!compact && (
        <button onClick={() => { setDraft(url); setEditing(true); }} className="px-1.5 text-[11px] text-ink-4 hover:text-ink-2">
          edit
        </button>
      )}
    </span>
  );
}

function ClassDetail({ data, now, gradesUrl }: { data: ClassData; now: Date; gradesUrl: string }) {
  const { course, day, tests, homework, done } = data;
  const [showDone, setShowDone] = useState(false);
  const today = toDateKey(now);
  const tomorrow = toDateKey(addDays(now, 1));
  const groups: [string, Task[], string?][] = [
    ["Overdue", homework.filter((t) => t.dueDate && t.dueDate < today), "var(--coral)"],
    ["Due today", homework.filter((t) => t.dueDate === today), "var(--amber)"],
    ["Due tomorrow", homework.filter((t) => t.dueDate === tomorrow), "var(--gold)"],
    ["Later", homework.filter((t) => t.dueDate && t.dueDate > tomorrow)],
    ["No due date", homework.filter((t) => !t.dueDate)],
  ];

  const ask = () => {
    useChat.getState().setAgent("academic");
    useUI.getState().openCommand(`What do I have coming up in ${course.name}, and what should I do first?`, true);
  };

  return (
    <motion.section id="class-detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="panel scroll-mt-20 p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-[30px] leading-tight text-ink">{course.name}</h2>
          <p className="mt-1 text-[13px] text-ink-3">
            {teacherOf(course.fullname) ?? "Class"}
            {day ? ` · ${day}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={ask} className="ai-ring flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs text-ink-2 hover:text-ink">
            <Sparkles size={12} className="text-ice" /> Ask Academic Staff
          </button>
          <a href={`${MOODLE}/course/view.php?id=${course.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 rounded-xl border border-line px-3 py-1.5 text-xs text-ink-3 hover:text-ink">
            learn.vcs.net <ArrowUpRight size={12} />
          </a>
          <GradesButton url={gradesUrl} compact />
        </div>
      </div>

      <div className="mb-6">
        <h3 className="eyebrow mb-2">Tests &amp; quizzes</h3>
        {tests.length === 0 ? (
          <p className="text-sm text-ink-4">None coming up.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tests.map((t) => {
              const d = t.dueDate ? daysUntil(t.dueDate, now) : null;
              return (
                <button
                  key={t.id}
                  onClick={() => useUI.getState().editTask(t.id)}
                  className="flex min-w-[170px] items-center gap-3 rounded-xl border border-coral/25 bg-coral/[0.05] px-3.5 py-2.5 text-left hover:border-coral/45"
                >
                  <span className="font-display text-[28px] leading-none tabular text-coral">{d === null ? "–" : Math.max(d, 0)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-ink">{t.title}</span>
                    <span className="block text-[11.5px] text-ink-3">
                      {t.dueDate ? `${d === 0 ? "today" : d === 1 ? "tomorrow" : d !== null && d < 0 ? "past" : `in ${d} days`} · ${format(parseDateKey(t.dueDate), "EEE MMM d")}` : "no date"}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <h3 className="eyebrow mb-1">Homework</h3>
      {homework.length === 0 ? (
        <p className="py-2 text-sm text-ink-4">Nothing due. Nice.</p>
      ) : (
        <div className="-mx-3 space-y-3">
          {groups.map(([label, list, accent]) =>
            list.length ? (
              <div key={label}>
                <div className="mb-0.5 flex items-center gap-2 px-3 text-[12px] text-ink-3">
                  {accent && <span className="size-1.5 rounded-full" style={{ background: accent }} />}
                  {label}
                </div>
                <ul>
                  {list.map((t) => (
                    <TaskRow key={t.id} task={t} now={now} />
                  ))}
                </ul>
              </div>
            ) : null,
          )}
        </div>
      )}

      {done.length > 0 && (
        <div className="-mx-3 mt-4 border-t border-line pt-3">
          <button onClick={() => setShowDone((v) => !v)} className="flex w-full items-center gap-2 px-3 py-1 text-[12.5px] text-ink-3 hover:text-ink-2">
            <ChevronDown size={13} className={`transition-transform ${showDone ? "" : "-rotate-90"}`} />
            Done in the last two weeks <span className="ml-auto tabular text-[11px] text-ink-4">{done.length}</span>
          </button>
          {showDone && (
            <ul>
              {done.map((t) => (
                <TaskRow key={t.id} task={t} now={now} />
              ))}
            </ul>
          )}
        </div>
      )}

      {!gradesUrl && (
        <p className="mt-6 text-[12px] text-ink-4">
          Grades live in PowerSchool, which doesn&apos;t share them with other apps. Add your PowerSchool link at the top of this page for a one-tap shortcut.
        </p>
      )}
    </motion.section>
  );
}

function AcademicSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-4 pt-6 sm:px-8 md:pt-10">
      <Skeleton className="mb-3 h-3 w-32" />
      <Skeleton className="mb-8 h-12 w-80" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_1fr]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}
