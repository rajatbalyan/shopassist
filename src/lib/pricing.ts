/**
 * Single source of truth for prices shown in cart, checkout and orders.
 * No hidden fees: everything the customer pays is in this breakdown.
 */
export const FREE_DELIVERY_THRESHOLD = 499;
export const DELIVERY_FEE = 49;

export type PriceLine = { price: number; qty: number };

export type PriceBreakdown = {
  subtotal: number;
  delivery: number;
  total: number;
  /** How much more to add for free delivery; 0 once it applies. */
  freeDeliveryRemaining: number;
};

export function getPriceBreakdown(items: PriceLine[]): PriceBreakdown {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  if (subtotal === 0) {
    return { subtotal: 0, delivery: 0, total: 0, freeDeliveryRemaining: FREE_DELIVERY_THRESHOLD };
  }
  const free = subtotal >= FREE_DELIVERY_THRESHOLD;
  const delivery = free ? 0 : DELIVERY_FEE;
  return {
    subtotal,
    delivery,
    total: subtotal + delivery,
    freeDeliveryRemaining: free ? 0 : FREE_DELIVERY_THRESHOLD - subtotal,
  };
}
