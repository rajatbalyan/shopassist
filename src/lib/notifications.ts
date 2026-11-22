import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Linking, Platform } from 'react-native';

import { api, isMockApi } from '@/lib/api';
import { formatPrice, shortOrderId } from '@/lib/format';
import * as haptics from '@/lib/haptics';
import { deepLink, linkToHref } from '@/lib/links';
import { queryClient, queryKeys } from '@/lib/queries';
import { selectCartCount, useCartStore } from '@/store/cart';
import { useSettingsStore } from '@/store/settings';
import { waitForHydration } from '@/store/storage';
import { useUiStore } from '@/store/ui';
import type { Order, OrderStatus, Product } from '@/types';

// Single place for notification logic: handler, channels, categories, permissions,
// local scheduling and response routing. Push (Prompts 4–5) reuses all of it.

const supported = Platform.OS !== 'web';

/** Expo Go has no remote push on Android (SDK 53+), and action buttons need a dev build. */
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const CHANNELS = {
  orders: 'order-updates',
  prices: 'price-alerts',
  reminders: 'reminders',
} as const;

export const CATEGORIES = {
  order: 'order_update',
  price: 'price_alert',
} as const;

export const ACTIONS = {
  track: 'track',
  rate: 'rate',
  addToCart: 'add_to_cart',
  view: 'view',
} as const;

const CART_REMINDER_ID = 'cart-reminder';
const CART_REMINDER_SECONDS = 2 * 60 * 60;
const DEMO_CART_REMINDER_SECONDS = 10;
const DEMO_DELAY_SECONDS = 5;

