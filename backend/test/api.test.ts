import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app.js';
import { NOT_GROUNDED_ANSWER } from '../src/config.js';
import { postCheckAnswer, postCheckInsights, unsupportedNumbers, type JsonModel } from '../src/lib/ai.js';
import { allProducts, droppedPrice, interleaveSponsored, queryProducts } from '../src/lib/catalog.js';
import { createMemoryStore } from '../src/lib/firestore.js';
import type { Pusher, PushPayload } from '../src/lib/push.js';
import type { AskResponse, Order, Paginated, Product } from '../src/types.js';

const ADMIN_KEY = 'test-admin-key';
const products = allProducts();
const phone = products.find((p) => p.category === 'smartphones' && p.stock > 0)!;
const cheap = products.filter((p) => p.stock > 0).sort((a, b) => a.price - b.price)[0]!;

function setup(modelOutput: unknown = {}) {
  const store = createMemoryStore();
  const sent: { tokens: string[]; payload: PushPayload }[] = [];
  const pusher: Pusher = {
    async send(tokens, payload) {
      sent.push({ tokens, payload });
      return tokens.length;
    },
  };
  const calls: string[] = [];
  const model: JsonModel = {
    async generateJson(req) {
      calls.push(req.task);
      if (modelOutput instanceof Error) throw modelOutput;
      return modelOutput;
    },
  };
  const app = createApp({ store, model, pusher, adminKey: ADMIN_KEY });
  const json = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', ...headers } });
  return { app, store, sent, calls, json };
}

const address = { name: 'Asha Rao', phone: '9876543210', line1: '12 MG Road, Indiranagar', city: 'Bengaluru', pincode: '560038' };

describe('catalog', () => {
  it('filters by category, price and rating', () => {
    const res = queryProducts({ category: 'smartphones', maxPrice: 50_000, minRating: 3.5, limit: 50 });
    expect(res.items.length).toBeGreaterThan(0);
    for (const p of res.items) {
      expect(p.category).toBe('smartphones');
      expect(p.price).toBeLessThanOrEqual(50_000);
      expect(p.rating).toBeGreaterThanOrEqual(3.5);
    }
  });

  it('supports comma-separated categories, sort and pagination', () => {
    const all = queryProducts({ category: 'laptops,beauty', sort: 'price_asc', limit: 50 });
    expect(new Set(all.items.map((p) => p.category))).toEqual(new Set(['laptops', 'beauty']));
    const prices = all.items.map((p) => p.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));

    const page1 = queryProducts({ category: 'laptops,beauty', sort: 'price_asc', limit: 3, page: 1 });
    const page2 = queryProducts({ category: 'laptops,beauty', sort: 'price_asc', limit: 3, page: 2 });
    expect(page1.hasMore).toBe(true);
    expect(page2.items[0]?.id).toBe(all.items[3]?.id);
  });

  it('returns only sponsored items when asked', () => {
    const res = queryProducts({ sponsored: true, limit: 50 });
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.items.every((p) => p.sponsored)).toBe(true);
  });

  it('caps sponsored results at one per 10 while organic results remain', () => {
    const res = queryProducts({ limit: 50 });
    // Up to the last organic result, every block of 10 has at most one ad.
    const lastOrganic = res.items.findLastIndex((p) => !p.sponsored);
    const withOrganic = res.items.slice(0, lastOrganic + 1);
    for (let i = 0; i < withOrganic.length; i += 10) {
      expect(withOrganic.slice(i, i + 10).filter((p) => p.sponsored).length).toBeLessThanOrEqual(1);
    }
    // Nothing is hidden: every product is still listed.
    expect(res.total).toBe(products.length);
    expect(interleaveSponsored(products)).toHaveLength(products.length);
  });

  it('applies price overrides', () => {
    const res = queryProducts({ search: phone.title, limit: 50 }, { [phone.id]: 99 });
    expect(res.items.find((p) => p.id === phone.id)?.price).toBe(99);
    expect(droppedPrice(1299, 10)).toBe(1159);
  });

  it('serves products over HTTP with 404 for unknown ids', async () => {
    const { app } = setup();
    const list = (await (await app.request('/products?category=laptops&limit=2')).json()) as Paginated<Product>;
    expect(list.items).toHaveLength(2);
    expect((await app.request('/products/nope')).status).toBe(404);
  });
});

