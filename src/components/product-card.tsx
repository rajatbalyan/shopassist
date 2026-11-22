import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Badge } from '@/components/badge';
import { PriceTag } from '@/components/price-tag';
import { RatingStars } from '@/components/rating-stars';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Product } from '@/types';

type ProductCardProps = {
  product: Product;
  onPress?: (product: Product) => void;
};

export function ProductCard({ product, onPress }: ProductCardProps) {
  const { colors } = useTheme();

  const open = () =>
    onPress ? onPress(product) : router.push({ pathname: '/product/[id]', params: { id: product.id } });

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${product.sponsored ? 'Sponsored. ' : ''}${product.title}`}
      accessibilityHint="Opens product details"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.imageWrap, { backgroundColor: colors.surfaceAlt }]}>
        <Image
          source={product.thumbnail}
          style={styles.image}
          contentFit="contain"
          transition={200}
          recyclingKey={product.id}
          accessibilityIgnoresInvertColors
        />
        {product.sponsored && <Badge label="Sponsored" tone="sponsored" style={styles.sponsored} />}
      </View>
      <View style={styles.body}>
        <ThemedText variant="body" numberOfLines={2} style={styles.title}>
          {product.title}
        </ThemedText>
        <RatingStars rating={product.rating} count={product.reviewCount} />
        <PriceTag price={product.price} mrp={product.mrp} />
        {product.stock === 0 && (
          <ThemedText variant="caption" color="danger">
            Out of stock
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  imageWrap: { aspectRatio: 1 },
  image: { flex: 1 },
  sponsored: { position: 'absolute', top: Spacing.sm, left: Spacing.sm },
  body: { padding: Spacing.md, gap: Spacing.xs },
  title: { fontSize: 14, lineHeight: 19, minHeight: 38 },
});
