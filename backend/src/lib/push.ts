import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';

import { config } from '../config.js';
import type { Store } from './firestore.js';
import { log } from './log.js';

/** Channel + category ids the app registers (src/lib/notifications.ts). */
export const PUSH = {
  channels: { orders: 'order-updates', prices: 'price-alerts' },
  categories: { order: 'order_update', price: 'price_alert' },
} as const;

export type PushPayload = Omit<ExpoPushMessage, 'to'>;

export interface Pusher {
  /** Sends to each valid token; returns how many were accepted by Expo. */
  send(tokens: string[], payload: PushPayload): Promise<number>;
}

/** How long to wait before asking Expo for delivery receipts (they aren't ready instantly). */
const RECEIPT_DELAY_MS = 15_000;

export function createExpoPusher(store: Store): Pusher {
  const expo = new Expo({ accessToken: config.expoAccessToken });

  const handleError = async (token: string | undefined, error: string | undefined, message: string) => {
    log('WARNING', 'push.error', { token, error, detail: message });
    if (error === 'DeviceNotRegistered' && token) await store.removePushToken(token).catch(() => {});
  };

  async function checkReceipts(receipts: { id: string; token: string }[]) {
    const tokenById = new Map(receipts.map((r) => [r.id, r.token]));
    for (const chunk of expo.chunkPushNotificationReceiptIds(receipts.map((r) => r.id))) {
      try {
        const result = await expo.getPushNotificationReceiptsAsync(chunk);
        for (const [id, receipt] of Object.entries(result)) {
          if (receipt.status === 'ok') log('INFO', 'push.receipt', { id, status: 'ok' });
          else await handleError(tokenById.get(id), receipt.details?.error, receipt.message);
        }
      } catch (e) {
        log('WARNING', 'push.receipts_failed', { error: String(e) });
      }
    }
  }

  return {
    async send(tokens, payload) {
      const valid = [...new Set(tokens)].filter((t) => Expo.isExpoPushToken(t));
      const invalid = tokens.length - valid.length;
      if (invalid > 0) log('WARNING', 'push.invalid_tokens', { count: invalid });
      if (valid.length === 0) return 0;

      const messages: ExpoPushMessage[] = valid.map((to) => ({ to, sound: 'default', ...payload }));
      const receipts: { id: string; token: string }[] = [];
      let accepted = 0;

      for (const chunk of expo.chunkPushNotifications(messages)) {
        let tickets: ExpoPushTicket[];
        try {
          tickets = await expo.sendPushNotificationsAsync(chunk);
        } catch (e) {
          log('ERROR', 'push.send_failed', { error: String(e) });
          continue;
        }
        tickets.forEach((ticket, i) => {
          const token = chunk[i]?.to as string | undefined;
          if (ticket.status === 'ok') {
            accepted++;
            if (token) receipts.push({ id: ticket.id, token });
          } else {
            void handleError(token, ticket.details?.error, ticket.message);
          }
        });
      }
      log('INFO', 'push.sent', { title: payload.title, tokens: valid.length, accepted });

      // Receipts are best-effort: Cloud Run may throttle CPU after the response is sent.
      if (receipts.length) setTimeout(() => void checkReceipts(receipts), RECEIPT_DELAY_MS).unref();
      return accepted;
    },
  };
}