describe('orders', () => {
  it('recomputes totals server-side and ignores client prices', async () => {
    const { json } = setup();
    const res = await json('/orders', {
      deviceId: 'device-1',
      address,
      items: [{ productId: cheap.id, qty: 1, price: 1, title: 'Fake', total: 1 }],
      subtotal: 1,
      total: 1,
    });
    expect(res.status).toBe(201);
    const order = (await res.json()) as Order;
    expect(order.items[0]?.price).toBe(cheap.price);
    expect(order.items[0]?.title).toBe(cheap.title);
    expect(order.subtotal).toBe(cheap.price);
    expect(order.delivery).toBe(cheap.price >= 499 ? 0 : 49);
    expect(order.total).toBe(order.subtotal + order.delivery);
    expect(order).not.toHaveProperty('deviceId');
  });

  it('gives free delivery from ₹499 and charges ₹49 below', async () => {
    const { json } = setup();
    const below = products.find((p) => p.stock > 0 && p.price < 499);
    const above = products.find((p) => p.stock > 0 && p.price >= 499)!;
    if (below) {
      const o = (await (await json('/orders', { deviceId: 'd', address, items: [{ productId: below.id, qty: 1 }] })).json()) as Order;
      expect(o.delivery).toBe(49);
    }
    const o = (await (await json('/orders', { deviceId: 'd', address, items: [{ productId: above.id, qty: 1 }] })).json()) as Order;
    expect(o.delivery).toBe(0);
  });

  it('validates the body', async () => {
    const { json } = setup();
    expect((await json('/orders', { deviceId: 'd', address: { ...address, phone: '123' }, items: [{ productId: cheap.id, qty: 1 }] })).status).toBe(400);
    expect((await json('/orders', { deviceId: 'd', address, items: [] })).status).toBe(400);
    expect((await json('/orders', { deviceId: 'd', address, items: [{ productId: 'nope', qty: 1 }] })).status).toBe(400);
  });

  it('lists orders per device', async () => {
    const { app, json } = setup();
    await json('/orders', { deviceId: 'mine', address, items: [{ productId: cheap.id, qty: 1 }] });
    await json('/orders', { deviceId: 'other', address, items: [{ productId: cheap.id, qty: 1 }] });
    const list = (await (await app.request('/orders?deviceId=mine')).json()) as Order[];
    expect(list).toHaveLength(1);
  });
});

