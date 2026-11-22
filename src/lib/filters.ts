import { formatPrice } from '@/lib/format';
import type { Category, ProductSort, SearchFilters } from '@/types';

export const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'rating', label: 'Customer rating' },
];

export const sortLabel = (sort: ProductSort | undefined) =>
  SORT_OPTIONS.find((o) => o.value === (sort ?? 'relevance'))?.label ?? 'Relevance';

export const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹1,000', max: 1000 },
  { label: '₹1,000 – 5,000', min: 1000, max: 5000 },
  { label: '₹5,000 – 20,000', min: 5000, max: 20000 },
  { label: '₹20,000+', min: 20000 },
];

export const RATING_OPTIONS = [4, 3];

/** Filters other than the free-text query and sort. */
export type ActiveFilterKey = 'category' | 'price' | 'rating';

export const parseCategories = (category: string | undefined) =>
  category ? category.split(',').filter(Boolean) : [];

export const joinCategories = (slugs: string[]) => (slugs.length ? slugs.join(',') : undefined);

export function priceLabel(min?: number, max?: number): string | null {
  if (min === undefined && max === undefined) return null;
  if (min === undefined) return `Under ${formatPrice(max!)}`;
  if (max === undefined) return `${formatPrice(min)}+`;
  return `${formatPrice(min)} – ${formatPrice(max)}`;
}

export type FilterChip = { key: string; label: string; remove: (f: SearchFilters) => SearchFilters };

/** One removable chip per active filter (each category is its own chip). */
export function filterChips(filters: SearchFilters, categories: Category[] | undefined): FilterChip[] {
  const chips: FilterChip[] = [];
  for (const slug of parseCategories(filters.category)) {
    chips.push({
      key: `cat-${slug}`,
      label: categories?.find((c) => c.slug === slug)?.name ?? slug,
      remove: (f) => ({ ...f, category: joinCategories(parseCategories(f.category).filter((s) => s !== slug)) }),
    });
  }
  const price = priceLabel(filters.minPrice, filters.maxPrice);
  if (price) {
    chips.push({ key: 'price', label: price, remove: (f) => ({ ...f, minPrice: undefined, maxPrice: undefined }) });
  }
  if (filters.minRating) {
    chips.push({
      key: 'rating',
      label: `${filters.minRating}★ & up`,
      remove: (f) => ({ ...f, minRating: undefined }),
    });
  }
  return chips;
}

export const hasActiveFilters = (f: SearchFilters) =>
  !!(f.category || f.minPrice !== undefined || f.maxPrice !== undefined || f.minRating);

/** Short name for a saved search, e.g. "iphone · Smartphones · Under ₹20,000". */
export function describeSearch(filters: SearchFilters, categories: Category[] | undefined): string {
  const parts = [filters.search?.trim(), ...filterChips(filters, categories).map((c) => c.label)].filter(Boolean);
  return parts.join(' · ') || 'All products';
}
