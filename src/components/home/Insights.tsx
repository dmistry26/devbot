"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { computeInsights, type InsightTone } from "@/lib/derive";
import { useUI } from "@/components/ui/ui-store";

const TONE: Record<InsightTone, string> = {
  warn: "var(--amber)",
  info: "var(--ice)",
  good: "var(--sage)",
};

export function Insights({ now }: { now: Date }) {
  const data = useStore();
  const openCommand = useUI((s) => s.openCommand);
  const insights = computeInsights(data, now);

  return (
    <section className="panel ai-ring overflow-hidden p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-[radial-gradient(closest-side,rgba(143,194,255,0.14),transparent)]" />
      <div className="mb-4 flex items-center gap-2">
        <span className="grid size-6 place-items-center rounded-lg bg-ice/10 text-ice">
          <Sparkles size={12} />
        </span>
        <h2 className="eyebrow !text-ice/80">Chief of Staff</h2>
      </div>
      {insights.length === 0 ? (
        <p className="text-sm leading-relaxed text-ink-3">
          Nothing needs your attention right now. I&apos;ll flag things here as your deadlines and schedule fill in.
        </p>
      ) : (
        <ul className="space-y-1">
          {insights.map((ins, i) => (
            <motion.li
              key={ins.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
            >
              <button
                onClick={() => ins.prompt && openCommand(ins.prompt, true)}
                className="group flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
              >
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full" style={{ background: TONE[ins.tone], boxShadow: `0 0 8px ${TONE[ins.tone]}` }} />
                <span className="flex-1 text-[13.5px] leading-relaxed text-ink-2 group-hover:text-ink">{ins.text}</span>
                {ins.prompt && <ArrowUpRight size={14} className="mt-1 shrink-0 text-ink-4 transition-colors group-hover:text-ice" />}
              </button>
            </motion.li>
          ))}
        </ul>
      )}
    </section>
  );
}
