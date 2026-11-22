import { useMemo } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

import type { CartItem, Product } from '@/types';

import { persistStorage } from './storage';

/** Product fields the cart needs to render without a network round-trip. */
export type CartProduct = Pick<Product, 'id' | 'title' | 'thumbnail' | 'price' | 'mrp' | 'stock' | 'brand'>;

export type CartLine = CartItem & { product: CartProduct };

const MAX_QTY = 10;

type CartState = {
  items: CartItem[];
  products: Record<string, CartProduct>;
  /** Last removed line and its position, for the undo snackbar. */
  lastRemoved: { line: CartLine; index: number } | null;

  add: (product: Product, qty?: number) => void;
  remove: (productId: string) => void;
  undoRemove: () => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
};

const clampQty = (qty: number, stock: number) => Math.max(1, Math.min(qty, MAX_QTY, stock || MAX_QTY));

function toCartProduct(p: Product): CartProduct {
  return { id: p.id, title: p.title, thumbnail: p.thumbnail, price: p.price, mrp: p.mrp, stock: p.stock, brand: p.brand };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      products: {},
      lastRemoved: null,

      add: (product, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === product.id);
          const items = existing
            ? s.items.map((i) =>
                i.productId === product.id ? { ...i, qty: clampQty(i.qty + qty, product.stock) } : i,
              )
            : [...s.items, { productId: product.id, qty: clampQty(qty, product.stock), priceAtAdd: product.price }];
          return { items, products: { ...s.products, [product.id]: toCartProduct(product) } };
        }),

      remove: (productId) => {
        const { items, products } = get();
        const index = items.findIndex((i) => i.productId === productId);
        if (index === -1) return;
        const product = products[productId];
        const rest = { ...products };
        delete rest[productId];
        set({
          items: items.filter((i) => i.productId !== productId),
          products: rest,
          lastRemoved: product ? { line: { ...items[index], product }, index } : null,
        });
      },

      undoRemove: () => {
        const { lastRemoved, items, products } = get();
        if (!lastRemoved) return;
        const { line, index } = lastRemoved;
        const { product, ...item } = line;
        const next = [...items];
        next.splice(Math.min(index, next.length), 0, item);
        set({ items: next, products: { ...products, [product.id]: product }, lastRemoved: null });
      },

      setQty: (productId, qty) => {
        if (qty <= 0) return get().remove(productId);
        set((s) => ({
          items: s.items.map((i) =>
            i.productId === productId ? { ...i, qty: clampQty(qty, s.products[productId]?.stock ?? MAX_QTY) } : i,
          ),
        }));
      },

      clear: () => set({ items: [], products: {}, lastRemoved: null }),
    }),
    {
      name: 'cart',
      storage: persistStorage,
      version: 1,
      partialize: (s) => ({ items: s.items, products: s.products }),
    },
  ),
);

export const selectCartCount = (s: CartState) => s.items.reduce((n, i) => n + i.qty, 0);

export const selectCartLines = (s: Pick<CartState, 'items' | 'products'>): CartLine[] =>
  s.items.flatMap((i) => {
    const product = s.products[i.productId];
    return product ? [{ ...i, product }] : [];
  });

export const useCartCount = () => useCartStore(selectCartCount);

/**
 * Cart items joined with their product data.
 * The selector returns the two stored references (stable between renders) and the join
 * happens in useMemo. Joining inside the selector would build new line objects on every
 * snapshot, which useShallow can't dedupe, so React would see a changing snapshot and loop.
 */
export function useCartLines(): CartLine[] {
  const { items, products } = useCartStore(useShallow((s) => ({ items: s.items, products: s.products })));
  return useMemo(() => selectCartLines({ items, products }), [items, products]);
}
