import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { BottomBar } from '@/components/bottom-bar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PriceBreakdownCard } from '@/components/price-breakdown-card';
import { ProductRow } from '@/components/product-row';
import { ProgressBar } from '@/components/progress-bar';
import { QuantityStepper } from '@/components/quantity-stepper';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPrice } from '@/lib/format';
import * as haptics from '@/lib/haptics';
import { FREE_DELIVERY_THRESHOLD, getPriceBreakdown } from '@/lib/pricing';
import { useProductsByIds } from '@/lib/queries';
import { useCartLines, useCartStore, type CartLine } from '@/store/cart';
import { useWishlistStore } from '@/store/wishlist';

const MAX_QTY = 10;
const DELETE_WIDTH = 88;
/** Dragging past this releases into a delete instead of just revealing the button. */
const FULL_SWIPE = 200;

export default function CartScreen() {
  const { colors } = useTheme();
  const lines = useCartLines();
  const setQty = useCartStore((s) => s.setQty);
  const remove = useCartStore((s) => s.remove);
  const undoRemove = useCartStore((s) => s.undoRemove);
  const wishlistIds = useWishlistStore((s) => s.ids);
  const { show, snackbar } = useSnackbar();

  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const breakdown = getPriceBreakdown(lines.map((l) => ({ price: l.product.price, qty: l.qty })));
  const suggestionIds = wishlistIds.filter((id) => !lines.some((l) => l.productId === id)).slice(0, 10);
  const suggestions = useProductsByIds(suggestionIds);

  const onRemove = (line: CartLine) => {
    remove(line.productId);
    haptics.warning();
    show(`Removed ${line.product.title}`, { actionLabel: 'Undo', onAction: undoRemove });
  };

  const wishlistRow =
    suggestionIds.length > 0 ? (
      <View style={styles.suggestions}>
        <SectionHeader title="From your wishlist" />
        <View style={styles.bleed}>
          <ProductRow products={suggestions.products} loading={suggestions.isPending} />
        </View>
      </View>
    ) : null;

  if (lines.length === 0) {
    return (
      <Screen>
        <View style={styles.flex}>
          <Animated.ScrollView contentContainerStyle={styles.emptyScroll}>
            <EmptyState
              title="Your cart is empty"
              message="Browse popular picks and add something you like."
              icon={{ ios: 'cart', android: 'shopping_cart' }}
              action={{ label: 'Start shopping', onPress: () => router.navigate('/') }}
            />
            {wishlistRow}
          </Animated.ScrollView>
          {snackbar}
        </View>
      </Screen>
    );
  }

  const progress = 1 - breakdown.freeDeliveryRemaining / FREE_DELIVERY_THRESHOLD;

  return (
    <Screen>
      <View style={styles.flex}>
        <Animated.FlatList
          data={lines}
          keyExtractor={(l) => l.productId}
          itemLayoutAnimation={LinearTransition}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.headerBlock}>
              <ThemedText variant="title" accessibilityRole="header">
                Cart
                <ThemedText variant="heading" color="textSecondary">
                  {' '}
                  ({itemCount})
                </ThemedText>
              </ThemedText>
              <Card style={styles.deliveryCard}>
                <View style={styles.deliveryRow}>
                  <Icon
                    name={{ ios: 'shippingbox.fill', android: 'local_shipping' }}
                    size={18}
                    color={breakdown.freeDeliveryRemaining ? colors.primary : colors.success}
                  />
                  <ThemedText style={styles.flex}>
                    {breakdown.freeDeliveryRemaining > 0 ? (
                      <>
                        Add <ThemedText variant="subheading">{formatPrice(breakdown.freeDeliveryRemaining)}</ThemedText> more
                        for free delivery
                      </>
                    ) : (
                      <ThemedText variant="subheading" color="success">
                        You&apos;ve unlocked free delivery
                      </ThemedText>
                    )}
                  </ThemedText>
                </View>
                <ProgressBar progress={progress} color={breakdown.freeDeliveryRemaining ? colors.primary : colors.success} />
              </Card>
            </View>
          }
          renderItem={({ item }) => (
            <Animated.View entering={FadeIn} exiting={FadeOut.duration(180)}>
              <CartRow line={item} onQty={(q) => setQty(item.productId, q)} onRemove={() => onRemove(item)} />
            </Animated.View>
          )}
          ListFooterComponent={
            <View style={styles.footer}>
              <PriceBreakdownCard breakdown={breakdown} itemCount={itemCount} />
              {wishlistRow}
            </View>
          }
        />
        {snackbar}
      </View>
      <BottomBar>
        <View style={styles.flex}>
          <ThemedText variant="caption" color="textSecondary">
            Total
          </ThemedText>
          <ThemedText variant="price">{formatPrice(breakdown.total)}</ThemedText>
        </View>
        <Button title="Checkout" onPress={() => router.push('/checkout')} style={styles.checkout} />
      </BottomBar>
    </Screen>
  );
}