/** What every notification we send (local or push) carries in `data`. */
export type NotificationData = {
  url?: string;
  orderId?: string;
  productId?: string;
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

if (supported) {
  // Show alerts, play sound and update the badge even while the app is open.
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

let setupPromise: Promise<void> | null = null;

/** Creates Android channels and the action-button categories. Safe to call repeatedly. */
export function setupNotifications() {
  if (!supported) return Promise.resolve();
  setupPromise ??= (async () => {
    if (Platform.OS === 'android') {
      await Promise.all([
        Notifications.setNotificationChannelAsync(CHANNELS.orders, {
          name: 'Order updates',
          importance: AndroidImportance.HIGH,
        }),
        Notifications.setNotificationChannelAsync(CHANNELS.prices, {
          name: 'Price alerts',
          importance: AndroidImportance.DEFAULT,
        }),
        Notifications.setNotificationChannelAsync(CHANNELS.reminders, {
          name: 'Reminders',
          importance: AndroidImportance.LOW,
        }),
      ]);
    }
    await Promise.all([
      Notifications.setNotificationCategoryAsync(CATEGORIES.order, [
        { identifier: ACTIONS.track, buttonTitle: 'Track order', options: { opensAppToForeground: true } },
        { identifier: ACTIONS.rate, buttonTitle: 'Rate product', options: { opensAppToForeground: true } },
      ]),
      Notifications.setNotificationCategoryAsync(CATEGORIES.price, [
        { identifier: ACTIONS.addToCart, buttonTitle: 'Add to cart', options: { opensAppToForeground: true } },
        { identifier: ACTIONS.view, buttonTitle: 'View', options: { opensAppToForeground: true } },
      ]),
    ]);
  })().catch((e: unknown) => {
    setupPromise = null;
    console.warn('[notifications] setup failed', e);
  });
  return setupPromise;
}

// ---------------------------------------------------------------------------
// Permissions (always asked in context, never on launch)
// ---------------------------------------------------------------------------

export type PermissionContext = 'cart' | 'alert' | 'settings';

export async function hasPermission() {
  if (!supported) return false;
  const { granted } = await Notifications.getPermissionsAsync();
  return granted;
}

/**
 * Makes sure notifications are allowed, explaining why first.
 * - Not asked yet (or can ask again): explainer sheet → system prompt.
 * - Blocked: explainer with "Turn on in Settings".
 * After a first add-to-cart we only ask once; explicit toggles may ask again.
 */
export async function ensureNotificationPermission(context: PermissionContext): Promise<boolean> {
  if (!supported) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const settings = useSettingsStore.getState();
  if (context === 'cart') {
    if (settings.notificationPromptSeen) return false;
    settings.setNotificationPromptSeen();
  }

  const blocked = current.status === 'denied' && !current.canAskAgain;
  const allow = await useUiStore.getState().promptPermission(blocked ? 'denied' : 'ask');
  if (!allow) return false;
  if (blocked) {
    await openNotificationSettings();
    return false;
  }

  // Android 13+ only shows the system prompt once a channel exists.
  await setupNotifications();
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  if (result.granted) void syncPushToken();
  return result.granted;
}

export const openNotificationSettings = () => Linking.openSettings().catch(() => {});

// ---------------------------------------------------------------------------
// Local notifications
// ---------------------------------------------------------------------------

type LocalNotification = {
  title: string;
  body: string;
  data: NotificationData;
  seconds: number;
  channelId: string;
  categoryIdentifier?: string;
  identifier?: string;
};

async function schedule({ title, body, data, seconds, channelId, categoryIdentifier, identifier }: LocalNotification) {
  if (!supported || !(await hasPermission())) return null;
  await setupNotifications();
  return Notifications.scheduleNotificationAsync({
    identifier,
    content: { title, body, data, sound: true, ...(categoryIdentifier ? { categoryIdentifier } : {}) },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds, channelId },
  });
}

export function sendTestNotification() {
  return schedule({
    title: 'ShopAssist test',
    body: 'Notifications are working. Tap to open your notification settings.',
    data: { url: deepLink('notifications') },
    seconds: 2,
    channelId: CHANNELS.orders,
  });
}

export async function scheduleCartReminder(itemCount: number) {
  await cancelCartReminder();
  const { demoMode, notifications } = useSettingsStore.getState();
  if (!notifications.cartReminders || itemCount === 0) return;
  await schedule({
    identifier: CART_REMINDER_ID,
    title: 'Still thinking it over?',
    body: `You left ${itemCount} item${itemCount === 1 ? '' : 's'} in your cart.`,
    data: { url: deepLink('cart') },
    seconds: demoMode ? DEMO_CART_REMINDER_SECONDS : CART_REMINDER_SECONDS,
    channelId: CHANNELS.reminders,
  });
}

export function cancelCartReminder() {
  if (!supported) return Promise.resolve();
  return Notifications.cancelScheduledNotificationAsync(CART_REMINDER_ID).catch(() => {});
}

/** Demo (mock mode): the "order shipped/delivered" push the backend will send in Prompt 4. */
export function scheduleOrderStatusDemo(order: Order, status: OrderStatus) {
  if (status === 'placed' || !useSettingsStore.getState().notifications.orderUpdates) return Promise.resolve(null);
  const id = shortOrderId(order.id);
  return schedule({
    title: status === 'shipped' ? `Your order ${id} has shipped` : `Your order ${id} was delivered`,
    body:
      status === 'shipped'
        ? `${order.items[0]?.title ?? 'Your items'} ${order.items.length > 1 ? `and ${order.items.length - 1} more are` : 'is'} on the way.`
        : 'Enjoying it? Rate your purchase to help other shoppers.',
    data: { url: deepLink(`order/${order.id}`), orderId: order.id },
    seconds: DEMO_DELAY_SECONDS,
    channelId: CHANNELS.orders,
    categoryIdentifier: CATEGORIES.order,
  });
}

/** Demo (mock mode): the "price drop" push the backend will send in Prompt 4. */
export function schedulePriceDropDemo(product: Product, oldPrice: number) {
  return schedule({
    title: `Price drop: ${product.title}`,
    body: `Now ${formatPrice(product.price)} (was ${formatPrice(oldPrice)}).`,
    data: { url: deepLink(`product/${product.id}`), productId: product.id },
    seconds: DEMO_DELAY_SECONDS,
    channelId: CHANNELS.prices,
    categoryIdentifier: CATEGORIES.price,
  });
}

// ---------------------------------------------------------------------------
// Push (Prompts 4–5; not called on launch yet)
// ---------------------------------------------------------------------------

/** Expo push token in a development/preview build with a projectId; `null` otherwise. */
export async function getPushToken(): Promise<string | null> {
  if (!supported) return null;
  if (isExpoGo) {
    console.warn('[notifications] Push tokens need a development build (Expo Go has no remote push). Returning null.');
    return null;
  }
  if (!Device.isDevice) {
    console.warn('[notifications] Push tokens need a physical device. Returning null.');
    return null;
  }
  const projectId: string | undefined = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) {
    console.warn('[notifications] No EAS projectId in app config. Returning null.');
    return null;
  }
  if (!(await hasPermission())) {
    console.warn('[notifications] Notification permission not granted. Returning null.');
    return null;
  }
  try {
    // Android needs a channel before a token can be fetched.
    await setupNotifications();
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch (e) {
    console.warn('[notifications] Could not get a push token', e);
    return null;
  }
}

/**
 * Registers this device's push token with the backend (POST /devices), only when it changed.
 * Development/preview builds with the real API only; a no-op in Expo Go and mock mode.
 */
export async function syncPushToken(force = false) {
  if (!supported || isExpoGo || isMockApi || !(await hasPermission())) return;
  await waitForHydration(useSettingsStore);
  const token = await getPushToken();
  if (!token) return;
  const settings = useSettingsStore.getState();
  if (!force && token === settings.registeredPushToken) return;
  try {
    await api.registerDevice(settings.deviceId, token);
    settings.setRegisteredPushToken(token);
  } catch (e) {
    console.warn('[notifications] Could not register the push token', e);
  }
}

// ---------------------------------------------------------------------------
// Responses (taps and action buttons) and app-wide wiring
// ---------------------------------------------------------------------------

const handledResponses = new Set<string>();

async function handleResponse(response: Notifications.NotificationResponse) {
  const { notification, actionIdentifier } = response;
  const key = `${notification.request.identifier}:${actionIdentifier}:${notification.date}`;
  if (handledResponses.has(key)) return;
  handledResponses.add(key);
  Notifications.clearLastNotificationResponse();

  const data = (notification.request.content.data ?? {}) as NotificationData;
  const orderId = data.orderId ?? data.url?.match(/order\/([^/?#]+)/)?.[1];

  switch (actionIdentifier) {
    case ACTIONS.track:
      if (orderId) router.push({ pathname: '/order/[id]', params: { id: orderId } });
      return;
    case ACTIONS.rate:
      if (orderId) router.push({ pathname: '/order/[id]', params: { id: orderId, rate: '1' } });
      return;
    case ACTIONS.addToCart: {
      if (!data.productId) break;
      try {
        const id = data.productId;
        const product = await queryClient.fetchQuery({ queryKey: queryKeys.product(id), queryFn: () => api.getProduct(id), staleTime: 0 });
        useCartStore.getState().add(product);
        haptics.success();
        router.navigate('/cart');
      } catch {
        if (data.url) router.push(linkToHref(data.url));
      }
      return;
    }
  }
  // Default tap and "View": follow the deep link.
  if (data.url) router.push(linkToHref(data.url));
}

/**
 * Mount once in the root layout. Routes notification taps/actions (including the one that
 * launched the app from a killed state), keeps the cart reminder in sync with app state,
 * and asks for permission after the first add-to-cart.
 */
export function useNotifications() {
  useEffect(() => {
    if (!supported) return;
    void setupNotifications();
    // Push token → backend on start (if already allowed), and again if it rotates.
    void syncPushToken();
    const tokenSub = Notifications.addPushTokenListener(() => void syncPushToken(true));

    // Cold start: the response that launched the app.
    const last = Notifications.getLastNotificationResponse();
    if (last) void handleResponse(last);
    const responseSub = Notifications.addNotificationResponseReceivedListener((r) => void handleResponse(r));

    // Cart reminder: schedule when backgrounded with items, cancel on return.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void cancelCartReminder();
      else if (state === 'background') void scheduleCartReminder(selectCartCount(useCartStore.getState()));
    });
    void cancelCartReminder();

    const cartUnsub = useCartStore.subscribe((cart, prev) => {
      // Emptied (removed everything, or an order was placed).
      if (cart.items.length === 0 && prev.items.length > 0) void cancelCartReminder();
      // First add-to-cart is a natural moment to explain notifications
      // (not when restoring the saved cart, and not on Undo).
      const added = cart.items.length > prev.items.length;
      const undo = !!prev.lastRemoved && !cart.lastRemoved;
      if (added && !undo && useCartStore.persist.hasHydrated()) void ensureNotificationPermission('cart');
    });

    return () => {
      responseSub.remove();
      tokenSub.remove();
      appStateSub.remove();
      cartUnsub();
    };
  }, []);
}
