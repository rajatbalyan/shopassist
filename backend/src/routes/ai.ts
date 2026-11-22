import { Hono } from 'hono';
import { z } from 'zod';

import { AI } from '../config.js';
import { askAboutProduct, parseSearch, summariseReviews } from '../lib/ai.js';
import { findProduct } from '../lib/catalog.js';
import { notFound, readBody, type Deps } from '../lib/http.js';
import { log } from '../lib/log.js';
import { rateLimit } from '../lib/rate-limit.js';

const askBody = z.object({
  productId: z.string().min(1),
  question: z.string().trim().min(1).max(AI.maxQuestionLength, `must be at most ${AI.maxQuestionLength} characters`),
  history: z
    .array(
      z.object({
        id: z.string().optional(),
        role: z.enum(['user', 'assistant']),
        text: z.string(),
        grounded: z.boolean().optional(),
        citations: z.array(z.string()).optional(),
      }),
    )
    .max(100)
    .default([]),
});

const parseBody = z.object({ query: z.string().trim().min(1).max(AI.maxQuestionLength) });

export function aiRoutes({ store, model }: Deps) {
  const limited = rateLimit(AI.rateLimitPerMinute);

  return new Hono()
    .post('/ask', limited, async (c) => {
      const { productId, question, history } = await readBody(c, askBody);
      const product = findProduct(productId, await store.getPriceOverrides());
      if (!product) throw notFound('Product');
      const messages = history.map((m, i) => ({ ...m, id: m.id ?? String(i) }));
      return c.json(await askAboutProduct(model, product, question, messages));
    })
    .get('/products/:id/insights', limited, async (c) => {
      const product = findProduct(c.req.param('id'));
      if (!product) throw notFound('Product');

      // Cached per product + review count: new reviews invalidate it.
      const cached = await store.getInsights(product.id).catch(() => undefined);
      if (cached && cached.reviewCount === product.reviews.length) return c.json(cached.insights);

      const insights = await summariseReviews(model, product);
      if (!insights) return c.json({ pros: [], cons: [] }); // AI unavailable: empty, not cached
      await store
        .setInsights(product.id, { reviewCount: product.reviews.length, insights, createdAt: new Date().toISOString() })
        .catch((e: unknown) => log('WARNING', 'insights.cache_write_failed', { error: String(e) }));
      return c.json(insights);
    })
    .post('/search/parse', limited, async (c) => {
      const { query } = await readBody(c, parseBody);
      return c.json(await parseSearch(model, query));
    });
}
