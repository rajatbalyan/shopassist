import type { ReactElement, ReactNode, Ref } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ErrorState } from '@/components/error-state';
import { ProductCard } from '@/components/product-card';
import { ProductCardSkeleton } from '@/components/skeleton';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as haptics from '@/lib/haptics';
import type { Product } from '@/types';

const SKELETONS = Array.from({ length: 6 }, (_, i) => i);

export type ProductGridProps = {
  products: Product[];
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  onEndReached?: () => void;
  isFetchingNextPage?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  ListHeaderComponent?: ReactElement | null;
  /** Shown when loaded with zero products. */
  ListEmptyComponent?: ReactElement | null;
  /** Extra content under each card (e.g. "Move to cart"). */
  renderBelowCard?: (product: Product) => ReactNode;
  onLongPressProduct?: (product: Product) => void;
  listRef?: Ref<FlatList<Product | number>>;
};

/** Two-column product grid with skeleton, error, empty, refresh and infinite-scroll states. */
export function ProductGrid({
  products,
  isPending,
  isError,
  onRetry,
  onEndReached,
  isFetchingNextPage,
  onRefresh,
  refreshing = false,
  ListHeaderComponent,
  ListEmptyComponent,
  renderBelowCard,
  onLongPressProduct,
  listRef,
}: ProductGridProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  // Explicit width so an odd last item doesn't stretch to full width.
  const cell = { width: (width - Spacing.lg * 2 - Spacing.md) / 2 };
  const loading = isPending && products.length === 0;
  const data: (Product | number)[] = loading ? SKELETONS : isError && products.length === 0 ? [] : products;

  return (
    <FlatList
      ref={listRef}
      data={data}
      keyExtractor={(item) => (typeof item === 'number' ? `skeleton-${item}` : item.id)}
      numColumns={2}
      columnWrapperStyle={styles.column}
      contentContainerStyle={styles.content}
      ListHeaderComponent={ListHeaderComponent ?? undefined}
      ListEmptyComponent={isError ? <ErrorState onRetry={onRetry} /> : (ListEmptyComponent ?? undefined)}
      ListFooterComponent={
        isFetchingNextPage ? <ActivityIndicator style={styles.footer} color={colors.primary} /> : undefined
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              haptics.tap();
              onRefresh();
            }}
            tintColor={colors.primary} colors={[colors.primary]} />
        ) : undefined
      }
      renderItem={({ item }) =>
        typeof item === 'number' ? (
          <View style={[styles.cell, cell]}>
            <ProductCardSkeleton />
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(250)} style={[styles.cell, cell]}>
            <ProductCard product={item} onLongPress={onLongPressProduct} />
            {renderBelowCard?.(item)}
          </Animated.View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  column: { gap: Spacing.md },
  cell: { gap: Spacing.sm },
  footer: { paddingVertical: Spacing.xl },
});
