import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import { allProducts } from '../lib/catalog.js';
import { readBody, type Deps } from '../lib/http.js';
import { PUSH } from '../lib/push.js';
import { rateLimit } from '../lib/rate-limit.js';

const deviceBody = z.object({ deviceId: z.string().min(1).max(100), pushToken: z.string().min(1).max(300) });

const alertBody = z.object({
  deviceId: z.string().min(1).max(100),
  productId: z.string().min(1).max(50),
  type: z.enum(['price_drop', 'back_in_stock']),
});

/** Real Expo pushes cost nothing, but one device shouldn't be able to spam itself. */
export const TEST_PUSH_PER_MINUTE = 3;

/** Last 6 characters of a token: enough to compare with the app, useless to anyone else. */
const tokenSuffix = (token: string) => token.replace(/\]$/, '').slice(-6);

export function deviceRoutes({ store, pusher }: Deps) {
  return new Hono()
    .post('/devices', async (c) => {
      const { deviceId, pushToken } = await readBody(c, deviceBody);
      await store.upsertDevice(deviceId, pushToken);
      return c.body(null, 204);
    })
    // Push diagnostics in the app: is this device registered, and with which token?
    .get('/devices/:deviceId', async (c) => {
      const device = await store.getDevice(c.req.param('deviceId'));
      if (!device) return c.json({ registered: false });
      return c.json({ registered: true, tokenSuffix: tokenSuffix(device.pushToken), updatedAt: device.updatedAt });
    })
    // Admin-free "send me a test push" (demo safety net). Sends only to the device's own token.
    .post(
      '/devices/:deviceId/test-push',
      rateLimit(TEST_PUSH_PER_MINUTE, (c) => `test-push:${c.req.param('deviceId') ?? ''}`),
      async (c) => {
        const device = await store.getDevice(c.req.param('deviceId'));
        if (!device) throw new HTTPException(404, { message: 'No push token registered for this device' });
        // A real product so the action buttons (Add to cart / View) can be tried end to end.
        const product = allProducts(await store.getPriceOverrides())
          .filter((p) => p.stock > 0)
          .sort((a, b) => b.rating - a.rating)[0];
        const pushed = await pusher.send([device.pushToken], {
          title: 'Test push from ShopAssist',
          body: product
            ? `Push works. Try the buttons: add ${product.title} to your cart, or view it.`
            : 'Push works.',
          // High-importance channel so it shows as a heads-up banner on Android.
          channelId: PUSH.channels.orders,
          ...(product
            ? {
                categoryId: PUSH.categories.price,
                data: { url: `shopassist://product/${product.id}`, productId: product.id },
              }
            : { data: { url: 'shopassist://notifications' } }),
        });
        if (pushed === 0) {
          return c.json({ pushed, note: 'Expo did not accept the push (see push.error in the logs)' }, 502);
        }
        return c.json({ pushed });
      },
    )
    .post('/alerts', async (c) => {
      const { deviceId, productId, type } = await readBody(c, alertBody);
      await store.addAlert(deviceId, productId, type);
      return c.body(null, 204);
    })
    .delete('/alerts', async (c) => {
      const { deviceId, productId, type } = await readBody(c, alertBody);
      await store.removeAlert(deviceId, productId, type);
      return c.body(null, 204);
    });
}
