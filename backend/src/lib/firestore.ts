import { Firestore } from '@google-cloud/firestore';

import { config } from '../config.js';
import type { AlertType, BuyerInsights, Order, OrderStatus } from '../types.js';
import type { PriceOverrides } from './catalog.js';

export type StoredOrder = Order & { deviceId: string };
export type Device = { deviceId: string; pushToken: string; updatedAt: string };
export type CachedInsights = { reviewCount: number; insights: BuyerInsights; createdAt: string };

/** Everything the API persists. Firestore in production, memory for tests and offline dev. */
export interface Store {
  createOrder(order: StoredOrder): Promise<void>;
  getOrder(id: string): Promise<StoredOrder | undefined>;
  listOrders(deviceId: string): Promise<StoredOrder[]>;
  /** Newest orders across all devices (admin: find the order id to ship in a demo). */
  recentOrders(limit: number): Promise<StoredOrder[]>;
  /** Appends to `history`; returns the updated order. */
  setOrderStatus(id: string, status: OrderStatus): Promise<StoredOrder | undefined>;

  upsertDevice(deviceId: string, pushToken: string): Promise<void>;
  getDevice(deviceId: string): Promise<Device | undefined>;
  getDevices(deviceIds: string[]): Promise<Device[]>;
  /** Forget a token Expo reported as DeviceNotRegistered. */
  removePushToken(pushToken: string): Promise<void>;

  addAlert(deviceId: string, productId: string, type: AlertType): Promise<void>;
  removeAlert(deviceId: string, productId: string, type: AlertType): Promise<void>;
  /** Device ids subscribed to this alert. */
  alertSubscribers(productId: string, type: AlertType): Promise<string[]>;

  getPriceOverrides(): Promise<PriceOverrides>;
  setPriceOverride(productId: string, price: number): Promise<void>;

  getInsights(productId: string): Promise<CachedInsights | undefined>;
  setInsights(productId: string, value: CachedInsights): Promise<void>;
}

const now = () => new Date().toISOString();
const alertId = (deviceId: string, productId: string, type: AlertType) => `${deviceId}_${productId}_${type}`;

function withStatus(order: StoredOrder, status: OrderStatus): StoredOrder {
  return { ...order, status, history: [...(order.history ?? []), { status, at: now() }] };
}

