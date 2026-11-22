import categoriesData from '../data/categories.json' with { type: 'json' };
import productsData from '../data/products.json' with { type: 'json' };
import { DEFAULT_PAGE_SIZE, DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, MAX_PAGE_SIZE } from '../config.js';
import type { Category, Paginated, Product, ProductQuery } from '../types.js';

// Port of the app's mock catalog logic (src/lib/api.ts) so both return the same results.

const BASE_PRODUCTS = productsData as Product[];
export const CATEGORIES = categoriesData as Category[];
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);

/** productId → price after an admin price drop. */
export type PriceOverrides = Record<string, number>;

export function withOverrides(product: Product, overrides: PriceOverrides): Product {
  const price = overrides[product.id];
  return price === undefined ? product : { ...product, price };
}

export function allProducts(overrides: PriceOverrides = {}): Product[] {
  return BASE_PRODUCTS.map((p) => withOverrides(p, overrides));
}

export function findProduct(id: string, overrides: PriceOverrides = {}): Product | undefined {
  const product = BASE_PRODUCTS.find((p) => p.id === id);
  return product && withOverrides(product, overrides);
}

const STOPWORDS = new Set(
  'a an and are as at be but by can do does for from get has have how i if in is it its me my of on or so than that the this to was what when which who will with would you your about any there they them much many very good bad product item one'.split(
    ' ',
  ),
);

export const tokenize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));

function searchScore(p: Product, tokens: string[]): number {
  const title = p.title.toLowerCase();
  const fields = [title, p.brand, p.category, p.tags.join(' '), p.description].join(' ').toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (!fields.includes(t)) return 0; // every token must match somewhere
    score += title.includes(t) ? 3 : 1;
  }
  return score;
}

/** Sponsored listings get at most one slot per block of this many results. */
const SPONSORED_BLOCK = 10;
/** Position of the sponsored slot inside each block (third result). */
const SPONSORED_SLOT = 2;

/**
 * Relevance ordering with ads: at most one sponsored item per 10 results while organic
 * results remain. Sponsored items are never dropped (any extras follow the organic ones)
 * and are always returned with `sponsored: true` so the app labels them.
 */
export function interleaveSponsored(products: Product[]): Product[] {
  const organic = products.filter((p) => !p.sponsored);
  const sponsored = products.filter((p) => p.sponsored);
  const out: Product[] = [];
  while (organic.length || sponsored.length) {
    const block: Product[] = organic.splice(0, SPONSORED_BLOCK - 1);
    const ad = block.length ? sponsored.shift() : undefined;
    if (ad) block.splice(Math.min(SPONSORED_SLOT, block.length), 0, ad);
    if (!block.length) block.push(...sponsored.splice(0)); // only ads left
    out.push(...block);
  }
  return out;
}

export function queryProducts(q: ProductQuery, overrides: PriceOverrides = {}): Paginated<Product> {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, q.limit ?? DEFAULT_PAGE_SIZE));
  const tokens = q.search ? tokenize(q.search) : [];
  // `category` may hold several comma-separated slugs (multi-select filter).
  const categories = q.category ? q.category.split(',').filter(Boolean) : [];

  let results = allProducts(overrides)
    .map((p) => ({ p, score: tokens.length ? searchScore(p, tokens) : 1 }))
    .filter(
      ({ p, score }) =>
        score > 0 &&
        (categories.length === 0 || categories.includes(p.category)) &&
        (q.minPrice === undefined || p.price >= q.minPrice) &&
        (q.maxPrice === undefined || p.price <= q.maxPrice) &&
        (q.minRating === undefined || p.rating >= q.minRating) &&
        (!q.sponsored || !!p.sponsored),
    );

  let ordered: Product[];
  switch (q.sort) {
    case 'price_asc':
      ordered = results.sort((a, b) => a.p.price - b.p.price).map((r) => r.p);
      break;
    case 'price_desc':
      ordered = results.sort((a, b) => b.p.price - a.p.price).map((r) => r.p);
      break;
    case 'rating':
      ordered = results.sort((a, b) => b.p.rating - a.p.rating || b.p.reviewCount - a.p.reviewCount).map((r) => r.p);
      break;
    default:
      // Relevance: search score only (ads never get a hidden boost), then capped ad slots.
      if (tokens.length) results = results.sort((a, b) => b.score - a.score);
      ordered = q.sponsored ? results.map((r) => r.p) : interleaveSponsored(results.map((r) => r.p));
  }

  const total = ordered.length;
  const start = (page - 1) * limit;
  return { items: ordered.slice(start, start + limit), page, limit, total, hasMore: start + limit < total };
}

export function similarProducts(id: string, overrides: PriceOverrides = {}): Product[] | undefined {
  const product = findProduct(id, overrides);
  if (!product) return undefined;
  return allProducts(overrides)
    .filter((p) => p.category === product.category && p.id !== id)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 4);
}

export function priceBreakdown(items: { price: number; qty: number }[]) {
  const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const delivery = subtotal === 0 || subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;
  return { subtotal, delivery, total: subtotal + delivery };
}

/** New price after a percentage drop, keeping the catalog's INR style (ends in 9). */
export function droppedPrice(price: number, percent: number): number {
  const raw = Math.floor((price * (100 - percent)) / 100);
  return Math.max(9, Math.floor(raw / 10) * 10 - 1);
}
