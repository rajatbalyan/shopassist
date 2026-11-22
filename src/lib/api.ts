import categoriesData from '@/data/categories.json';
import productsData from '@/data/products.json';
import { getPriceBreakdown } from '@/lib/pricing';
import { useOrdersStore } from '@/store/orders';
import { waitForHydration } from '@/store/storage';
import type {
  AlertType,
  AskResponse,
  BuyerInsights,
  Category,
  ChatMessage,
  CreateOrderInput,
  Insight,
  Order,
  OrderStatus,
  Paginated,
  ParsedSearch,
  Product,
  ProductQuery,
  Review,
  SearchFilters,
} from '@/types';

export interface Api {
  getProducts(query: ProductQuery): Promise<Paginated<Product>>;
  getProduct(id: string): Promise<Product>;
  getSimilar(id: string): Promise<Product[]>;
  getInsights(id: string): Promise<BuyerInsights>;
  getCategories(): Promise<Category[]>;
  parseSearch(query: string): Promise<ParsedSearch>;
  ask(productId: string, question: string, history: ChatMessage[]): Promise<AskResponse>;
  registerDevice(deviceId: string, pushToken: string): Promise<void>;
  createAlert(deviceId: string, productId: string, type: AlertType): Promise<void>;
  createOrder(input: CreateOrderInput): Promise<Order>;
  getOrders(deviceId: string): Promise<Order[]>;
  getOrder(id: string): Promise<Order>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const NOT_GROUNDED_ANSWER = "That isn't in the product details or reviews.";
export const DEFAULT_PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// HTTP implementation (Prompt 4 backend)
// ---------------------------------------------------------------------------

function toQueryString(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
}

function createHttpApi(baseUrl: string): Api {
  const base = baseUrl.replace(/\/+$/, '');

  async function request<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    const res = await fetch(base + path, {
      method: init?.method ?? 'GET',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new ApiError(text || `Request failed (${res.status})`, res.status);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  return {
    getProducts: (q) => request(`/products${toQueryString({ ...q })}`),
    getProduct: (id) => request(`/products/${encodeURIComponent(id)}`),
    getSimilar: (id) => request(`/products/${encodeURIComponent(id)}/similar`),
    getInsights: (id) => request(`/products/${encodeURIComponent(id)}/insights`),
    getCategories: () => request('/categories'),
    parseSearch: (query) => request('/search/parse', { method: 'POST', body: { query } }),
    ask: (productId, question, history) =>
      request('/ask', { method: 'POST', body: { productId, question, history } }),
    registerDevice: (deviceId, pushToken) =>
      request('/devices', { method: 'POST', body: { deviceId, pushToken } }),
    createAlert: (deviceId, productId, type) =>
      request('/alerts', { method: 'POST', body: { deviceId, productId, type } }),
    createOrder: (input) => request('/orders', { method: 'POST', body: input }),
    getOrders: (deviceId) => request(`/orders${toQueryString({ deviceId })}`),
    getOrder: (id) => request(`/orders/${encodeURIComponent(id)}`),
  };
}

// ---------------------------------------------------------------------------
// Mock implementation (local seed data, deterministic stand-ins for AI)
// ---------------------------------------------------------------------------

const PRODUCTS = productsData as Product[];
const CATEGORIES = categoriesData as Category[];

const delay = () => new Promise<void>((r) => setTimeout(r, 300 + Math.random() * 400));

function findProduct(id: string): Product {
  const product = PRODUCTS.find((p) => p.id === id);
  if (!product) throw new ApiError('Product not found', 404);
  return product;
}

const STOPWORDS = new Set(
  'a an and are as at be but by can do does for from get has have how i if in is it its me my of on or so than that the this to was what when which who will with would you your about any there they them much many very good bad product item one'.split(
    ' ',
  ),
);

const tokenize = (text: string) =>
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

function queryProducts(q: ProductQuery): Paginated<Product> {
  const page = Math.max(1, q.page ?? 1);
  const limit = Math.max(1, q.limit ?? DEFAULT_PAGE_SIZE);
  const tokens = q.search ? tokenize(q.search) : [];
  // `category` may hold several comma-separated slugs (multi-select filter).
  const categories = q.category ? q.category.split(',').filter(Boolean) : [];

  let results = PRODUCTS.map((p) => ({ p, score: tokens.length ? searchScore(p, tokens) : 1 })).filter(
    ({ p, score }) =>
      score > 0 &&
      (categories.length === 0 || categories.includes(p.category)) &&
      (q.minPrice === undefined || p.price >= q.minPrice) &&
      (q.maxPrice === undefined || p.price <= q.maxPrice) &&
      (q.minRating === undefined || p.rating >= q.minRating) &&
      (!q.sponsored || !!p.sponsored),
  );

  switch (q.sort) {
    case 'price_asc':
      results = results.sort((a, b) => a.p.price - b.p.price);
      break;
    case 'price_desc':
      results = results.sort((a, b) => b.p.price - a.p.price);
      break;
    case 'rating':
      results = results.sort((a, b) => b.p.rating - a.p.rating || b.p.reviewCount - a.p.reviewCount);
      break;
    default:
      // Relevance: search score only. Sponsored items are never boosted silently.
      if (tokens.length) results = results.sort((a, b) => b.score - a.score);
  }

  const total = results.length;
  const start = (page - 1) * limit;
  return {
    items: results.slice(start, start + limit).map((r) => r.p),
    page,
    limit,
    total,
    hasMore: start + limit < total,
  };
}

// Each topic turns matching reviews into a pro (from 4–5★) or con (from ≤3★) with citations.
type Topic = { pro?: string; proRe?: RegExp; con?: string; conRe?: RegExp };

const TOPICS: Topic[] = [
  { pro: 'Battery lasts a full day', proRe: /battery (easily )?lasts/i, con: 'Battery drains fast or charges slowly', conRe: /battery drains|charger is slow|slow to charge/i },
  { pro: 'Bright, sharp display', proRe: /display is bright|sharp/i },
  { pro: 'Good camera in daylight', proRe: /camera takes crisp/i, con: 'Weak camera in low light', conRe: /low light|grainy/i },
  { pro: 'Smooth performance', proRe: /smooth|no lag|multitask/i, con: 'Heats up with heavy use', conRe: /\b(warm|heats? up)\b/i },
  { pro: 'Loud, clear sound', proRe: /sound is clear|speakers are loud/i, con: 'Sound gets tinny at high volume', conRe: /tinny/i },
  { pro: 'Premium, sturdy build', proRe: /premium|sturdy|well made|feels durable|last years/i, con: 'Durability concerns', conRe: /flimsy|peeling|bend|scratches easily/i },
  { pro: 'True-to-size fit', proRe: /true to size|sits well/i, con: 'Runs small or shrinks after washing', conRe: /size small|size up|shrank/i },
  { pro: 'Soft, breathable fabric', proRe: /soft and breathable|breathable/i, con: 'Colour fades or fabric wrinkles', conRe: /faded|fade|wrinkles/i },
  { pro: 'Neat stitching', proRe: /stitching is neat/i, con: 'Loose threads on stitching', conRe: /loose threads/i },
  { pro: 'Colour holds up after washing', proRe: /colour stayed/i },
  { pro: 'Roomy, fits daily essentials', proRe: /plenty of space|fits a laptop/i, con: 'Smaller than it looks in photos', conRe: /smaller than it looks/i },
  { pro: 'Comfortable strap', proRe: /strap is comfortable/i, con: 'Thin strap digs into the shoulder', conRe: /strap is thin|digs into/i },
  { pro: 'Durable zip and hardware', proRe: /zip and hardware/i, con: 'Zip feels flimsy', conRe: /zip feels flimsy|got stuck/i },
  { pro: 'Elegant look', proRe: /elegant|looks smart|office wear/i },
  { pro: 'Easy to clean', proRe: /easy to clean|dishwasher/i, con: 'Hard to clean', conRe: /hard to clean/i },
  { pro: 'Comfortable grip', proRe: /comfortable grip/i, con: 'Handle gets hot while cooking', conRe: /handle gets hot/i },
  { pro: 'Saves time in the kitchen', proRe: /saves time/i },
  { pro: 'Light texture that absorbs quickly', proRe: /absorbs quickly/i, con: 'Greasy, sticky texture', conRe: /greasy|sticky/i },
  { pro: 'Gentle and hydrating on skin', proRe: /gentle on sensitive|hydrated/i, con: 'Caused breakouts for some buyers', conRe: /breakout/i },
  { pro: 'Pleasant fragrance', proRe: /lovely fragrance/i, con: 'Strong smell', conRe: /too strong|chemical smell/i },
  { pro: 'Lasts a long time', proRe: /goes a long way|lasts for months/i },
  { pro: 'Good value for money', proRe: /value for money/i, con: 'Pricey for what you get', conRe: /overpriced|small for the price/i },
  { pro: 'Quick delivery, secure packaging', proRe: /delivery was quick|packaging was secure/i, con: 'Packaging leaked in delivery', conRe: /leaked/i },
  { pro: 'Buyers recommend it', proRe: /highly recommended|very satisfied|excellent|exceeded/i, con: 'Not as described for some buyers', conRe: /not as described/i },
];

function collect(reviews: Review[], label: string | undefined, re: RegExp | undefined): Insight | null {
  if (!label || !re) return null;
  const reviewIds = reviews.filter((r) => re.test(r.comment)).map((r) => r.id);
  return reviewIds.length ? { point: label, reviewIds } : null;
}

function buildInsights(product: Product): BuyerInsights {
  const positive = product.reviews.filter((r) => r.rating >= 4);
  const critical = product.reviews.filter((r) => r.rating <= 3);
  const byEvidence = (a: Insight, b: Insight) => b.reviewIds.length - a.reviewIds.length;
  const pros = TOPICS.map((t) => collect(positive, t.pro, t.proRe)).filter((i): i is Insight => !!i);
  const cons = TOPICS.map((t) => collect(critical, t.con, t.conRe)).filter((i): i is Insight => !!i);
  return { pros: pros.sort(byEvidence).slice(0, 4), cons: cons.sort(byEvidence).slice(0, 3) };
}

// Question words that map onto a spec field or product attribute.
const SPEC_SYNONYMS: Record<string, string[]> = {
  Warranty: ['warranty', 'guarantee'],
  'Return policy': ['return', 'refund', 'exchange'],
  Shipping: ['shipping', 'ship', 'deliver', 'delivery', 'dispatch', 'arrive'],
  'Shipping weight': ['weight', 'heavy', 'weigh', 'light'],
  Dimensions: ['dimension', 'size', 'big', 'width', 'height', 'depth'],
  Brand: ['brand', 'make', 'manufacturer', 'company'],
};

function splitSentences(text: string) {
  return text.split(/(?<=[.!?])\s+/).filter(Boolean);
}

function answerQuestion(product: Product, question: string): AskResponse {
  const tokens = tokenize(question);
  const parts: string[] = [];
  const citations: string[] = [];

  for (const [key, words] of Object.entries(SPEC_SYNONYMS)) {
    const value = product.specs[key];
    if (value && tokens.some((t) => words.includes(t))) parts.push(`${key}: ${value}.`);
  }
  if (tokens.some((t) => ['price', 'cost', 'cheap', 'expensive', 'discount', 'mrp'].includes(t))) {
    parts.push(`It costs ₹${product.price.toLocaleString('en-IN')} (MRP ₹${product.mrp.toLocaleString('en-IN')}).`);
  }
  if (tokens.some((t) => ['stock', 'available', 'availability'].includes(t))) {
    parts.push(product.stock > 0 ? `${product.stock} in stock.` : 'Currently out of stock.');
  }

  // Ignore words that appear in nearly every listing so they don't create false matches.
  const content = tokens.filter((t) => !['phone', 'laptop', 'shirt', 'bag', 'use', 'like', 'buy', 'long', 'well'].includes(t));
  if (content.length) {
    const hit = (s: string) => content.filter((t) => s.toLowerCase().includes(t)).length;
    const descSentence = splitSentences(product.description)
      .map((s) => ({ s, n: hit(s) }))
      .sort((a, b) => b.n - a.n)[0];
    if (descSentence?.n) parts.push(`From the description: ${descSentence.s}`);

    const reviewHits = product.reviews
      .map((r) => ({ r, n: hit(r.comment) }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 3);
    if (reviewHits.length) {
      const quotes = reviewHits.map(({ r }) => `"${r.comment}" (${r.rating}★)`);
      parts.push(`Buyers say: ${quotes.join(' ')}`);
      citations.push(...reviewHits.map(({ r }) => r.id));
    }
  }

  if (parts.length === 0) return { answer: NOT_GROUNDED_ANSWER, grounded: false, citations: [] };
  return { answer: parts.join(' '), grounded: true, citations };
}

const CATEGORY_WORDS: [RegExp, string][] = [
  [/\b(smart ?phones?|phones?|mobiles?|iphone|android)\b/i, 'smartphones'],
  [/\b(laptops?|notebooks?|macbook)\b/i, 'laptops'],
  [/\b(t-?shirts?|tshirts?|shirts?)\b/i, 'mens-shirts'],
  [/\b(hand ?bags?|bags?|purses?|totes?)\b/i, 'womens-bags'],
  [/\b(kitchen|cook(s|ing)?|chef|baking|utensils?)\b/i, 'kitchen-accessories'],
  [/\b(skin ?care|moisturi[sz]ers?|lotions?|sunscreen)\b/i, 'skin-care'],
  [/\b(beauty|make-?up|lipsticks?|mascara|eyeshadow|nail polish)\b/i, 'beauty'],
];

const FILLER = new Set(
  'gift gifts for my a an the who that is are dad mom mother father wife husband friend sister brother someone something show me find want need looking under below above over less more than between and with rated rating stars star best top cheap cheapest budget rs inr'.split(
    ' ',
  ),
);

function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, ''));
  return /k$/i.test(raw) ? n * 1000 : n;
}

function parseNaturalSearch(query: string): ParsedSearch {
  const filters: SearchFilters = {};
  const notes: string[] = [];
  let rest = query.replace(/₹/g, ' ');

  const between = rest.match(/between\s+([\d,.]+k?)\s+(?:and|to|-)\s+([\d,.]+k?)/i);
  const under = rest.match(/(?:under|below|less than|within|upto|up to|max)\s+([\d,.]+k?)/i);
  const over = rest.match(/(?:over|above|more than|min)\s+([\d,.]+k?)/i);
  if (between) {
    filters.minPrice = parseAmount(between[1]);
    filters.maxPrice = parseAmount(between[2]);
    rest = rest.replace(between[0], ' ');
  } else {
    if (under) {
      filters.maxPrice = parseAmount(under[1]);
      rest = rest.replace(under[0], ' ');
    }
    if (over) {
      filters.minPrice = parseAmount(over[1]);
      rest = rest.replace(over[0], ' ');
    }
  }
  if (filters.minPrice !== undefined) notes.push(`from ₹${filters.minPrice.toLocaleString('en-IN')}`);
  if (filters.maxPrice !== undefined) notes.push(`up to ₹${filters.maxPrice.toLocaleString('en-IN')}`);

  const rating = rest.match(/(\d(?:\.\d)?)\s*\+?\s*(?:stars?|★)|rated\s+(\d(?:\.\d)?)/i);
  if (rating) {
    filters.minRating = Math.min(5, parseFloat(rating[1] ?? rating[2]));
    notes.push(`rated ${filters.minRating}★ and up`);
    rest = rest.replace(rating[0], ' ');
  }

  for (const [re, slug] of CATEGORY_WORDS) {
    const m = rest.match(re);
    if (m) {
      filters.category = slug;
      notes.push(`in ${CATEGORIES.find((c) => c.slug === slug)?.name ?? slug}`);
      rest = rest.replace(m[0], ' ');
      break;
    }
  }

  if (/\b(cheapest|lowest price|budget)\b/i.test(query)) filters.sort = 'price_asc';
  else if (/\b(best|top)[- ]rated\b/i.test(query)) filters.sort = 'rating';

  const keywords = rest
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !FILLER.has(w) && !STOPWORDS.has(w));
  if (keywords.length) {
    filters.search = keywords.join(' ');
    notes.unshift(`matching "${filters.search}"`);
  }