type CartRowProps = { line: CartLine; onQty: (qty: number) => void; onRemove: () => void };

function CartRow({ line, onQty, onRemove }: CartRowProps) {
  const { colors } = useTheme();
  const { product, qty } = line;
  const max = Math.max(1, Math.min(product.stock || MAX_QTY, MAX_QTY));
  // Set on the UI thread while dragging; read on release to tell a full swipe from a reveal.
  const armed = useSharedValue(false);

  return (
    <ReanimatedSwipeable
      friction={1.4}
      rightThreshold={DELETE_WIDTH / 2}
      overshootRight
      containerStyle={styles.swipeContainer}
      renderRightActions={(_progress, translation) => (
        <DeleteAction translation={translation} armed={armed} title={product.title} onPress={onRemove} />
      )}
      onSwipeableWillOpen={() => {
        if (armed.get()) onRemove();
      }}>
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          onPress={() => router.push({ pathname: '/product/[id]', params: { id: product.id } })}
          accessibilityRole="button"
          accessibilityLabel={`Open ${product.title}`}
          style={[styles.thumbWrap, { backgroundColor: colors.surfaceAlt }]}>
          <Image source={product.thumbnail} style={styles.thumb} contentFit="contain" accessibilityLabel={product.title} />
        </Pressable>
        <View style={styles.rowBody}>
          <View style={styles.rowTop}>
            <ThemedText numberOfLines={2} style={styles.flex}>
              {product.title}
            </ThemedText>
            <IconButton
              icon={{ ios: 'trash', android: 'delete' }}
              size={18}
              color={colors.textSecondary}
              accessibilityLabel={`Remove ${product.title} from cart`}
              onPress={onRemove}
            />
          </View>
          <ThemedText variant="caption" color="textSecondary">
            {formatPrice(product.price)} each
          </ThemedText>
          <View style={styles.rowBottom}>
            <QuantityStepper value={qty} max={max} onChange={onQty} itemName={product.title} />
            <ThemedText variant="price">{formatPrice(product.price * qty)}</ThemedText>
          </View>
        </View>
      </View>
    </ReanimatedSwipeable>
  );
}

type DeleteActionProps = {
  translation: SharedValue<number>;
  armed: SharedValue<boolean>;
  title: string;
  onPress: () => void;
};

/** Red action behind a cart row; its background stretches with the drag. */
function DeleteAction({ translation, armed, title, onPress }: DeleteActionProps) {
  const { colors } = useTheme();

  useAnimatedReaction(
    () => translation.get() < -FULL_SWIPE,
    (isArmed, wasArmed) => {
      if (isArmed === wasArmed) return;
      armed.set(isArmed);
      if (isArmed) scheduleOnRN(haptics.tap);
    },
  );

  const fill = useAnimatedStyle(() => ({ width: Math.max(DELETE_WIDTH, -translation.get()) }));

  return (
    <View style={styles.deleteSlot}>
      <Animated.View style={[styles.deleteFill, { backgroundColor: colors.danger }, fill]} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Delete ${title}`}
        style={styles.deleteButton}>
        <Icon name={{ ios: 'trash.fill', android: 'delete' }} size={22} color="#FFFFFF" />
        <ThemedText variant="caption" style={styles.deleteText}>
          Delete
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: Spacing.lg, gap: Spacing.md },
  emptyScroll: { flexGrow: 1, paddingBottom: Spacing.xl },
  headerBlock: { gap: Spacing.md },
  deliveryCard: { gap: Spacing.sm, padding: Spacing.md },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  swipeContainer: { borderRadius: Radius.lg },
  deleteSlot: { width: DELETE_WIDTH, marginLeft: Spacing.sm },
  deleteFill: { position: 'absolute', top: 0, bottom: 0, right: 0, borderRadius: Radius.lg },
  deleteButton: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.xxs },
  deleteText: { color: '#FFFFFF', fontWeight: '700' },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbWrap: { width: 84, height: 84, borderRadius: Radius.md, overflow: 'hidden' },
  thumb: { flex: 1 },
  rowBody: { flex: 1, gap: Spacing.xs },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xs, marginRight: -Spacing.sm, marginTop: -Spacing.xs },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, flexWrap: 'wrap' },
  footer: { gap: Spacing.xl, marginTop: Spacing.sm },
  suggestions: { gap: Spacing.md },
  bleed: { marginHorizontal: -Spacing.lg },
  checkout: { paddingHorizontal: Spacing.xxl },
});
