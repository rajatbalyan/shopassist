import { FlatList, StyleSheet, View } from 'react-native';

import { ProductCard } from '@/components/product-card';
import { ProductCardSkeleton } from '@/components/skeleton';
import { Spacing } from '@/constants/theme';
import type { Product } from '@/types';

const CARD_WIDTH = 168;

type ProductRowProps = {
  products: Product[] | undefined;
  loading?: boolean;
  onLongPressProduct?: (product: Product) => void;
};

/** Horizontal scroller of product cards (Sponsored, Similar, wishlist suggestions). */
export function ProductRow({ products, loading, onLongPressProduct }: ProductRowProps) {
  if (loading && !products?.length) {
    return (
      <View style={styles.skeletonRow}>
        {[0, 1].map((i) => (
          <View key={i} style={{ width: CARD_WIDTH }}>
            <ProductCardSkeleton />
          </View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      horizontal
      data={products ?? []}
      keyExtractor={(p) => p.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
      renderItem={({ item }) => (
        <ProductCard product={item} onLongPress={onLongPressProduct} style={{ width: CARD_WIDTH }} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.md, paddingHorizontal: Spacing.lg },
  skeletonRow: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.lg },
});
