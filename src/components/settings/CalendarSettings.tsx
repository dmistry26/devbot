"use client";

import { useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { syncCalendar, VCS_CALENDARS } from "@/lib/calendar-sync";
import { CATEGORIES, type Category } from "@/lib/types";
import { CATEGORY_META } from "@/components/ui/meta";
import { useUI } from "@/components/ui/ui-store";

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

const field =
  "w-full rounded-xl border border-line bg-ink/[0.025] px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-ink-4 focus:border-line-strong";

export function CalendarSettings() {
  const calendars = useStore((s) => s.calendars);
  const toast = useUI((s) => s.toast);
  const [busy, setBusy] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const hasVcs = VCS_CALENDARS.every((v) => calendars.some((c) => c.url === v.url));

  const add = async (c: { name: string; url: string; category: Category }) => {
    const id = useStore.getState().addCalendar(c);
    const cal = useStore.getState().calendars.find((x) => x.id === id)!;
    setBusy(id);
    const r = await syncCalendar(cal);
    setBusy(null);
    if (r.ok && r.name && !c.name) useStore.getState().updateCalendar(id, { name: r.name });
    return r;
  };

  const addVcs = async () => {
    let total = 0;
    for (const v of VCS_CALENDARS) {
      if (calendars.some((c) => c.url === v.url)) continue;
      const r = await add(v);
      total += r.count;
    }
    toast({ text: `Added school calendars (${total} events)` });
  };

  const addCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const r = await add({ name: name.trim(), url: url.trim(), category: "other" });
    if (r.ok) {
      toast({ text: `Calendar added (${r.count} events)` });
      setUrl("");
      setName("");
    } else toast({ text: r.error ?? "Couldn't add that calendar", tone: "error" });
  };

  const refresh = async (id: string) => {
    const cal = useStore.getState().calendars.find((c) => c.id === id);
    if (!cal) return;
    setBusy(id);
    const r = await syncCalendar(cal);
    setBusy(null);
    toast(r.ok ? { text: `Refreshed ${cal.name} (${r.count} events)` } : { text: r.error ?? "Refresh failed", tone: "error" });
  };

  return (
    <section className="panel p-6">
      <h2 className="eyebrow mb-4">Calendars</h2>
      <p className="mb-4 text-sm leading-relaxed text-ink-2">
        Subscribe to calendar feeds (Google Calendar, iCal links). Their events show up read-only in your calendar and refresh automatically.
      </p>

      {!hasVcs && (
        <button
          onClick={addVcs}
          disabled={!!busy}
          className="mb-4 flex w-full items-center justify-between gap-3 rounded-xl border border-line-strong px-4 py-3 text-left transition-colors hover:bg-ink/[0.03] disabled:opacity-50"
        >
          <span>
            <span className="block text-sm text-ink">Add VCS High School calendars</span>
            <span className="block text-[12px] text-ink-3">School events, breaks and no-school days, plus which days are A and B days</span>
          </span>
          <Plus size={16} className="shrink-0 text-gold" />
        </button>
      )}

      {calendars.length > 0 && (
        <ul className="mb-4 divide-y divide-line rounded-xl border border-line">
          {calendars.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-3.5 py-3">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: CATEGORY_META[c.category].color }} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-ink">{c.name || "Untitled calendar"}</div>
                <div className={`truncate text-[11.5px] ${c.error ? "text-coral" : "text-ink-4"}`}>
                  {c.error ? c.error : c.lastSync ? `Updated ${ago(c.lastSync)}` : busy === c.id ? "Syncing…" : "Not synced yet"}
                </div>
              </div>
              <select
                value={c.category}
                onChange={(e) => useStore.getState().updateCalendar(c.id, { category: e.target.value as Category })}
                aria-label="Color"
                className="rounded-lg border border-line bg-transparent px-2 py-1 text-xs text-ink-2 outline-none"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat} className="bg-raise">{CATEGORY_META[cat].label}</option>
                ))}
              </select>
              <button onClick={() => refresh(c.id)} disabled={!!busy} aria-label={`Refresh ${c.name}`} className="grid size-7 place-items-center rounded-lg text-ink-3 hover:text-ink disabled:opacity-40">
                <RefreshCw size={13} className={busy === c.id ? "animate-spin" : ""} />
              </button>
              <button
                onClick={() => {
                  useStore.getState().removeCalendar(c.id);
                  toast({ text: `Removed ${c.name}` });
                }}
                aria-label={`Remove ${c.name}`}
                className="grid size-7 place-items-center rounded-lg text-ink-4 hover:text-coral"
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addCustom} className="space-y-2">
        <div className="text-[12.5px] text-ink-3">Add another calendar by link</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… or webcal://… (.ics link)" className={field} />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" className={`${field} sm:max-w-[180px]`} />
          <button disabled={!url.trim() || !!busy} className="shrink-0 rounded-xl border border-line-strong px-4 py-2 text-sm text-ink-2 hover:text-ink disabled:opacity-40">
            Add
          </button>
        </div>
      </form>
    </section>
  );
}
