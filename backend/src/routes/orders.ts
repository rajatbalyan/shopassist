import { randomBytes } from 'node:crypto';

import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { MAX_QTY } from '../config.js';
import { findProduct, priceBreakdown } from '../lib/catalog.js';
import type { StoredOrder } from '../lib/firestore.js';
import { check, notFound, readBody, type Deps } from '../lib/http.js';
import type { Order, OrderItem } from '../types.js';

// Same rules as the app's checkout form.
const address = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'must be a 10-digit Indian mobile number'),
  line1: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(80),
  pincode: z.string().regex(/^[1-9]\d{5}$/, 'must be a 6-digit pincode'),
});

const createOrderBody = z.object({
  deviceId: z.string().min(1).max(100),
  // Client prices, titles and totals are ignored: only product ids and quantities are used.
  items: z
    .array(z.looseObject({ productId: z.string().min(1), qty: z.number().int().min(1).max(MAX_QTY) }))
    .min(1)
    .max(50),
  address,
});

const newOrderId = () => `SA${Date.now().toString(36).toUpperCase()}${randomBytes(2).toString('hex').toUpperCase()}`;

/** Public shape: the device id stays server-side. */
export function toPublicOrder(order: StoredOrder): Order {
  const { deviceId: _deviceId, ...rest } = order;
  return rest;
}

export function orderRoutes({ store }: Deps) {
  return new Hono()
    .post('/orders', async (c) => {
      const body = await readBody(c, createOrderBody);
      const overrides = await store.getPriceOverrides();

      // Merge duplicate lines, then price everything from the catalog.
      const qtyById = new Map<string, number>();
      for (const i of body.items) qtyById.set(i.productId, (qtyById.get(i.productId) ?? 0) + i.qty);

      const items: OrderItem[] = [...qtyById].map(([productId, qty]) => {
        const product = findProduct(productId, overrides);
        if (!product) throw new HTTPException(400, { message: `Unknown product ${productId}` });
        if (product.stock === 0) throw new HTTPException(409, { message: `${product.title} is out of stock` });
        const max = Math.min(MAX_QTY, product.stock);
        if (qty > max) throw new HTTPException(409, { message: `Only ${max} of ${product.title} can be ordered` });
        return { productId, title: product.title, qty, price: product.price, thumbnail: product.thumbnail };
      });

      const now = new Date().toISOString();
      const order: StoredOrder = {
        id: newOrderId(),
        deviceId: body.deviceId,
        items,
        ...priceBreakdown(items),
        address: body.address,
        status: 'placed',
        createdAt: now,
        history: [{ status: 'placed', at: now }],
      };
      await store.createOrder(order);
      return c.json(toPublicOrder(order), 201);
    })
    .get('/orders', async (c) => {
      const deviceId = check(z.string().min(1).max(100), c.req.query('deviceId'));
      return c.json((await store.listOrders(deviceId)).map(toPublicOrder));
    })
    .get('/orders/:id', async (c) => {
      const order = await store.getOrder(c.req.param('id'));
      if (!order) throw notFound('Order');
      return c.json(toPublicOrder(order));
    });
}