  const explanation = notes.length ? `Showing products ${notes.join(', ')}.` : `Searching for "${query.trim()}".`;
  if (!notes.length && query.trim()) filters.search = query.trim();
  return { filters, explanation };
}

export const mockApi: Api = {
  async getProducts(query) {
    await delay();
    return queryProducts(query);
  },
  async getProduct(id) {
    await delay();
    return findProduct(id);
  },
  async getSimilar(id) {
    await delay();
    const product = findProduct(id);
    return PRODUCTS.filter((p) => p.category === product.category && p.id !== id)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 4);
  },
  async getInsights(id) {
    await delay();
    return buildInsights(findProduct(id));
  },
  async getCategories() {
    await delay();
    return CATEGORIES;
  },
  async parseSearch(query) {
    await delay();
    return parseNaturalSearch(query);
  },
  async ask(productId, question) {
    await delay();
    return answerQuestion(findProduct(productId), question);
  },
  async registerDevice() {
    await delay();
  },
  async createAlert() {
    await delay();
  },
  async createOrder(input) {
    await delay();
    if (input.items.length === 0) throw new ApiError('Order has no items', 400);
    const { subtotal, delivery, total } = getPriceBreakdown(input.items);
    const now = new Date().toISOString();
    const order: Order = {
      id: `SA${Date.now().toString(36).toUpperCase()}`,
      items: input.items,
      subtotal,
      delivery,
      total,
      address: input.address,
      status: 'placed',
      createdAt: now,
      history: [{ status: 'placed', at: now }],
    };
    await waitForHydration(useOrdersStore);
    useOrdersStore.getState().addOrder(order);
    return order;
  },
  async getOrders() {
    await delay();
    await waitForHydration(useOrdersStore);
    return useOrdersStore.getState().orders;
  },
  async getOrder(id) {
    await delay();
    await waitForHydration(useOrdersStore);
    const order = useOrdersStore.getState().orders.find((o) => o.id === id);
    if (!order) throw new ApiError('Order not found', 404);
    return order;
  },
};

/**
 * Demo-only: move a locally stored order to a new status so the timeline can be shown
 * before the backend exists. The real backend does this via /admin/orders/:id/ship.
 */
export async function mockSetOrderStatus(id: string, status: OrderStatus): Promise<Order> {
  await waitForHydration(useOrdersStore);
  const order = useOrdersStore.getState().setStatus(id, status);
  if (!order) throw new ApiError('Order not found', 404);
  return order;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const isMockApi = !API_URL;
export const api: Api = API_URL ? createHttpApi(API_URL) : mockApi;
