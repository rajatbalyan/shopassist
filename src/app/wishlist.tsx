import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { ProductGrid } from '@/components/product-grid';
import { Screen } from '@/components/screen';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as haptics from '@/lib/haptics';
import { useProductsByIds } from '@/lib/queries';
import { useCartStore } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';
import type { Product } from '@/types';

// Friendly "Something went wrong · Try again" screen instead of a red crash.
export { ErrorFallback as ErrorBoundary } from '@/components/error-fallback';

export default function WishlistScreen() {
  const { colors } = useTheme();
  const ids = useWishlistStore((s) => s.ids);
  const toggle = useWishlistStore((s) => s.toggle);
  const remove = useWishlistStore((s) => s.remove);
  const addToCart = useCartStore((s) => s.add);
  const { products, isPending, isError, refetch } = useProductsByIds(ids);
  const { show, snackbar } = useSnackbar();

  // Keep the stored order (most recently saved first).
  const ordered = ids.flatMap((id) => products.find((p) => p.id === id) ?? []);

  const moveToCart = (p: Product) => {
    addToCart(p);
    remove(p.id);
    haptics.success();
    show('Moved to cart', { actionLabel: 'View cart', onAction: () => router.navigate('/cart') });
  };

  const onRemove = (p: Product) => {
    remove(p.id);
    haptics.warning();
    show('Removed from wishlist', { actionLabel: 'Undo', onAction: () => toggle(p.id) });
  };

  return (
    <Screen edges={[]}>
      <View style={styles.flex}>
        <ProductGrid
          products={ordered}
          isPending={isPending && ids.length > 0}
          isError={isError}
          onRetry={() => void refetch()}
          ListHeaderComponent={
            ids.length > 0 ? (
              <ThemedText color="textSecondary" style={styles.count}>
                {ids.length} saved item{ids.length === 1 ? '' : 's'}
              </ThemedText>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title="Your wishlist is empty"
              message="Tap the heart on any product to save it for later."
              icon={{ ios: 'heart', android: 'favorite_border' }}
              action={{ label: 'Discover products', onPress: () => router.navigate('/') }}
            />
          }
          renderBelowCard={(p) => (
            <View style={styles.actions}>
              <Button
                title={p.stock === 0 ? 'Out of stock' : 'Move to cart'}
                variant="secondary"
                disabled={p.stock === 0}
                onPress={() => moveToCart(p)}
                style={styles.move}
              />
              <IconButton
                icon={{ ios: 'trash', android: 'delete' }}
                size={18}
                color={colors.textSecondary}
                accessibilityLabel={`Remove ${p.title} from wishlist`}
                onPress={() => onRemove(p)}
              />
            </View>
          )}
        />
        {snackbar}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  count: { marginBottom: Spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  move: { flex: 1, paddingHorizontal: Spacing.sm },
});
