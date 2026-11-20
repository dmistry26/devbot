"use client";

import { motion } from "framer-motion";
import { CalendarClock, Check, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { upcomingDeadlines } from "@/lib/derive";
import { format, parseDateKey } from "@/lib/dates";
import { CategoryDot, SectionHeader } from "@/components/ui/primitives";
import { useUI } from "@/components/ui/ui-store";

export function Deadlines({ now }: { now: Date }) {
  const data = useStore();
  const openCommand = useUI((s) => s.openCommand);
  const editTask = useUI((s) => s.editTask);
  const items = upcomingDeadlines(data, now, 14).slice(0, 6);

  return (
    <section className="panel p-5 sm:p-6">
      <SectionHeader label="On the horizon" icon={<CalendarClock size={13} />} />
      {items.length === 0 ? (
        <p className="py-4 text-sm text-ink-3">No deadlines in the next two weeks.</p>
      ) : (
        <div className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 scroll-thin">
          {items.map(({ task, days, prepScheduled }, i) => {
            const urgent = days <= 2;
            const accent = days < 0 ? "var(--coral)" : urgent ? "var(--amber)" : "var(--ink-2)";
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className="group relative flex w-[188px] shrink-0 snap-start flex-col rounded-2xl border border-line bg-white/[0.015] p-4 transition-colors hover:border-line-strong"
              >
                <button onClick={() => editTask(task.id)} className="text-left">
                  <div className="flex items-baseline gap-1.5">
                    <span className="tabular font-display text-[40px] leading-none" style={{ color: accent }}>
                      {days < 0 ? Math.abs(days) : days === 0 ? "0" : days}
                    </span>
                    <span className="text-xs text-ink-3">
                      {days < 0 ? "days late" : days === 0 ? "due today" : days === 1 ? "day" : "days"}
                    </span>
                  </div>
                  <div className="mt-3 line-clamp-2 min-h-[40px] text-sm leading-snug text-ink">{task.title}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ink-3">
                    <CategoryDot category={task.category} size={5} />
                    {format(parseDateKey(task.dueDate!), "EEE, MMM d")}
                  </div>
                </button>
                <div className="mt-3 border-t border-line pt-3">
                  {prepScheduled ? (
                    <span className="flex items-center gap-1.5 text-[11.5px] text-sage"><Check size={12} /> Prep planned</span>
                  ) : (
                    <button
                      onClick={() =>
                        openCommand(
                          `I have "${task.title}" due ${task.dueDate}. Help me prepare — break it into steps and schedule them in my free time before then.`,
                          true,
                        )
                      }
                      className="flex items-center gap-1.5 text-[11.5px] text-ice transition-opacity hover:opacity-80"
                    >
                      <Sparkles size={12} /> Plan prep
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
