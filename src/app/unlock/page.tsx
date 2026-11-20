"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Lock } from "lucide-react";
import { Mark } from "@/components/shell/AppShell";

export default function UnlockPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (data.ok) {
        const next = new URLSearchParams(window.location.search).get("next");
        // Only allow same-site paths.
        // Keep the #fragment (the grades bookmark sends its data there).
        window.location.replace((next && next.startsWith("/") && !next.startsWith("//") ? next : "/") + window.location.hash);
        return;
      }
      setError(data.error ?? "Couldn't unlock.");
    } catch {
      setError("Couldn't reach devbot.");
    }
    setBusy(false);
    setPassword("");
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 12, filter: "blur(6px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="panel w-full max-w-sm p-7 text-center"
      >
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-2xl border border-line">
          <Mark size={26} />
        </div>
        <h1 className="font-display text-[34px] leading-none text-ink">
          dev<em className="text-gold">bot</em>
        </h1>
        <p className="mt-2 text-sm text-ink-3">Enter your password to continue.</p>
        <div className="mt-6 flex items-center gap-2 rounded-xl border border-line bg-ink/[0.025] pl-3 focus-within:border-line-strong">
          <Lock size={14} className="shrink-0 text-ink-4" />
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-ink-4 focus-visible:outline-none"
          />
          <button
            disabled={!password || busy}
            aria-label="Unlock"
            className="m-1 grid size-8 shrink-0 place-items-center rounded-lg bg-gold text-on-accent transition-opacity disabled:opacity-30"
          >
            <ArrowRight size={15} />
          </button>
        </div>
        {error && <p className="mt-3 text-[13px] text-coral">{error}</p>}
        <p className="mt-5 text-[11.5px] text-ink-4">You&apos;ll stay signed in on this device.</p>
      </motion.form>
    </div>
  );
}
