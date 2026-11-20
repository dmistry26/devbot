"use client";

import { motion } from "framer-motion";
import type { Category, Priority } from "@/lib/types";
import { CATEGORY_META, PRIORITY_META } from "./meta";

export function Check({
  checked,
  onChange,
  color = "var(--gold)",
  label,
}: {
  checked: boolean;
  onChange: () => void;
  color?: string;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className="group relative grid size-[20px] shrink-0 place-items-center rounded-full border transition-colors duration-300"
      style={{
        borderColor: checked ? color : "var(--line-strong)",
        background: checked ? color : "transparent",
      }}
    >
      <span
        className="absolute inset-0 rounded-full opacity-0 transition-opacity group-hover:opacity-100"
        style={{ boxShadow: `0 0 0 4px color-mix(in srgb, ${color} 14%, transparent)` }}
      />
      <motion.svg
        viewBox="0 0 16 16"
        className="size-[11px]"
        initial={false}
        animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.6 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.path
          d="M3.5 8.5l3 3 6-7"
          fill="none"
          stroke="var(--on-accent)"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        />
      </motion.svg>
    </button>
  );
}

export function CategoryDot({ category, size = 6 }: { category: Category; size?: number }) {
  const c = CATEGORY_META[category].color;
  return (
    <span
      className="inline-block shrink-0 rounded-full"
      style={{ width: size, height: size, background: c, boxShadow: `0 0 10px ${c}` }}
    />
  );
}

export function CategoryTag({ category, label }: { category: Category; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-3">
      <CategoryDot category={category} size={5} />
      {label ?? CATEGORY_META[category].label}
    </span>
  );
}

/** Three tiny ascending bars — reads as signal strength, not alarm. */
export function PriorityBars({ priority }: { priority: Priority }) {
  const m = PRIORITY_META[priority];
  return (
    <span className="inline-flex items-end gap-[2px]" title={`${m.label} priority`} aria-label={`${m.label} priority`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-[1px]"
          style={{
            height: 5 + i * 3,
            background: i < m.bars ? m.color : "var(--line-strong)",
          }}
        />
      ))}
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[5px] border border-line-strong bg-ink/[0.03] px-1.5 py-[1px] font-mono text-[10.5px] text-ink-3">
      {children}
    </kbd>
  );
}

export function SectionHeader({
  label,
  right,
  icon,
}: {
  label: string;
  right?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon && <span className="text-ink-3">{icon}</span>}
        <h2 className="eyebrow">{label}</h2>
      </div>
      {right}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-ink/[0.03] ${className}`} />;
}
