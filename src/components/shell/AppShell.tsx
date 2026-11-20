"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CalendarDays,
  FolderKanban,
  GraduationCap,
  House,
  ListChecks,
  Menu,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { CommandBar } from "@/components/command/CommandBar";
import { Toaster } from "@/components/ui/Toaster";
import { TaskEditor } from "@/components/ui/TaskEditor";
import { EventEditor } from "@/components/ui/EventEditor";
import { useUI } from "@/components/ui/ui-store";
import { useSystemThemeSync } from "@/lib/theme";
import { ThemeToggle } from "@/components/settings/AppearanceSettings";

const NAV = [
  { href: "/", label: "Home", icon: House },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/academic", label: "Academic", icon: GraduationCap },
] as const;

// Five teardrop petals around a filled center. The gradient spans the whole
// flower (userSpaceOnUse) so it flows across petals, and follows the colorway.
export const PETAL = "M12 11.2C9.6 8.9 9.7 4.6 12 2.9C14.3 4.6 14.4 8.9 12 11.2Z";

export function Mark({ size = 22 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="3" y1="3" x2="21" y2="21">
          <stop offset="0" style={{ stopColor: "var(--accent-hi)" }} />
          <stop offset="0.55" style={{ stopColor: "var(--gold)" }} />
          <stop offset="1" style={{ stopColor: "var(--ice)" }} />
        </linearGradient>
      </defs>
      <g fill={`url(#${id})`} fillOpacity="0.14" stroke={`url(#${id})`} strokeWidth="1.25" strokeLinejoin="round">
        {[0, 72, 144, 216, 288].map((deg) => (
          <path key={deg} d={PETAL} transform={`rotate(${deg} 12 12)`} />
        ))}
      </g>
      <circle cx="12" cy="12" r="2.3" fill={`url(#${id})`} />
    </svg>
  );
}

function RailLink({ href, label, Icon, active }: { href: string; label: string; Icon: typeof House; active: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="group relative grid size-10 place-items-center rounded-xl text-ink-3 transition-colors hover:text-ink"
    >
      {active && (
        <motion.span
          layoutId="rail-active"
          className="absolute inset-0 rounded-xl border border-line-strong bg-ink/[0.045]"
          transition={{ type: "spring", stiffness: 500, damping: 40 }}
        />
      )}
      <Icon size={18} strokeWidth={1.6} className={`relative ${active ? "text-ink" : ""}`} />
      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-md border border-line bg-raise px-2 py-1 text-xs text-ink-2 opacity-0 transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  useSystemThemeSync();
  const openCommand = useUI((s) => s.openCommand);
  // The menu is "open for a path", so navigating closes it without an effect.
  const [menuPath, setMenuPath] = useState<string | null>(null);
  const menu = menuPath === path;
  const setMenu = (fn: (m: boolean) => boolean) => setMenuPath(fn(menu) ? path : null);

  // The unlock screen stands alone: no navigation, command bar or editors.
  if (path === "/unlock") return <div className="relative z-10">{children}</div>;

  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <div className="relative z-10 flex min-h-dvh">
      {/* Desktop rail */}
      <nav className="sticky top-0 hidden h-dvh w-[68px] shrink-0 flex-col items-center border-r border-line py-5 md:flex">
        <Link href="/" aria-label="devbot home" className="mb-8 grid size-10 place-items-center">
          <Mark />
        </Link>
        <div className="flex flex-col gap-1.5">
          {NAV.map((n) => (
            <RailLink key={n.href} href={n.href} label={n.label} Icon={n.icon} active={isActive(n.href)} />
          ))}
        </div>
        <div className="mt-auto flex flex-col items-center gap-1.5">
          <button
            onClick={() => openCommand()}
            aria-label="Ask devbot"
            className="ai-ring grid size-10 place-items-center rounded-xl text-ice transition-colors hover:bg-ink/[0.04]"
          >
            <Sparkles size={17} strokeWidth={1.6} />
          </button>
          <ThemeToggle />
          <RailLink href="/settings" label="Settings" Icon={Settings} active={isActive("/settings")} />
        </div>
      </nav>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-30 flex items-center justify-between px-4 pb-2 pt-[max(env(safe-area-inset-top),12px)] md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Mark size={20} />
          <span className="font-display text-lg italic text-ink">devbot</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <div className="glass rounded-xl [&>button]:size-9">
            <ThemeToggle />
          </div>
          <Link href="/settings" aria-label="Settings" className="glass grid size-9 place-items-center rounded-xl text-ink-2">
            <Settings size={16} strokeWidth={1.7} />
          </Link>
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="Menu"
            className="glass grid size-9 place-items-center rounded-xl text-ink-2"
          >
            {menu ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass fixed right-4 top-16 z-30 w-52 rounded-2xl p-2 md:hidden"
          >
            {[...NAV, { href: "/settings", label: "Settings", icon: Settings }].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive(n.href) ? "bg-ink/[0.05] text-ink" : "text-ink-2"}`}
              >
                <n.icon size={16} strokeWidth={1.6} /> {n.label}
              </Link>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="min-w-0 flex-1 pb-40 pt-16 md:pt-0">{children}</main>

      <CommandBar />
      <TaskEditor />
      <EventEditor />
      <Toaster />
    </div>
  );
}
