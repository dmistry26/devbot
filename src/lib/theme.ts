"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_KEY, type Accent, type ThemeMode } from "./theme-script";

export interface ThemePref {
  mode: ThemeMode;
  accent: Accent;
}

const DEFAULT: ThemePref = { mode: "dark", accent: "champagne" };
const subs = new Set<() => void>();
let cached: ThemePref | null = null;

function read(): ThemePref {
  if (cached) return cached;
  try {
    cached = { ...DEFAULT, ...JSON.parse(localStorage.getItem(THEME_KEY) ?? "{}") };
  } catch {
    cached = DEFAULT;
  }
  return cached!;
}

const systemLight = () => window.matchMedia("(prefers-color-scheme: light)").matches;

function apply(p: ThemePref) {
  const el = document.documentElement;
  el.setAttribute("data-theme", p.mode === "system" ? (systemLight() ? "light" : "dark") : p.mode);
  el.setAttribute("data-accent", p.accent);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", getComputedStyle(el).getPropertyValue("--bg").trim() || "#06070a");
}

export function setTheme(p: Partial<ThemePref>) {
  const next = { ...read(), ...p };
  cached = next;
  try {
    localStorage.setItem(THEME_KEY, JSON.stringify(next));
  } catch {}
  apply(next);
  subs.forEach((f) => f());
}

export function useTheme(): ThemePref {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    read,
    () => DEFAULT,
  );
}

/** Keeps "system" mode in sync when the OS switches between light and dark. */
export function useSystemThemeSync() {
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => read().mode === "system" && apply(read());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
}
