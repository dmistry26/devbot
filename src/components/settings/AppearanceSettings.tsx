"use client";

import { Check, Monitor, Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/lib/theme";
import { ACCENTS, type ThemeMode } from "@/lib/theme-script";

const MODES: { id: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { id: "dark", label: "Dark", Icon: Moon },
  { id: "light", label: "Light", Icon: Sun },
  { id: "system", label: "Match system", Icon: Monitor },
];

export function AppearanceSettings() {
  const theme = useTheme();
  return (
    <section className="panel p-6">
      <h2 className="eyebrow mb-4">Appearance</h2>

      <div className="mb-2 text-sm text-ink-2">Theme</div>
      <div className="mb-6 grid grid-cols-3 gap-2">
        {MODES.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setTheme({ mode: id })}
            aria-pressed={theme.mode === id}
            className={`flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-xs transition-colors ${theme.mode === id ? "border-gold bg-gold/10 text-ink" : "border-line text-ink-3 hover:text-ink-2"}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      <div className="mb-2 text-sm text-ink-2">Colorway</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {ACCENTS.map((a) => {
          const on = theme.accent === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setTheme({ accent: a.id })}
              aria-pressed={on}
              className={`relative flex flex-col items-start gap-2.5 rounded-xl border p-3 text-left text-xs transition-colors ${on ? "border-gold text-ink" : "border-line text-ink-3 hover:text-ink-2"}`}
            >
              <span className="flex -space-x-1.5">
                <span className="size-5 rounded-full ring-2 ring-[var(--bg-raise)]" style={{ background: a.swatch[0] }} />
                <span className="size-5 rounded-full ring-2 ring-[var(--bg-raise)]" style={{ background: a.swatch[1] }} />
              </span>
              {a.name}
              {on && <Check size={13} className="absolute right-2.5 top-2.5 text-gold" />}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-ink-4">The first color is for you (buttons, progress), the second is for the AI.</p>
    </section>
  );
}

/** Compact sun/moon toggle for the navigation rail. */
export function ThemeToggle() {
  const theme = useTheme();
  const resolved = theme.mode === "system" ? null : theme.mode;
  const next = resolved === "light" ? "dark" : "light";
  return (
    <button
      onClick={() => setTheme({ mode: next })}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="grid size-10 place-items-center rounded-xl text-ink-3 transition-colors hover:text-ink"
    >
      {resolved === "light" ? <Moon size={17} strokeWidth={1.6} /> : <Sun size={17} strokeWidth={1.6} />}
    </button>
  );
}
