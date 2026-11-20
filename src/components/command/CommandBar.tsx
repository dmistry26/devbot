"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, BrainCircuit, CalendarCheck, GraduationCap, Mic, Sparkles, Square, Trash, X, Compass } from "lucide-react";
import { snapshotOf, useHydrated, useStore } from "@/lib/store";
import { toDateTime } from "@/lib/dates";
import type { AgentId } from "@/lib/ai/prompt";
import { Kbd } from "@/components/ui/primitives";
import { useUI } from "@/components/ui/ui-store";
import { useChat, type ChatMessage, type ProposalState } from "./chat-store";
import { ProposalCard } from "./ProposalCard";
import type { CommandResponse } from "@/app/api/command/route";

const AGENTS: Record<AgentId, { name: string; short: string; Icon: typeof Sparkles; color: string }> = {
  chief: { name: "Chief of Staff", short: "Chief", Icon: Compass, color: "var(--ice)" },
  academic: { name: "Academic Staff", short: "Academic", Icon: GraduationCap, color: "var(--gold)" },
};

const CHIPS = [
  { label: "Plan my day", Icon: CalendarCheck, text: "Plan my day — fit my most important tasks into my free time today.", send: true },
  { label: "Brain dump", Icon: BrainCircuit, text: "Brain dump: ", send: false },
  { label: "What should I prioritize?", Icon: Sparkles, text: "What should I prioritize today?", send: true },
];

// Minimal typing for the Web Speech API (not in lib.dom for all browsers).
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

function useSpeech(onText: (t: string, final: boolean) => void) {
  const hydrated = useHydrated();
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const supported =
    hydrated &&
    !!((window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);
  const start = () => {
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        final = e.results[i].isFinal;
      }
      onText(text, final);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  };
  const stop = () => rec.current?.stop();
  return { supported, listening, start, stop };
}

