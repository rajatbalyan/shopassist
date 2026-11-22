import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Address, SearchFilters } from '@/types';

import { persistStorage, uuid } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';

export type NotificationPrefs = {
  orderUpdates: boolean;
  cartReminders: boolean;
  priceAlerts: boolean;
};

const MAX_RECENT_SEARCHES = 8;

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
  recentSearches: string[];
  /** Prefills checkout. */
  lastAddress: Address | null;
  /** The viewer's "Pinch to zoom" hint has been shown. */
  zoomHintSeen: boolean;
  /** The notification explainer was shown after a first add-to-cart (asked once). */
  notificationPromptSeen: boolean;

  setName: (name: string) => void;
  setThemePreference: (pref: ThemePreference) => void;
  setNotificationPref: (key: keyof NotificationPrefs, value: boolean) => void;
  setDemoMode: (on: boolean) => void;
  saveFilter: (name: string, filters: SearchFilters) => void;
  removeFilter: (id: string) => void;
  setOnboarded: (done: boolean) => void;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  setLastAddress: (address: Address) => void;
  setZoomHintSeen: () => void;
  setNotificationPromptSeen: () => void;
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
      recentSearches: [],
      lastAddress: null,
      zoomHintSeen: false,
      notificationPromptSeen: false,

      setName: (name) => set({ name: name.trim() }),
      setThemePreference: (themePreference) => set({ themePreference }),
      setNotificationPref: (key, value) =>
        set((s) => ({ notifications: { ...s.notifications, [key]: value } })),
      setDemoMode: (demoMode) => set({ demoMode }),
      saveFilter: (name, filters) =>
        set((s) => ({ savedFilters: [{ id: uuid(), name, filters }, ...s.savedFilters] })),
      removeFilter: (id) => set((s) => ({ savedFilters: s.savedFilters.filter((f) => f.id !== id) })),
      setOnboarded: (onboarded) => set({ onboarded }),
      addRecentSearch: (query) => {
        const q = query.trim();
        if (!q) return;
        set((s) => ({
          recentSearches: [q, ...s.recentSearches.filter((r) => r.toLowerCase() !== q.toLowerCase())].slice(
            0,
            MAX_RECENT_SEARCHES,
          ),
        }));
      },
      clearRecentSearches: () => set({ recentSearches: [] }),
      setLastAddress: (lastAddress) => set({ lastAddress }),
      setZoomHintSeen: () => set({ zoomHintSeen: true }),
      setNotificationPromptSeen: () => set({ notificationPromptSeen: true }),
    }),
    { name: 'settings', storage: persistStorage, version: 1 },
  ),
);
