import { Hono } from 'hono';
import { z } from 'zod';

import { readBody, type Deps } from '../lib/http.js';

const deviceBody = z.object({ deviceId: z.string().min(1).max(100), pushToken: z.string().min(1).max(300) });

const alertBody = z.object({
  deviceId: z.string().min(1).max(100),
  productId: z.string().min(1).max(50),
  type: z.enum(['price_drop', 'back_in_stock']),
});

export function deviceRoutes({ store }: Deps) {
  return new Hono()
    .post('/devices', async (c) => {
      const { deviceId, pushToken } = await readBody(c, deviceBody);
      await store.upsertDevice(deviceId, pushToken);
      return c.body(null, 204);
    })
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
