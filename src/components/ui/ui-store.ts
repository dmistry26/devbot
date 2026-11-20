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
  toasts: Toast[];
  openCommand: (draft?: string, autoSend?: boolean) => void;
  closeCommand: () => void;
  setDraft: (d: string) => void;
  takePendingSend: () => string | null;
  editTask: (id: string | null) => void;
  toast: (t: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let seq = 1;

export const useUI = create<UIState>()((set, get) => ({
  commandOpen: false,
  draft: "",
  pendingSend: null,
  editingTaskId: null,
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
  editTask: (id) => set({ editingTaskId: id }),
  toast: (t) => {
    const id = seq++;
    set({ toasts: [...get().toasts.slice(-2), { ...t, id }] });
    setTimeout(() => get().dismiss(id), t.undo ? 6000 : 3500);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));
