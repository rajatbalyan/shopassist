import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActionSheet, type SheetAction } from '@/components/action-sheet';
import { PriceTag } from '@/components/price-tag';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as haptics from '@/lib/haptics';
import { shareProduct } from '@/lib/links';
import { useCartStore } from '@/store/cart';
import { useUiStore } from '@/store/ui';
import { useWishlistStore } from '@/store/wishlist';

/** Long-press quick actions for a product card. Mounted once in the root layout. */
export function QuickActionSheet() {
  const { colors } = useTheme();
  const product = useUiStore((s) => s.quickActionProduct);
  const close = useUiStore((s) => s.closeQuickActions);
  const wishlisted = useWishlistStore((s) => (product ? s.ids.includes(product.id) : false));
  const inCart = useCartStore((s) => (product ? s.items.some((i) => i.productId === product.id) : false));

  const actions: SheetAction[] = product
    ? [
        ...(product.stock === 0
          ? []
          : [
              {
                key: 'cart',
                label: inCart ? 'Add one more to cart' : 'Add to cart',
                icon: { ios: 'cart.badge.plus', android: 'add_shopping_cart' },
                tone: 'primary',
                onPress: () => {
                  useCartStore.getState().add(product);
                  haptics.success();
                },
              } satisfies SheetAction,
            ]),
        {
          key: 'wishlist',
          label: wishlisted ? 'Remove from wishlist' : 'Add to wishlist',
          icon: wishlisted ? { ios: 'heart.slash', android: 'heart_minus' } : { ios: 'heart', android: 'favorite_border' },
          onPress: () => {
            useWishlistStore.getState().toggle(product.id);
            if (!wishlisted) haptics.success();
          },
        },
        {
          key: 'share',
          label: 'Share',
          icon: { ios: 'square.and.arrow.up', android: 'share' },
          onPress: () => void shareProduct(product),
        },
        {
          key: 'view',
          label: 'View product',
          icon: { ios: 'arrow.up.right.square', android: 'open_in_new' },
          onPress: () => router.push({ pathname: '/product/[id]', params: { id: product.id } }),
        },
      ]
    : [];

  return (
    <ActionSheet
      visible={!!product}
      onClose={close}
      actions={actions}
      header={
        product && (
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={[styles.thumbWrap, { backgroundColor: colors.surfaceAlt }]}>
              <Image source={product.thumbnail} style={styles.thumb} contentFit="contain" accessible={false} />
            </View>
            <View style={styles.flex}>
              <ThemedText variant="subheading" numberOfLines={2}>
                {product.title}
              </ThemedText>
              <PriceTag price={product.price} mrp={product.mrp} />
            </View>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: Spacing.xs },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  thumbWrap: { width: 56, height: 56, borderRadius: Radius.md, overflow: 'hidden' },
  thumb: { flex: 1 },
});
