import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { AlertType } from '@/types';

import { persistStorage } from './storage';

type AlertsState = {
  /** productId -> alert types turned on for it. */
  subscriptions: Record<string, AlertType[]>;
  toggle: (productId: string, type: AlertType) => boolean;
  isOn: (productId: string, type: AlertType) => boolean;
};

export const useAlertsStore = create<AlertsState>()(
  persist(
    (set, get) => ({
      subscriptions: {},
      /** Returns the new on/off state. */
      toggle: (productId, type) => {
        const current = get().subscriptions[productId] ?? [];
        const on = !current.includes(type);
        const next = on ? [...current, type] : current.filter((t) => t !== type);
        set((s) => {
          const subscriptions = { ...s.subscriptions, [productId]: next };
          if (next.length === 0) delete subscriptions[productId];
          return { subscriptions };
        });
        return on;
      },
      isOn: (productId, type) => get().subscriptions[productId]?.includes(type) ?? false,
    }),
    {
      name: 'alerts',
      storage: persistStorage,
      version: 1,
      partialize: (s) => ({ subscriptions: s.subscriptions }),
    },
  ),
);

export const useAlertOn = (productId: string, type: AlertType) =>
  useAlertsStore((s) => s.subscriptions[productId]?.includes(type) ?? false);
