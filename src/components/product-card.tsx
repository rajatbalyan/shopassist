import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Badge } from '@/components/badge';
import { IconButton } from '@/components/icon-button';
import { PriceTag } from '@/components/price-tag';
import { RatingStars } from '@/components/rating-stars';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as haptics from '@/lib/haptics';
import { useUiStore } from '@/store/ui';
import { useIsWishlisted, useWishlistStore } from '@/store/wishlist';
import type { Product } from '@/types';

type ProductCardProps = {
  product: Product;
  onPress?: (product: Product) => void;
  /** Defaults to opening the quick-action sheet. */
  onLongPress?: (product: Product) => void;
  style?: StyleProp<ViewStyle>;
};

export function ProductCard({ product, onPress, onLongPress, style }: ProductCardProps) {
  const { colors } = useTheme();
  const wishlisted = useIsWishlisted(product.id);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const openQuickActions = useUiStore((s) => s.openQuickActions);
  const outOfStock = product.stock === 0;
  const scale = useSharedValue(1);
  const scaleStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const open = () =>
    onPress ? onPress(product) : router.push({ pathname: '/product/[id]', params: { id: product.id } });

  const longPress = () => {
    haptics.longPress();
    scale.set(withSpring(1, { damping: 14, stiffness: 260 }));
    (onLongPress ?? openQuickActions)(product);
  };

  return (
    <Pressable
      onPress={open}
      onLongPress={longPress}
      delayLongPress={350}
      onPressIn={() => scale.set(withTiming(0.97, { duration: 120 }))}
      onPressOut={() => scale.set(withSpring(1, { damping: 14, stiffness: 260 }))}
      accessibilityRole="button"
      accessibilityLabel={`${product.sponsored ? 'Sponsored. ' : ''}${product.title}${outOfStock ? ', out of stock' : ''}`}
      accessibilityHint="Opens product details. Long press for quick actions."
      accessibilityActions={[{ name: 'longpress', label: 'Quick actions' }]}
      onAccessibilityAction={(e) => e.nativeEvent.actionName === 'longpress' && longPress()}
      style={style}>
      <Animated.View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, scaleStyle]}>
        <View style={[styles.imageWrap, { backgroundColor: colors.surfaceAlt }]}>
          <Image
            source={product.thumbnail}
            style={[styles.image, outOfStock && styles.dimmed]}
            contentFit="contain"
            transition={200}
            recyclingKey={product.id}
            accessibilityLabel={product.title}
          />
          {outOfStock && (
            <View style={[styles.oosBand, { backgroundColor: colors.overlay }]}>
              <ThemedText variant="caption" style={styles.oosText}>
                Out of stock
              </ThemedText>
            </View>
          )}
          {product.sponsored && <Badge label="Sponsored" tone="sponsored" style={styles.sponsored} />}
          <IconButton
            icon={
              wishlisted
                ? { ios: 'heart.fill', android: 'favorite' }
                : { ios: 'heart', android: 'favorite_border' }
            }
            size={18}
            color={wishlisted ? colors.danger : colors.textSecondary}
            filled
            accessibilityLabel={wishlisted ? `Remove ${product.title} from wishlist` : `Add ${product.title} to wishlist`}
            accessibilityState={{ selected: wishlisted }}
            onPress={() => {
              toggleWishlist(product.id);
              if (!wishlisted) haptics.success();
            }}
            style={styles.heart}
          />
        </View>
        <View style={styles.body}>
          <ThemedText variant="body" numberOfLines={2} style={styles.title}>
            {product.title}
          </ThemedText>
          <RatingStars rating={product.rating} count={product.reviewCount} />
          <PriceTag price={product.price} mrp={product.mrp} />
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  imageWrap: { aspectRatio: 1 },
  image: { flex: 1 },
  dimmed: { opacity: 0.45 },
  oosBand: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingVertical: Spacing.xs, alignItems: 'center' },
  oosText: { color: '#FFFFFF', fontWeight: '700' },
  sponsored: { position: 'absolute', top: Spacing.sm, left: Spacing.sm },
  heart: { position: 'absolute', top: Spacing.xs, right: Spacing.xs, width: 36, height: 36 },
  body: { padding: Spacing.md, gap: Spacing.xs },
  title: { fontSize: 14, lineHeight: 19, minHeight: 38 },
});
