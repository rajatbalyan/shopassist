import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { SearchFilters } from '@/types';

import { persistStorage, uuid } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';

export type NotificationPrefs = {
  orderUpdates: boolean;
  cartReminders: boolean;
  priceAlerts: boolean;
};

export type SavedFilter = { id: string; name: string; filters: SearchFilters };

type SettingsState = {
  name: string;
  themePreference: ThemePreference;
  notifications: NotificationPrefs;
  /** Shortens timers (e.g. cart reminder 10 s instead of 2 h) for live demos. */
  demoMode: boolean;
  /** Generated once per install; identifies this device to the backend. */
  deviceId: string;
  savedFilters: SavedFilter[];
  onboarded: boolean;

  setName: (name: string) => void;
  setThemePreference: (pref: ThemePreference) => void;
  setNotificationPref: (key: keyof NotificationPrefs, value: boolean) => void;
  setDemoMode: (on: boolean) => void;
  saveFilter: (name: string, filters: SearchFilters) => void;
  removeFilter: (id: string) => void;
  setOnboarded: (done: boolean) => void;
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      name: '',
      themePreference: 'system',
      notifications: { orderUpdates: true, cartReminders: true, priceAlerts: true },
      demoMode: false,
      deviceId: uuid(),
      savedFilters: [],
      onboarded: false,

      setName: (name) => set({ name: name.trim() }),
      setThemePreference: (themePreference) => set({ themePreference }),
      setNotificationPref: (key, value) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
      setDemoMode: (demoMode) => set({ demoMode }),
      saveFilter: (name, filters) =>
        set((s) => ({ savedFilters: [{ id: uuid(), name, filters }, ...s.savedFilters] })),
      removeFilter: (id) => set((s) => ({ savedFilters: s.savedFilters.filter((f) => f.id !== id) })),
      setOnboarded: (onboarded) => set({ onboarded }),
    }),
    { name: 'settings', storage: persistStorage, version: 1 },
  ),
);
