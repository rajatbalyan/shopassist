import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorState } from '@/components/error-state';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { PriceTag } from '@/components/price-tag';
import { RatingStars } from '@/components/rating-stars';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api';
import * as haptics from '@/lib/haptics';
import { useProduct } from '@/lib/queries';
import { useCartStore } from '@/store/cart';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isPending, isError, error, refetch } = useProduct(id);
  const add = useCartStore((s) => s.add);

  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    return notFound ? (
      <ErrorState title="Product not found" message="It may have been removed." />
    ) : (
      <ErrorState onRetry={refetch} />
    );
  }

  return (
    <PlaceholderScreen title="Product" edges={[]}>
      <Stack.Screen options={{ title: product?.brand ?? '' }} />
      {isPending ? (
        <ActivityIndicator />
      ) : (
        <View style={styles.details}>
          <ThemedText variant="heading">{product.title}</ThemedText>
          <RatingStars rating={product.rating} count={product.reviewCount} variant="full" />
          <PriceTag price={product.price} mrp={product.mrp} size="lg" />
          <Button
            title="Add to cart"
            onPress={() => {
              add(product);
              haptics.success();
            }}
          />
          <Button
            title="Ask AI"
            variant="secondary"
            onPress={() => router.push({ pathname: '/product/[id]/ask', params: { id: product.id } })}
          />
          <Button
            title="More in this category"
            variant="ghost"
            onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: product.category } })}
          />
        </View>
      )}
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  details: { gap: Spacing.md },
});
