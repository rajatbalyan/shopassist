import NetInfo from '@react-native-community/netinfo';
import {
  focusManager,
  onlineManager,
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQueries,
  useQuery,
} from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

import { api, ApiError, DEFAULT_PAGE_SIZE, mockSetOrderStatus } from '@/lib/api';
import { useSettingsStore } from '@/store/settings';
import type { CreateOrderInput, Order, OrderStatus, Product, ProductQuery } from '@/types';

const MINUTE = 60_000;

// React Native has no browser online/focus events: feed them from NetInfo and AppState so
// queries refetch when the connection comes back and when the app returns to the foreground.
if (Platform.OS !== 'web') {
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
  );
  focusManager.setEventListener((setFocused) => {
    const sub = AppState.addEventListener('change', (s) => setFocused(s === 'active'));
    return () => sub.remove();
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MINUTE,
      // Fail fast and show the error state (with Try again) instead of pausing silently
      // while offline. Reconnecting still refetches, via onlineManager above.
      networkMode: 'always',
      // api.ts already retries GETs once; one more round here. Never retry "not found".
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) && failureCount < 1,
    },
    // Mutations (place order, alerts) fail visibly offline instead of queueing forever.
    mutations: { networkMode: 'always' },
  },
});

export const queryKeys = {
  products: (query: Omit<ProductQuery, 'page'>) => ['products', query] as const,
  product: (id: string) => ['product', id] as const,
  similar: (id: string) => ['product', id, 'similar'] as const,
  insights: (id: string) => ['product', id, 'insights'] as const,
  categories: ['categories'] as const,
  orders: (deviceId: string) => ['orders', deviceId] as const,
  order: (id: string) => ['order', id] as const,
};

/** Infinite, paginated product list. `page` in the query is ignored. */
export function useProducts(query: Omit<ProductQuery, 'page'> = {}) {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  return useInfiniteQuery({
    queryKey: queryKeys.products({ ...query, limit }),
    queryFn: ({ pageParam }) => api.getProducts({ ...query, limit, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    staleTime: 5 * MINUTE,
  });
}

/** useProducts flattened into the props ProductGrid expects. */
export function useProductGrid(query: Omit<ProductQuery, 'page'> = {}) {
  const result = useProducts(query);
  const { data, isPending, isError, refetch, isRefetching, isFetchingNextPage, hasNextPage, fetchNextPage } = result;
  return {
    products: data?.pages.flatMap((p) => p.items) ?? [],
    total: data?.pages[0]?.total,
    isPending,
    isError,
    onRetry: () => void refetch(),
    onRefresh: () => void refetch(),
    refreshing: isRefetching && !isFetchingNextPage,
    isFetchingNextPage,
    onEndReached: () => {
      if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
    },
  };
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.product(id ?? ''),
    queryFn: () => api.getProduct(id!),
    enabled: !!id,
    staleTime: 5 * MINUTE,
  });
}

export function useSimilar(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.similar(id ?? ''),
    queryFn: () => api.getSimilar(id!),
    enabled: !!id,
    staleTime: 10 * MINUTE,
  });
}

/** Insights are expensive to generate server-side and change rarely. */
export function useInsights(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.insights(id ?? ''),
    queryFn: () => api.getInsights(id!),
    enabled: !!id,
    staleTime: 30 * MINUTE,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: () => api.getCategories(),
    staleTime: 60 * MINUTE,
  });
}

export function useOrders() {
  const deviceId = useSettingsStore((s) => s.deviceId);
  return useQuery({
    queryKey: queryKeys.orders(deviceId),
    queryFn: () => api.getOrders(deviceId),
    staleTime: 30_000,
  });
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.order(id ?? ''),
    queryFn: () => api.getOrder(id!),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/** Several products by id (wishlist, cart suggestions). Shares the cache with useProduct. */
export function useProductsByIds(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({
      queryKey: queryKeys.product(id),
      queryFn: () => api.getProduct(id),
      staleTime: 5 * MINUTE,
    })),
    combine: (results) => ({
      products: results.flatMap((r) => (r.data ? [r.data] : [])) as Product[],
      isPending: results.some((r) => r.isPending),
      isError: results.length > 0 && results.every((r) => r.isError),
      refetch: () => Promise.all(results.map((r) => r.refetch())),
    }),
  });
}

function cacheOrder(order: Order) {
  queryClient.setQueryData(queryKeys.order(order.id), order);
  queryClient.invalidateQueries({ queryKey: ['orders'] });
}

export function useCreateOrder() {
  return useMutation({
    mutationFn: (input: CreateOrderInput) => api.createOrder(input),
    onSuccess: cacheOrder,
  });
}

/** Mock mode only: advance an order's status for the demo timeline. */
export function useDemoSetOrderStatus() {
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => mockSetOrderStatus(id, status),
    onSuccess: cacheOrder,
  });
}
