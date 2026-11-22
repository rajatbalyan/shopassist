import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';

import type { JsonModel } from './ai.js';
import type { Store } from './firestore.js';
import type { Pusher } from './push.js';

export type Deps = { store: Store; model: JsonModel; pusher: Pusher; adminKey: string };

/** Validates a JSON body; 400 with the first issue on failure. */
export async function readBody<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw new HTTPException(400, { message: 'Body must be JSON' });
  }
  return check(schema, json);
}

export function check<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HTTPException(400, { message: `${issue?.path.join('.') || 'input'}: ${issue?.message ?? 'invalid'}` });
  }
  return result.data;
}

export const notFound = (what: string) => new HTTPException(404, { message: `${what} not found` });
