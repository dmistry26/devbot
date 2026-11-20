import type { Category, Priority } from "@/lib/types";

export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  academic: { label: "Academic", color: "var(--cat-blue)" },
  project: { label: "Project", color: "var(--cat-gold)" },
  personal: { label: "Personal", color: "var(--sage)" },
  health: { label: "Health", color: "var(--rose)" },
  social: { label: "Social", color: "var(--violet)" },
  other: { label: "Other", color: "var(--ink-2)" },
};

export const PRIORITY_META: Record<Priority, { label: string; color: string; bars: number }> = {
  urgent: { label: "Urgent", color: "var(--coral)", bars: 3 },
  high: { label: "High", color: "var(--amber)", bars: 2 },
  normal: { label: "Normal", color: "var(--ink-2)", bars: 1 },
  low: { label: "Low", color: "var(--ink-4)", bars: 0 },
};
