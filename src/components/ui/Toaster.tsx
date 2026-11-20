"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Undo2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUI } from "./ui-store";

export function Toaster() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismiss);
  const undo = useStore((s) => s.undo);
  const toast = useUI((s) => s.toast);

  return (
    <div className="pointer-events-none fixed left-1/2 top-4 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col items-center gap-2 md:top-6">
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: -12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="glass pointer-events-auto flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm"
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{ background: t.tone === "error" ? "var(--coral)" : "var(--gold)" }}
            />
            <span className="min-w-0 flex-1 truncate text-ink">{t.text}</span>
            {t.undo && (
              <button
                onClick={() => {
                  const e = undo();
                  dismiss(t.id);
                  if (e) toast({ text: `Undid: ${e.label}` });
                }}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-gold transition-colors hover:bg-ink/[0.05]"
              >
                <Undo2 size={13} /> Undo
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
