import { serve } from '@hono/node-server';

import { createApp } from './app.js';
import { config } from './config.js';
import { createGeminiModel } from './lib/ai.js';
import { createStore } from './lib/firestore.js';
import { log } from './lib/log.js';
import { createExpoPusher } from './lib/push.js';

const store = createStore();
const app = createApp({ store, model: createGeminiModel(), pusher: createExpoPusher(store), adminKey: config.adminKey });

const server = serve({ fetch: app.fetch, port: config.port }, (info) => {
  log('INFO', 'listening', { port: info.port, store: config.store, model: config.model, location: config.location });
});

// Cloud Run sends SIGTERM before stopping an instance.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
