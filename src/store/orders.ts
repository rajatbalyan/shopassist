import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { Order, OrderStatus } from '@/types';

import { persistStorage } from './storage';

/** Local order cache. The mock API reads and writes here; with the real backend it is unused. */
type OrdersState = {
  orders: Order[];
  addOrder: (order: Order) => void;
  setStatus: (id: string, status: OrderStatus) => void;
};

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set) => ({
      orders: [],
      addOrder: (order) => set((s) => ({ orders: [order, ...s.orders] })),
      setStatus: (id, status) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)) })),
    }),
    { name: 'orders', storage: persistStorage, version: 1, partialize: (s) => ({ orders: s.orders }) },
  ),
);
