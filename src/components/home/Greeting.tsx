"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import { daySummary, todaysTasks } from "@/lib/derive";
import { format, greetingFor, schoolDayOn, toDateKey } from "@/lib/dates";

function DayDial({ done, total, now }: { done: number; total: number; now: Date }) {
  const mins = now.getHours() * 60 + now.getMinutes();
  // The "waking day" runs 7am–11pm.
  const dayPct = Math.min(1, Math.max(0, (mins - 7 * 60) / (16 * 60)));
  const taskPct = total ? done / total : 0;
  const R1 = 52;
  const R2 = 61;
  const c1 = 2 * Math.PI * R1;
  const c2 = 2 * Math.PI * R2;
  return (
    <div className="relative size-[84px] shrink-0 sm:size-[140px]">
      <svg viewBox="0 0 140 140" className="size-full -rotate-90">
        <defs>
          <linearGradient id="dial-gold" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--accent-hi)" }} />
            <stop offset="1" style={{ stopColor: "var(--gold)" }} />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r={R2} fill="none" stroke="var(--line)" strokeWidth="1.5" />
        <motion.circle
          cx="70" cy="70" r={R2} fill="none" stroke="var(--ice)" strokeWidth="1.5" strokeLinecap="round"
          strokeDasharray={c2}
          initial={{ strokeDashoffset: c2 }}
          animate={{ strokeDashoffset: c2 * (1 - dayPct) }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
          opacity={0.7}
        />
        <circle cx="70" cy="70" r={R1} fill="none" stroke="var(--line)" strokeWidth="6" />
        <motion.circle
          cx="70" cy="70" r={R1} fill="none" stroke="url(#dial-gold)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c1}
          initial={{ strokeDashoffset: c1 }}
          animate={{ strokeDashoffset: c1 * (1 - taskPct) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--gold) 45%, transparent))" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <div className="tabular font-display text-[22px] leading-none text-ink sm:text-[34px]">
            {done}
            <span className="text-ink-4">/{total}</span>
          </div>
          <div className="eyebrow mt-1.5 hidden !text-[9px] sm:block">done today</div>
        </div>
      </div>
    </div>
  );
}

export function Greeting({ now }: { now: Date }) {
  const data = useStore();
  const name = useStore((s) => s.profile.name);
  const setProfile = useStore((s) => s.setProfile);
  const [draft, setDraft] = useState("");
  const today = toDateKey(now);
  const schoolDay = schoolDayOn(data.events, today);
  const list = todaysTasks(data.tasks, today);
  const done = list.filter((t) => t.status === "done").length;

  return (
    <section className="flex items-start justify-between gap-4 sm:items-center sm:gap-6">
      <div className="min-w-0">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="eyebrow mb-3 flex flex-wrap items-center gap-x-2 gap-y-1"
        >
          <span className="size-1 rounded-full bg-gold shadow-[0_0_8px_var(--gold)]" />
          {format(now, "EEEE")} <span className="text-ink-4">·</span> {format(now, "MMMM d, yyyy")}
          {schoolDay && (
            <>
              <span className="text-ink-4">·</span> <span className="text-gold">{schoolDay}</span>
            </>
          )}
          <span className="text-ink-4">·</span> <span className="tabular">{format(now, "h:mm a")}</span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 10, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-[40px] leading-[1.02] tracking-[-0.01em] text-ink sm:text-[64px]"
        >
          {greetingFor(now)}
          {name ? (
            <>
              , <em className="bg-gradient-to-r from-[var(--accent-hi)] via-gold to-ice bg-clip-text text-transparent">{name}</em>.
            </>
          ) : (
            "."
          )}
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.25 }}
          className="mt-3 max-w-xl text-[15px] leading-relaxed text-ink-2"
        >
          {daySummary(data, now)}
        </motion.p>
        {!name && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) setProfile({ name: draft.trim() });
            }}
            className="mt-4 flex items-center gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="What should I call you?"
              className="w-56 rounded-xl border border-line bg-ink/[0.025] px-3 py-1.5 text-sm text-ink outline-none placeholder:text-ink-4 focus:border-line-strong"
            />
            {draft.trim() && (
              <button className="rounded-xl border border-line-strong px-3 py-1.5 text-xs text-gold">Save</button>
            )}
          </form>
        )}
      </div>
      <DayDial done={done} total={list.length} now={now} />
    </section>
  );
}
