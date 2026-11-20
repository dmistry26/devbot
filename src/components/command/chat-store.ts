"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Action } from "@/lib/actions";
import type { AgentId } from "@/lib/ai/prompt";

export type ProposalState = "pending" | "applied" | "discarded";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  agent?: AgentId;
  at: string;
  actions?: Action[];
  proposal?: ProposalState;
  error?: boolean;
}

interface ChatState {
  messages: ChatMessage[];
  agent: AgentId;
  busy: boolean;
  setBusy: (b: boolean) => void;
  add: (m: ChatMessage) => void;
  patch: (id: string, p: Partial<ChatMessage>) => void;
  setAgent: (a: AgentId) => void;
  clear: () => void;
}

export const useChat = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      agent: "chief",
      busy: false,
      setBusy: (busy) => set({ busy }),
      add: (m) => set({ messages: [...get().messages, m].slice(-60) }),
      patch: (id, p) => set({ messages: get().messages.map((m) => (m.id === id ? { ...m, ...p } : m)) }),
      setAgent: (agent) => set({ agent }),
      clear: () => set({ messages: [] }),
    }),
    {
      name: "devbot.chat.v1",
      storage: createJSONStorage(() => localStorage),
      partialize: ({ messages, agent }) => ({ messages, agent }),
    },
  ),
);