export function createMemoryStore(): Store {
  const orders = new Map<string, StoredOrder>();
  const devices = new Map<string, Device>();
  const alerts = new Map<string, { deviceId: string; productId: string; type: AlertType }>();
  const overrides: PriceOverrides = {};
  const insights = new Map<string, CachedInsights>();

  return {
    async createOrder(order) {
      orders.set(order.id, order);
    },
    async getOrder(id) {
      return orders.get(id);
    },
    async listOrders(deviceId) {
      return [...orders.values()].filter((o) => o.deviceId === deviceId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async recentOrders(limit) {
      return [...orders.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
    },
    async setOrderStatus(id, status) {
      const order = orders.get(id);
      if (!order) return undefined;
      const next = withStatus(order, status);
      orders.set(id, next);
      return next;
    },
    async upsertDevice(deviceId, pushToken) {
      devices.set(deviceId, { deviceId, pushToken, updatedAt: now() });
    },
    async getDevice(deviceId) {
      return devices.get(deviceId);
    },
    async getDevices(deviceIds) {
      return deviceIds.flatMap((id) => devices.get(id) ?? []);
    },
    async removePushToken(pushToken) {
      for (const [id, d] of devices) if (d.pushToken === pushToken) devices.delete(id);
    },
    async addAlert(deviceId, productId, type) {
      alerts.set(alertId(deviceId, productId, type), { deviceId, productId, type });
    },
    async removeAlert(deviceId, productId, type) {
      alerts.delete(alertId(deviceId, productId, type));
    },
    async alertSubscribers(productId, type) {
      return [...alerts.values()].filter((a) => a.productId === productId && a.type === type).map((a) => a.deviceId);
    },
    async getPriceOverrides() {
      return { ...overrides };
    },
    async setPriceOverride(productId, price) {
      overrides[productId] = price;
    },
    async getInsights(productId) {
      return insights.get(productId);
    },
    async setInsights(productId, value) {
      insights.set(productId, value);
    },
  };
}

/** Price overrides are read on every catalog request, so they're cached briefly per instance. */
const OVERRIDES_TTL_MS = 30_000;

export function createFirestoreStore(): Store {
  const db = new Firestore({
    projectId: config.projectId || undefined,
    databaseId: config.firestoreDatabaseId,
    ignoreUndefinedProperties: true,
  });
  const ordersCol = db.collection('orders');
  const devicesCol = db.collection('devices');
  const alertsCol = db.collection('alerts');
  const overridesCol = db.collection('priceOverrides');
  const insightsCol = db.collection('insights');
  let overridesCache: { value: PriceOverrides; at: number } | null = null;

  return {
    async createOrder(order) {
      await ordersCol.doc(order.id).set(order);
    },
    async getOrder(id) {
      const snap = await ordersCol.doc(id).get();
      return snap.exists ? (snap.data() as StoredOrder) : undefined;
    },
    async listOrders(deviceId) {
      // Single equality filter (no composite index needed); sorted here.
      const snap = await ordersCol.where('deviceId', '==', deviceId).get();
      return snap.docs.map((d) => d.data() as StoredOrder).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    async recentOrders(limit) {
      const snap = await ordersCol.orderBy('createdAt', 'desc').limit(limit).get();
      return snap.docs.map((d) => d.data() as StoredOrder);
    },
    async setOrderStatus(id, status) {
      const ref = ordersCol.doc(id);
      return db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) return undefined;
        const next = withStatus(snap.data() as StoredOrder, status);
        tx.set(ref, next);
        return next;
      });
    },
    async upsertDevice(deviceId, pushToken) {
      await devicesCol.doc(deviceId).set({ deviceId, pushToken, updatedAt: now() });
    },
    async getDevice(deviceId) {
      const snap = await devicesCol.doc(deviceId).get();
      return snap.exists ? (snap.data() as Device) : undefined;
    },
    async getDevices(deviceIds) {
      if (deviceIds.length === 0) return [];
      const snaps = await db.getAll(...deviceIds.map((id) => devicesCol.doc(id)));
      return snaps.filter((s) => s.exists).map((s) => s.data() as Device);
    },
    async removePushToken(pushToken) {
      const snap = await devicesCol.where('pushToken', '==', pushToken).get();
      await Promise.all(snap.docs.map((d) => d.ref.delete()));
    },
    async addAlert(deviceId, productId, type) {
      await alertsCol.doc(alertId(deviceId, productId, type)).set({ deviceId, productId, type, createdAt: now() });
    },
    async removeAlert(deviceId, productId, type) {
      await alertsCol.doc(alertId(deviceId, productId, type)).delete();
    },
    async alertSubscribers(productId, type) {
      const snap = await alertsCol.where('productId', '==', productId).where('type', '==', type).get();
      return [...new Set(snap.docs.map((d) => d.get('deviceId') as string))];
    },
    async getPriceOverrides() {
      if (overridesCache && Date.now() - overridesCache.at < OVERRIDES_TTL_MS) return overridesCache.value;
      const snap = await overridesCol.get();
      const value: PriceOverrides = {};
      for (const d of snap.docs) value[d.id] = d.get('price') as number;
      overridesCache = { value, at: Date.now() };
      return value;
    },
    async setPriceOverride(productId, price) {
      await overridesCol.doc(productId).set({ price, updatedAt: now() });
      overridesCache = null;
    },
    async getInsights(productId) {
      const snap = await insightsCol.doc(productId).get();
      return snap.exists ? (snap.data() as CachedInsights) : undefined;
    },
    async setInsights(productId, value) {
      await insightsCol.doc(productId).set(value);
    },
  };
}

export const createStore = (): Store => (config.store === 'memory' ? createMemoryStore() : createFirestoreStore());
