import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from './storage';

type WishlistState = {
  ids: string[];
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
  remove: (productId: string) => void;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (productId) =>
        set((s) => ({
          ids: s.ids.includes(productId) ? s.ids.filter((id) => id !== productId) : [productId, ...s.ids],
        })),
      has: (productId) => get().ids.includes(productId),
      remove: (productId) => set((s) => ({ ids: s.ids.filter((id) => id !== productId) })),
    }),
    { name: 'wishlist', storage: persistStorage, version: 1, partialize: (s) => ({ ids: s.ids }) },
  ),
);

/** Reactive membership check for a single product. */
export const useIsWishlisted = (productId: string) =>
  useWishlistStore((s) => s.ids.includes(productId));
