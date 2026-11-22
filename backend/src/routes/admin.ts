import { timingSafeEqual } from 'node:crypto';

import { Hono, type MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { droppedPrice, findProduct } from '../lib/catalog.js';
import type { StoredOrder } from '../lib/firestore.js';
import { check, notFound, type Deps } from '../lib/http.js';
import { log } from '../lib/log.js';
import { PUSH } from '../lib/push.js';
import { toPublicOrder } from './orders.js';

const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

/** Requires `x-admin-key` to equal ADMIN_KEY. With no key configured, admin routes are disabled. */
export function requireAdmin(adminKey: string): MiddlewareHandler {
  const expected = Buffer.from(adminKey);
  return async (c, next) => {
    if (!adminKey) throw new HTTPException(503, { message: 'Admin routes are disabled (ADMIN_KEY not set)' });
    const given = Buffer.from(c.req.header('x-admin-key') ?? '');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new HTTPException(401, { message: 'Invalid admin key' });
    }
    await next();
  };
}

const priceDropBody = z.object({ percent: z.number().min(1).max(90).default(10) });

export function adminRoutes({ store, pusher, adminKey }: Deps) {
  /** Push an order update to the device that placed the order. */
  async function pushOrderUpdate(order: StoredOrder, title: string, body: string) {
    const device = await store.getDevice(order.deviceId);
    if (!device) {
      log('WARNING', 'admin.no_device', { orderId: order.id, deviceId: order.deviceId });
      return { pushed: 0, note: 'No push token registered for this device' };
    }
    const pushed = await pusher.send([device.pushToken], {
      title,
      body,
      categoryId: PUSH.categories.order,
      channelId: PUSH.channels.orders,
      data: { url: `shopassist://order/${order.id}`, orderId: order.id },
    });
    return { pushed };
  }

  return new Hono()
    .use('*', requireAdmin(adminKey))
    .get('/orders', async (c) => {
      const orders = await store.recentOrders(10);
      return c.json(
        orders.map((o) => ({ id: o.id, status: o.status, createdAt: o.createdAt, total: o.total, items: o.items.map((i) => i.title) })),
      );
    })
    .post('/orders/:id/ship', async (c) => {
      const id = c.req.param('id');
      const existing = await store.getOrder(id);
      if (!existing) throw notFound('Order');
      if (existing.status === 'delivered') throw new HTTPException(409, { message: 'Order is already delivered' });
      // Re-running "ship" re-sends the push without duplicating the timeline (handy in a live demo).
      const order = existing.status === 'shipped' ? existing : ((await store.setOrderStatus(id, 'shipped')) ?? existing);

      const first = order.items[0]?.title ?? 'Your items';
      const body =
        order.items.length > 1 ? `${first} and ${order.items.length - 1} more are on the way.` : `${first} is on the way.`;
      const result = await pushOrderUpdate(order, 'Your order has shipped', body);
      return c.json({ order: toPublicOrder(order), ...result });
    })
    .post('/orders/:id/deliver', async (c) => {
      const id = c.req.param('id');
      const existing = await store.getOrder(id);
      if (!existing) throw notFound('Order');
      const order = existing.status === 'delivered' ? existing : ((await store.setOrderStatus(id, 'delivered')) ?? existing);
      const result = await pushOrderUpdate(
        order,
        'Your order was delivered',
        'Enjoying it? Rate your purchase to help other shoppers.',
      );
      return c.json({ order: toPublicOrder(order), ...result });
    })
    .post('/products/:id/price-drop', async (c) => {
      const id = c.req.param('id');
      const raw: unknown = await c.req.json().catch(() => ({}));
      const { percent } = check(priceDropBody, raw ?? {});
      const product = findProduct(id, await store.getPriceOverrides());
      if (!product) throw notFound('Product');

      const oldPrice = product.price;
      const price = droppedPrice(oldPrice, percent);
      await store.setPriceOverride(id, price);

      const subscribers = await store.alertSubscribers(id, 'price_drop');
      const devices = await store.getDevices(subscribers);
      const pushed = await pusher.send(
        devices.map((d) => d.pushToken),
        {
          title: `Price drop: ${product.title}`,
          body: `Now ${inr(price)}, down from ${inr(oldPrice)}.`,
          categoryId: PUSH.categories.price,
          channelId: PUSH.channels.prices,
          data: { url: `shopassist://product/${id}`, productId: id },
        },
      );
      return c.json({ productId: id, oldPrice, price, subscribers: subscribers.length, pushed });
    });
}
