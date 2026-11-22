import { QueryClient, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { api, ApiError, DEFAULT_PAGE_SIZE } from '@/lib/api';
import { useSettingsStore } from '@/store/settings';
import type { ProductQuery } from '@/types';

const MINUTE = 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: MINUTE,
      // Don't retry "not found" — it won't fix itself.
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status === 404) && failureCount < 2,
    },
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
