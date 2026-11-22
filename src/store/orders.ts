import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Order, OrderStatus } from '@/types';

import { persistStorage } from './storage';

/**
 * Local order cache. The mock API reads and writes orders here; with the real backend
 * `orders` is unused. Ratings are always local.
 */
type OrdersState = {
  orders: Order[];
  /** productId -> stars (1–5) the user gave after buying. */
  ratings: Record<string, number>;
  addOrder: (order: Order) => void;
  setStatus: (id: string, status: OrderStatus) => Order | undefined;
  rate: (productId: string, stars: number) => void;
};

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      orders: [],
      ratings: {},
      addOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),
      setStatus: (id, status) => {
        const at = new Date().toISOString();
        set((s) => ({
          orders: s.orders.map((o) =>
            o.id === id && o.status !== status
              ? { ...o, status, history: [...(o.history ?? []), { status, at }] }
              : o,
          ),
        }));
        return get().orders.find((o) => o.id === id);
      },
      rate: (productId, stars) => set((s) => ({ ratings: { ...s.ratings, [productId]: stars } })),
    }),
    {
      name: 'orders',
      storage: persistStorage,
      version: 1,
      partialize: (s) => ({ orders: s.orders, ratings: s.ratings }),
    },
  ),
);