export function CommandBar() {
  const open = useUI((s) => s.commandOpen);
  const openCommand = useUI((s) => s.openCommand);
  const close = useUI((s) => s.closeCommand);
  const { messages, agent, add, patch, setAgent, clear } = useChat();
  const input = useUI((s) => s.draft);
  const pendingSend = useUI((s) => s.pendingSend);
  const setInput = useUI((s) => s.setDraft);
  const busy = useChat((s) => s.busy);
  const setBusy = useChat((s) => s.setBusy);
  const hydrated = useHydrated();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef("");

  const speech = useSpeech((t, final) => {
    useUI.getState().setDraft((baseRef.current ? baseRef.current + " " : "") + t);
    if (final) baseRef.current = "";
  });

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || useChat.getState().busy) return;
      const chat = useChat.getState();
      const agentNow = chat.agent;
      const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content, at: toDateTime(new Date()), agent: agentNow };
      add(userMsg);
      setInput("");
      setBusy(true);
      try {
        const history = [...chat.messages, userMsg]
          .filter((m) => !m.error)
          .slice(-12)
          .map((m) => ({
            role: m.role,
            content:
              m.role === "assistant" && m.actions?.length
                ? `${m.content}\n[Proposed ${m.actions.length} change(s); user ${m.proposal === "applied" ? "applied them" : m.proposal === "discarded" ? "discarded them" : "has not decided yet"}]`
                : m.content,
          }));
        const res = await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            snapshot: snapshotOf(useStore.getState()),
            now: toDateTime(new Date()),
            agent: agentNow,
          }),
        });
        const data = (await res.json()) as CommandResponse;
        add({
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.reply,
          agent: data.agent,
          at: toDateTime(new Date()),
          actions: data.actions?.length ? data.actions : undefined,
          proposal: data.actions?.length ? "pending" : undefined,
          error: !!data.error,
        });
      } catch {
        add({ id: crypto.randomUUID(), role: "assistant", content: "Couldn't reach the server. Is the dev server running?", at: toDateTime(new Date()), error: true });
      } finally {
        setBusy(false);
      }
    },
    [add, setInput, setBusy],
  );

  // ⌘K / Ctrl+K toggles; "/" opens when not typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input, textarea, select, [contenteditable]");
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (useUI.getState().commandOpen) close();
        else openCommand();
      } else if (e.key === "/" && !typing && !useUI.getState().commandOpen) {
        e.preventDefault();
        openCommand();
      } else if (e.key === "Escape" && useUI.getState().commandOpen) {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openCommand, close]);

  // Pick up drafts from elsewhere in the app (insight taps, "Plan prep", etc.).
  useEffect(() => {
    if (!open) return;
    const pending = useUI.getState().takePendingSend();
    if (pending) send(pending);
    setTimeout(() => {
      const el = inputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 60);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingSend]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, busy, open]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input, open]);

  const A = AGENTS[agent];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          />
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(env(safe-area-inset-bottom),14px)] md:pl-[68px]">
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 380, damping: 36 }}
          className={`glass pointer-events-auto flex w-full flex-col overflow-hidden ${open ? "ai-ring max-w-[720px] rounded-[26px]" : "max-w-[600px] rounded-[22px]"}`}
        >
          {open && (
            <>
              <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                <div className="flex items-center gap-1 rounded-xl bg-white/[0.03] p-0.5">
                  {(Object.keys(AGENTS) as AgentId[]).map((id) => {
                    const a = AGENTS[id];
                    const on = agent === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setAgent(id)}
                        className={`relative flex items-center gap-1.5 rounded-[10px] px-2.5 py-1 text-xs transition-colors ${on ? "text-ink" : "text-ink-3 hover:text-ink-2"}`}
                      >
                        {on && <motion.span layoutId="agent-pill" className="absolute inset-0 rounded-[10px] border border-line-strong bg-white/[0.05]" />}
                        <a.Icon size={12} className="relative" style={{ color: on ? a.color : undefined }} />
                        <span className="relative">{a.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-1">
                  {messages.length > 0 && (
                    <button onClick={clear} aria-label="Clear conversation" title="Clear conversation" className="grid size-7 place-items-center rounded-lg text-ink-4 hover:text-ink-2">
                      <Trash size={13} />
                    </button>
                  )}
                  <button onClick={close} aria-label="Close" className="grid size-7 place-items-center rounded-lg text-ink-3 hover:text-ink">
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div ref={scrollRef} className="scroll-thin max-h-[min(58vh,560px)] overflow-y-auto px-4 py-4">
                {hydrated && messages.length === 0 && !busy ? (
                  <div className="py-4">
                    <p className="font-display text-[24px] leading-tight text-ink">
                      What&apos;s changed? <em className="text-ink-3">Tell me anything.</em>
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
                      &ldquo;APUSH test next Friday, help me prepare&rdquo; · &ldquo;Robotics meeting Thursday 5–7&rdquo; · &ldquo;I finished the lab report&rdquo; · or paste everything on your mind.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((m) => (
                      <Message key={m.id} m={m} onResolve={(p) => patch(m.id, { proposal: p })} />
                    ))}
                    {busy && (
                      <div className="flex items-center gap-2 text-[13px] text-ink-3">
                        <span className="flex gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              className="size-1.5 rounded-full"
                              style={{ background: A.color }}
                              animate={{ opacity: [0.25, 1, 0.25] }}
                              transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                            />
                          ))}
                        </span>
                        {A.name} is thinking…
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 scroll-thin">
                {CHIPS.map((c) => (
                  <button
                    key={c.label}
                    disabled={busy}
                    onClick={() => (c.send ? send(c.text) : (setInput(c.text), inputRef.current?.focus()))}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-3 py-1 text-xs text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-40"
                  >
                    <c.Icon size={12} className="text-ice" /> {c.label}
                  </button>
                ))}
              </div>
            </>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!open) return openCommand();
              send(input);
            }}
            className="flex items-end gap-2 px-3 py-2.5"
          >
            <span className="grid size-9 shrink-0 place-items-center">
              <Sparkles size={17} className="text-ice" />
            </span>
            {open ? (
              <textarea
                ref={inputRef}
                autoFocus
                value={input}
                rows={1}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder={`Message ${A.name}…`}
                className="max-h-[200px] min-h-[36px] flex-1 resize-none bg-transparent py-2 focus-visible:outline-none text-[15px] leading-snug text-ink outline-none placeholder:text-ink-4"
              />
            ) : (
              <button type="button" onClick={() => openCommand()} className="flex h-9 flex-1 items-center text-left text-[14.5px] text-ink-3">
                <span className="truncate">
                  Ask devbot<span className="hidden sm:inline">, or tell it what changed</span>…
                </span>
              </button>
            )}
            {!open && (
              <span className="hidden h-9 items-center gap-1 sm:flex">
                <Kbd>⌘</Kbd>
                <Kbd>K</Kbd>
              </span>
            )}
            {speech.supported && (
              <button
                type="button"
                onClick={() => {
                  if (!open) openCommand();
                  if (speech.listening) speech.stop();
                  else {
                    baseRef.current = input;
                    speech.start();
                  }
                }}
                aria-label={speech.listening ? "Stop listening" : "Speak"}
                className={`relative grid size-9 shrink-0 place-items-center rounded-xl transition-colors ${speech.listening ? "text-coral" : "text-ink-3 hover:text-ink"}`}
              >
                {speech.listening && <span className="absolute inset-1 animate-ping rounded-xl bg-coral/20" />}
                {speech.listening ? <Square size={14} fill="currentColor" /> : <Mic size={17} />}
              </button>
            )}
            {open && (
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label="Send"
                className="grid size-9 shrink-0 place-items-center rounded-xl bg-gold text-[#14110a] transition-opacity disabled:opacity-30"
              >
                <ArrowUp size={17} strokeWidth={2.2} />
              </button>
            )}
          </form>
        </motion.div>
      </div>
    </>
  );
}

function Message({ m, onResolve }: { m: ChatMessage; onResolve: (p: ProposalState) => void }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-white/[0.06] px-3.5 py-2 text-[14px] leading-relaxed text-ink">
          {m.content}
        </div>
      </div>
    );
  }
  const a = m.agent ? AGENTS[m.agent] : AGENTS.chief;
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px]" style={{ color: a.color }}>
        <a.Icon size={11} /> {a.name}
      </div>
      <div className={`whitespace-pre-wrap text-[14px] leading-relaxed ${m.error ? "text-coral" : "text-ink-2"}`}>{m.content}</div>
      {m.actions && m.proposal && <ProposalCard actions={m.actions} state={m.proposal} onResolve={onResolve} />}
    </div>
  );
}
