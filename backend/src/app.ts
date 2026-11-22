import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import type { Deps } from './lib/http.js';
import { log } from './lib/log.js';
import { adminRoutes } from './routes/admin.js';
import { aiRoutes } from './routes/ai.js';
import { catalogRoutes } from './routes/catalog.js';
import { deviceRoutes } from './routes/devices.js';
import { orderRoutes } from './routes/orders.js';

/** Builds the API with its dependencies injected (real ones in index.ts, fakes in tests). */
export function createApp(deps: Deps) {
  const app = new Hono();

  // One structured log line per request.
  app.use('*', async (c, next) => {
    const started = Date.now();
    await next();
    log(c.res.status >= 500 ? 'ERROR' : 'INFO', 'request', {
      httpRequest: {
        requestMethod: c.req.method,
        requestUrl: c.req.path,
        status: c.res.status,
        latency: `${(Date.now() - started) / 1000}s`,
      },
    });
  });
  app.use('*', cors());

  app.get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));
  app.route('/', catalogRoutes(deps));
  app.route('/', aiRoutes(deps));
  app.route('/', orderRoutes(deps));
  app.route('/', deviceRoutes(deps));
  app.route('/admin', adminRoutes(deps));

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return c.json({ error: err.message }, err.status);
    log('ERROR', 'unhandled', { error: String(err), stack: err instanceof Error ? err.stack : undefined, path: c.req.path });
    return c.json({ error: 'Something went wrong' }, 500);
  });

  return app;
}
