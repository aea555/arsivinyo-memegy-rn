import { create } from 'zustand/react';

export type ToastVariant = 'success' | 'error' | 'info';

export type ToastItem = {
  id: number;
  message: string;
  variant: ToastVariant;
  durationMs: number;
};

type ToastStoreState = {
  toast: ToastItem | null;
  showToast: (message: string, variant?: ToastVariant, durationMs?: number) => void;
  hideToast: () => void;
};

export const useToastStore = create<ToastStoreState>((set) => ({
  toast: null,
  showToast: (message, variant = 'info', durationMs = 2200) => {
    set({
      toast: {
        id: Date.now() + Math.floor(Math.random() * 1000),
        message,
        variant,
        durationMs,
      },
    });
  },
  hideToast: () => set({ toast: null }),
}));