describe('/ask post-check', () => {
  const reviewId = phone.reviews[0]!.id;

  it('keeps a grounded answer and drops citations that are not this product’s reviews', () => {
    const res = postCheckAnswer({ answer: 'Buyers say the battery lasts a day.', grounded: true, citations: [reviewId, 'r-fake'] }, phone);
    expect(res).toEqual({ answer: 'Buyers say the battery lasts a day.', grounded: true, citations: [reviewId] });
  });

  it('downgrades an uncited answer with a number that is not in the product data', () => {
    expect(unsupportedNumbers('It has a 98765 mAh battery.', phone)).toEqual(['98765']);
    const res = postCheckAnswer({ answer: 'It has a 98765 mAh battery.', grounded: true, citations: [] }, phone);
    expect(res).toEqual({ answer: NOT_GROUNDED_ANSWER, grounded: false, citations: [] });
  });

  it('allows numbers that are in the product data', () => {
    const res = postCheckAnswer({ answer: `It costs ₹${phone.price.toLocaleString('en-IN')}.`, grounded: true, citations: [] }, phone);
    expect(res.grounded).toBe(true);
  });

  it('uses the exact refusal text when not grounded', () => {
    const res = postCheckAnswer({ answer: 'Probably yes, most phones are.', grounded: false, citations: [reviewId] }, phone);
    expect(res).toEqual({ answer: NOT_GROUNDED_ANSWER, grounded: false, citations: [] });
  });

  it('returns a safe fallback (not a 500) when the model fails', async () => {
    const { json } = setup(new Error('Vertex unavailable'));
    const res = await json('/ask', { productId: phone.id, question: 'Is the battery good?', history: [] });
    expect(res.status).toBe(200);
    const body = (await res.json()) as AskResponse;
    expect(body.grounded).toBe(false);
  });

  it('rejects questions over 500 characters and unknown products', async () => {
    const { json, calls } = setup({ answer: 'x', grounded: true, citations: [] });
    expect((await json('/ask', { productId: phone.id, question: 'a'.repeat(501), history: [] })).status).toBe(400);
    expect((await json('/ask', { productId: 'nope', question: 'hi', history: [] })).status).toBe(404);
    expect(calls).toHaveLength(0);
  });

  it('rate-limits AI routes per device', async () => {
    const { json } = setup({ answer: 'ok', grounded: false, citations: [] });
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      statuses.push((await json('/ask', { productId: phone.id, question: 'q', history: [] }, { 'x-device-id': 'spammy' })).status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});

describe('insights post-check', () => {
  it('removes unknown ids and keeps a con when a critical review exists', () => {
    const product = products.find((p) => p.reviews.some((r) => r.rating <= 3))!;
    const good = product.reviews.find((r) => r.rating >= 4)!;
    const res = postCheckInsights(
      { pros: [{ point: 'Great build', reviewIds: [good.id, 'fake'] }, { point: 'Made up', reviewIds: ['fake'] }], cons: [] },
      product,
    )!;
    expect(res.pros).toEqual([{ point: 'Great build', reviewIds: [good.id] }]);
    expect(res.cons).toHaveLength(1);
    expect(product.reviews.find((r) => r.id === res.cons[0]!.reviewIds[0])!.rating).toBeLessThanOrEqual(3);
  });

  it('caches insights per product', async () => {
    const product = products.find((p) => p.reviews.length >= 2)!;
    const output = { pros: [{ point: 'Nice', reviewIds: [product.reviews[0]!.id] }], cons: [{ point: 'Meh', reviewIds: [product.reviews[1]!.id] }] };
    const { app, calls } = setup(output);
    await app.request(`/products/${product.id}/insights`);
    await app.request(`/products/${product.id}/insights`);
    expect(calls).toEqual(['insights']);
  });
});

describe('search parse', () => {
  it('falls back to a keyword search when the model output is invalid', async () => {
    const { json } = setup({ category: 'not-a-category', explanation: 'x' });
    const res = await (await json('/search/parse', { query: 'gift for dad' })).json();
    expect(res).toEqual({ filters: { search: 'gift for dad' }, explanation: 'Showing results for “gift for dad”' });
  });

  it('accepts valid structured filters', async () => {
    const { json } = setup({ category: 'kitchen-accessories', maxPrice: 2000, explanation: 'Showing kitchen items under ₹2,000.' });
    const res = await (await json('/search/parse', { query: 'gift for dad who cooks under 2000' })).json();
    expect(res).toEqual({ filters: { category: 'kitchen-accessories', maxPrice: 2000 }, explanation: 'Showing kitchen items under ₹2,000.' });
  });
});

describe('admin', () => {
  it('rejects a missing or wrong admin key', async () => {
    const { app } = setup();
    expect((await app.request('/admin/orders/x/ship', { method: 'POST' })).status).toBe(401);
    expect((await app.request('/admin/orders/x/ship', { method: 'POST', headers: { 'x-admin-key': 'wrong' } })).status).toBe(401);
  });

  it('is disabled when no admin key is configured', async () => {
    const app = createApp({
      store: createMemoryStore(),
      model: { generateJson: async () => ({}) },
      pusher: { send: async () => 0 },
      adminKey: '',
    });
    expect((await app.request('/admin/orders/x/ship', { method: 'POST', headers: { 'x-admin-key': '' } })).status).toBe(503);
  });

  it('ships an order and pushes order_update to its device', async () => {
    const { app, json, sent } = setup();
    await json('/devices', { deviceId: 'dev-9', pushToken: 'ExponentPushToken[abc]' });
    const order = (await (await json('/orders', { deviceId: 'dev-9', address, items: [{ productId: cheap.id, qty: 1 }] })).json()) as Order;

    const res = await app.request(`/admin/orders/${order.id}/ship`, { method: 'POST', headers: { 'x-admin-key': ADMIN_KEY } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { order: Order; pushed: number };
    expect(body.order.status).toBe('shipped');
    expect(body.order.history?.map((h) => h.status)).toEqual(['placed', 'shipped']);
    expect(sent[0]?.tokens).toEqual(['ExponentPushToken[abc]']);
    const recent = (await (await app.request('/admin/orders', { headers: { 'x-admin-key': ADMIN_KEY } })).json()) as { id: string }[];
    expect(recent[0]?.id).toBe(order.id);
    expect(sent[0]?.payload).toMatchObject({
      title: 'Your order has shipped',
      categoryId: 'order_update',
      channelId: 'order-updates',
      data: { url: `shopassist://order/${order.id}`, orderId: order.id },
    });
  });

  it('drops a price, stores the override and pushes to subscribers', async () => {
    const { app, json, sent } = setup();
    await json('/devices', { deviceId: 'dev-1', pushToken: 'ExponentPushToken[one]' });
    await json('/alerts', { deviceId: 'dev-1', productId: phone.id, type: 'price_drop' });

    const res = await json(`/admin/products/${phone.id}/price-drop`, { percent: 10 }, { 'x-admin-key': ADMIN_KEY });
    const body = (await res.json()) as { price: number; oldPrice: number; pushed: number };
    expect(body.price).toBeLessThan(body.oldPrice);
    expect(body.pushed).toBe(1);
    expect(sent[0]?.payload).toMatchObject({ categoryId: 'price_alert', channelId: 'price-alerts', data: { productId: phone.id } });

    const product = (await (await app.request(`/products/${phone.id}`)).json()) as Product;
    expect(product.price).toBe(body.price);
  });
});
