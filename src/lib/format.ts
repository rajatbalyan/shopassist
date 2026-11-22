const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function formatPrice(amount: number): string {
  return priceFormatter.format(amount);
}

/** Whole-number discount of `price` against `mrp`; 0 when there is no discount. */
export function discountPercent(price: number, mrp: number): number {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date);
}

/** Short, human-friendly order reference, e.g. "#K3F9ZQ". */
export function shortOrderId(id: string): string {
  return `#${id.slice(-6).toUpperCase()}`;
}
