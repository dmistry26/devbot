"use client";

import { create } from "zustand";

export interface Toast {
  id: number;
  text: string;
  undo?: boolean;
  tone?: "default" | "error";
}

interface UIState {
  commandOpen: boolean;
  draft: string;
  pendingSend: string | null;
  editingTaskId: string | null;
  editingTaskNonce: number;
  /** Event editor: an existing event id, or "new" with optional prefilled times. */
  editingEvent: { id: string; start?: string; end?: string; nonce?: number } | null;
  toasts: Toast[];
  openCommand: (draft?: string, autoSend?: boolean) => void;
  closeCommand: () => void;
  setDraft: (d: string) => void;
  takePendingSend: () => string | null;
  editTask: (id: string | null) => void;
  editEvent: (e: { id: string; start?: string; end?: string } | null) => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useUI = create<UIState>()((set, get) => ({
  commandOpen: false,
  draft: "",
  pendingSend: null,
  editingTaskId: null,
  editingTaskNonce: 0,
  editingEvent: null,
  toasts: [],
  openCommand: (text = "", autoSend = false) =>
    set(
      autoSend
        ? { commandOpen: true, pendingSend: text }
        : text
          ? { commandOpen: true, draft: text }
          : { commandOpen: true },
    ),
  closeCommand: () => set({ commandOpen: false }),
  setDraft: (draft) => set({ draft }),
  takePendingSend: () => {
    const p = get().pendingSend;
    if (p) set({ pendingSend: null });
    return p;
  },
  editTask: (id) => set({ editingTaskId: id, editingTaskNonce: seq++ }),
  // A fresh nonce per open so a closing dialog's state is never reused by the next one.
  editEvent: (e) => set({ editingEvent: e ? { ...e, nonce: seq++ } : null }),
  toast: (t) => {
    const id = seq++;
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
    setTimeout(() => get().dismiss(id), t.undo ? 6000 : 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));
