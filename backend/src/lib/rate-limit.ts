import type { MiddlewareHandler } from 'hono';

/**
 * Fixed-window, in-memory limit per device (x-device-id header) or client IP.
 * Per instance only: enough to stop casual abuse of the AI routes on a small demo.
 */
export function rateLimit(perMinute: number): MiddlewareHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return async (c, next) => {
    const now = Date.now();
    const key =
      c.req.header('x-device-id') ||
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown';
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);

    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + 60_000 });
    } else if (++entry.count > perMinute) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json({ error: 'Too many requests. Try again in a minute.' }, 429);
    }
    await next();
  };
}
