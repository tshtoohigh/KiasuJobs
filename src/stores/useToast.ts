import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toast: Toast | null;
  show: (message: string, variant?: ToastVariant) => void;
  dismiss: () => void;
}

let nextId = 1;

/**
 * Deliberately holds one toast at a time — rapid swiping would otherwise stack
 * "Applied!" confirmations on top of each other.
 */
export const useToast = create<ToastState>((set) => ({
  toast: null,
  show: (message, variant = "info") =>
    set({ toast: { id: nextId++, message, variant } }),
  dismiss: () => set({ toast: null }),
}));

export const showToast = (message: string, variant?: ToastVariant) =>
  useToast.getState().show(message, variant);
