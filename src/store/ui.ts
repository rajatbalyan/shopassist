import { create } from 'zustand';

import type { Product } from '@/types';

export type PermissionPromptMode = 'ask' | 'denied';

type UiState = {
  /** Product whose quick-action sheet is open (long-press on a card). */
  quickActionProduct: Product | null;
  /** Notification explainer sheet, shown before the system prompt. */
  permissionPrompt: PermissionPromptMode | null;

  openQuickActions: (product: Product) => void;
  closeQuickActions: () => void;
  /** Shows the explainer and resolves with the user's choice. */
  promptPermission: (mode: PermissionPromptMode) => Promise<boolean>;
  answerPermission: (allow: boolean) => void;
};

// The pending promise's resolver lives outside the store: it isn't render state.
let resolvePrompt: ((allow: boolean) => void) | null = null;

/** Transient, app-wide UI state for sheets mounted once in the root layout. Not persisted. */
export const useUiStore = create<UiState>()((set) => ({
  quickActionProduct: null,
  permissionPrompt: null,

  openQuickActions: (product) => set({ quickActionProduct: product }),
  closeQuickActions: () => set({ quickActionProduct: null }),
  promptPermission: (mode) =>
    new Promise<boolean>((resolve) => {
      resolvePrompt?.(false);
      resolvePrompt = resolve;
      set({ permissionPrompt: mode });
    }),
  answerPermission: (allow) => {
    resolvePrompt?.(allow);
    resolvePrompt = null;
    set({ permissionPrompt: null });
  },
}));
