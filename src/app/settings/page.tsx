"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHydrated, useStore } from "@/lib/store";
import { useChat } from "@/components/command/chat-store";
import { PageHeader } from "@/components/ui/PageHeader";
import { SchoolSettings } from "@/components/settings/SchoolSettings";
import { CalendarSettings } from "@/components/settings/CalendarSettings";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { GradesSettings } from "@/components/settings/GradesSettings";
import { useUI } from "@/components/ui/ui-store";

export default function SettingsPage() {
  const hydrated = useHydrated();
  const router = useRouter();
  const name = useStore((s) => s.profile.name);
  const setProfile = useStore((s) => s.setProfile);
  const counts = { t: useStore((s) => s.tasks.length), e: useStore((s) => s.events.length), p: useStore((s) => s.projects.length) };
  const toast = useUI((s) => s.toast);
  const [confirm, setConfirm] = useState(false);
  if (!hydrated) return null;

  const erase = () => {
    useStore.getState().replaceAll({ tasks: [], events: [], projects: [], notes: [] }, "Erased all data");
    useChat.getState().clear();
    setConfirm(false);
    toast({ text: "All data erased", undo: true });
  };

  return (
    <div className="mx-auto max-w-[720px] px-4 pt-6 sm:px-8 md:pt-12">
      <PageHeader eyebrow="Settings" title="Settings" />
      <div className="space-y-5">
        <section className="panel p-6">
          <h2 className="eyebrow mb-4">Profile</h2>
          <label className="block space-y-2">
            <span className="text-sm text-ink-2">What should devbot call you?</span>
            <input
              defaultValue={name}
              onBlur={(e) => setProfile({ name: e.target.value.trim() })}
              className="w-full max-w-xs rounded-xl border border-line bg-ink/[0.025] px-3 py-2 text-sm text-ink outline-none focus:border-line-strong"
            />
          </label>
        </section>

        <AppearanceSettings />

        <SchoolSettings />

        <GradesSettings />

        <CalendarSettings />

        <section className="panel p-6">
          <h2 className="eyebrow mb-4">Your data</h2>
          <p className="text-sm leading-relaxed text-ink-2">
            Right now everything is stored in this browser ({counts.t} tasks, {counts.e} events, {counts.p} projects). Once Supabase is connected, it will sync securely across your devices.
          </p>
          {confirm ? (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm text-coral">Erase everything in this browser?</span>
              <button onClick={erase} className="rounded-lg bg-coral px-3 py-1.5 text-xs font-medium text-on-accent">Erase</button>
              <button onClick={() => setConfirm(false)} className="text-xs text-ink-3">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirm(true)} className="mt-4 text-sm text-ink-3 hover:text-coral">Erase all data…</button>
          )}
        </section>

        <section className="panel p-6">
          <h2 className="eyebrow mb-4">This device</h2>
          <p className="text-sm leading-relaxed text-ink-2">When devbot is online, it&apos;s protected by your password. Lock this device to require the password again.</p>
          <button
            onClick={async () => {
              await fetch("/api/unlock", { method: "DELETE" });
              router.replace("/unlock");
            }}
            className="mt-4 rounded-xl border border-line px-4 py-2 text-sm text-ink-2 hover:text-ink"
          >
            Lock devbot on this device
          </button>
        </section>

        <section className="panel p-6">
          <h2 className="eyebrow mb-4">Coming next</h2>
          <ul className="space-y-1.5 text-sm text-ink-3">
            <li>Notifications — morning briefing, reminders, evening summary</li>
            <li>Account &amp; sync (Supabase)</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
