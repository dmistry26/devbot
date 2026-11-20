"use client";

import { useEffect, useRef, useState } from "react";
import { Bookmark, Check, Copy } from "lucide-react";
import { useStore } from "@/lib/store";
import { bookmarkletFor } from "@/lib/grades/bookmarklet";
import { useUI } from "@/components/ui/ui-store";

function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

export function GradesSettings() {
  const grades = useStore((s) => s.grades);
  const toast = useUI((s) => s.toast);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const local = /localhost|127\.0\.0\.1/.test(origin);

  useEffect(() => {
    const c = bookmarkletFor(window.location.origin);
    // React blocks javascript: URLs in JSX, so set the bookmark's href directly.
    linkRef.current?.setAttribute("href", c);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCode(c);
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ text: "Couldn't copy — long-press the button and copy the link instead", tone: "error" });
    }
  };

  return (
    <section id="grades" className="panel scroll-mt-20 p-6">
      <h2 className="eyebrow mb-4">Grades · PowerSchool</h2>
      <p className="text-sm leading-relaxed text-ink-2">
        PowerSchool doesn&apos;t let apps read grades, so devbot uses a bookmark: open your grades in PowerSchool, tap{" "}
        <span className="text-ink">Send to devbot</span>, and your grades show up on the Academic page. Your PowerSchool password never touches devbot.
      </p>
      {grades && (
        <p className="mt-3 text-[13px] text-sage">
          Last imported {ago(grades.importedAt)} · {grades.classes.length} classes
        </p>
      )}
      {local && (
        <p className="mt-3 rounded-xl border border-amber/30 bg-amber/[0.06] px-3 py-2 text-[12.5px] text-amber">
          You&apos;re on the local version. Set the bookmark up from your online devbot instead so it works from your phone too.
        </p>
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <div className="mb-2 text-[13px] text-ink">On a laptop</div>
          <p className="mb-3 text-[12.5px] leading-relaxed text-ink-3">Show your bookmarks bar (⌘⇧B), then drag this button onto it:</p>
          <a
            ref={linkRef}
            onClick={(e) => {
              e.preventDefault();
              toast({ text: "Drag it to your bookmarks bar instead of clicking" });
            }}
            className="inline-flex cursor-grab items-center gap-1.5 rounded-xl bg-gold px-3 py-1.5 text-xs font-medium text-on-accent active:cursor-grabbing"
          >
            <Bookmark size={12} /> Send to devbot
          </a>
        </div>
        <div className="rounded-xl border border-line p-4">
          <div className="mb-2 text-[13px] text-ink">On iPhone (Safari)</div>
          <ol className="mb-3 list-decimal space-y-1 pl-4 text-[12.5px] leading-relaxed text-ink-3">
            <li>Copy the bookmark code below.</li>
            <li>Bookmark any page: Share → Add Bookmark, name it &ldquo;Send to devbot&rdquo;.</li>
            <li>Open Bookmarks → Edit → that bookmark, and replace its address with the copied code.</li>
          </ol>
          <button onClick={copy} disabled={!code} className="inline-flex items-center gap-1.5 rounded-xl border border-line-strong px-3 py-1.5 text-xs text-ink-2 hover:text-ink disabled:opacity-40">
            {copied ? <Check size={12} className="text-sage" /> : <Copy size={12} />} {copied ? "Copied" : "Copy bookmark code"}
          </button>
        </div>
      </div>
      <p className="mt-4 text-[12px] text-ink-4">
        To update grades: open PowerSchool → Grades and Attendance → tap the bookmark. Grades stay on this device.
      </p>
    </section>
  );
}
