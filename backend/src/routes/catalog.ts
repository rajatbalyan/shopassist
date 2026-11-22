import { Hono } from 'hono';
import { z } from 'zod';

import { CATEGORIES, findProduct, queryProducts, similarProducts } from '../lib/catalog.js';
import { check, notFound, type Deps } from '../lib/http.js';

const productQuery = z.object({
  search: z.string().trim().max(200).optional(),
  category: z.string().max(200).optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  sort: z.enum(['relevance', 'price_asc', 'price_desc', 'rating']).optional(),
  sponsored: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

export function catalogRoutes({ store }: Deps) {
  return new Hono()
    .get('/products', async (c) => {
      const query = check(productQuery, c.req.query());
      return c.json(queryProducts(query, await store.getPriceOverrides()));
    })
    .get('/products/:id', async (c) => {
      const product = findProduct(c.req.param('id'), await store.getPriceOverrides());
      if (!product) throw notFound('Product');
      return c.json(product);
    })
    .get('/products/:id/similar', async (c) => {
      const similar = similarProducts(c.req.param('id'), await store.getPriceOverrides());
      if (!similar) throw notFound('Product');
      return c.json(similar);
    })
    .get('/categories', (c) => c.json(CATEGORIES));
}
