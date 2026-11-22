import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Badge } from '@/components/badge';
import { BottomBar } from '@/components/bottom-bar';
import { Button } from '@/components/button';
import { BuyerInsightsCard } from '@/components/buyer-insights-card';
import { Card } from '@/components/card';
import { ErrorState } from '@/components/error-state';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { ImageCarousel } from '@/components/image-carousel';
import { PriceTag } from '@/components/price-tag';
import { ProductRow } from '@/components/product-row';
import { RatingStars } from '@/components/rating-stars';
import { ReviewItem } from '@/components/review-item';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { Skeleton } from '@/components/skeleton';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import * as haptics from '@/lib/haptics';
import { shareProduct } from '@/lib/links';
import { ensureNotificationPermission } from '@/lib/notifications';
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD, getPriceBreakdown } from '@/lib/pricing';
import { useInsights, useProduct, useSimilar } from '@/lib/queries';
import { useAlertOn, useAlertsStore } from '@/store/alerts';
import { useCartCount, useCartStore } from '@/store/cart';
import { useSettingsStore } from '@/store/settings';
import { useIsWishlisted, useWishlistStore } from '@/store/wishlist';
import type { AlertType, Insight, Product, Review } from '@/types';

const INITIAL_REVIEWS = 5;
const LOW_STOCK = 5;

type ReviewSort = 'recent' | 'critical';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isPending, isError, error, refetch } = useProduct(id);
  const cartCount = useCartCount();

  const headerRight = () => (
    <View style={styles.headerActions}>
      <IconButton
        icon={{ ios: 'square.and.arrow.up', android: 'share' }}
        accessibilityLabel="Share product"
        disabled={!product}
        onPress={() => product && void shareProduct(product)}
      />
      <IconButton
        icon={{ ios: 'cart', android: 'shopping_cart' }}
        accessibilityLabel={`Cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
        badge={cartCount}
        onPress={() => router.navigate('/cart')}
      />
    </View>
  );

  let body;
  if (isError) {
    const notFound = error instanceof ApiError && error.status === 404;
    body = notFound ? (
      <ErrorState title="Product not found" message="It may have been removed from the catalog." />
    ) : (
      <ErrorState onRetry={refetch} />
    );
  } else if (isPending) {
    body = <ProductSkeleton />;
  } else {
    body = <ProductDetails product={product} />;
  }

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: '', headerRight }} />
      {body}
    </Screen>
  );
}

function ProductDetails({ product }: { product: Product }) {
  const { colors } = useTheme();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  // Reviews are laid out inside the body, so their scroll offset is bodyY + reviewsY.
  const bodyY = useRef(0);
  const reviewsY = useRef(0);
  const { show, snackbar } = useSnackbar();

  const insights = useInsights(product.id);
  const similar = useSimilar(product.id);

  const deviceId = useSettingsStore((s) => s.deviceId);
  const addToCart = useCartStore((s) => s.add);
  const inCartQty = useCartStore((s) => s.items.find((i) => i.productId === product.id)?.qty ?? 0);
  const wishlisted = useIsWishlisted(product.id);
  const toggleWishlist = useWishlistStore((s) => s.toggle);
  const toggleAlert = useAlertsStore((s) => s.toggle);
  const priceAlertOn = useAlertOn(product.id, 'price_drop');
  const stockAlertOn = useAlertOn(product.id, 'back_in_stock');

  const [expanded, setExpanded] = useState(false);
  const [reviewSort, setReviewSort] = useState<ReviewSort>('recent');
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);

  const outOfStock = product.stock === 0;
  const { delivery } = getPriceBreakdown([{ price: product.price, qty: 1 }]);
  const returnPolicy = product.specs['Return policy'];
  const longDescription = product.description.length > 180;

  const scrollToReviews = () => scrollRef.current?.scrollTo({ y: Math.max(0, bodyY.current + reviewsY.current - Spacing.md), animated: true });

  const onAlert = (type: AlertType) => {
    const on = toggleAlert(product.id, type);
    haptics.tap();
    if (on) {
      void api.createAlert(deviceId, product.id, type).catch(() => {});
      // Alerts are delivered as notifications, so this is the moment to ask.
      void ensureNotificationPermission('alert');
    } else {
      void api.deleteAlert(deviceId, product.id, type).catch(() => {});
    }
    show(
      type === 'price_drop'
        ? on
          ? "We'll tell you if the price drops."
          : 'Price-drop alert turned off.'
        : on
          ? "We'll tell you when it's back in stock."
          : 'Back-in-stock alert turned off.',
    );
  };

  const onAddToCart = () => {
    if (inCartQty > 0) {
      router.navigate('/cart');
      return;
    }
    addToCart(product);
    haptics.success();
    show('Added to cart', { actionLabel: 'View cart', onAction: () => router.navigate('/cart') });
  };

  const onWishlist = () => {
    toggleWishlist(product.id);
    if (!wishlisted) haptics.success();
    show(wishlisted ? 'Removed from wishlist' : 'Saved to wishlist', {
      actionLabel: wishlisted ? undefined : 'View',
      onAction: () => router.push('/wishlist'),
    });
  };

  const onSelectInsight = (insight: Insight) => {
    haptics.tap();
    setSelectedInsight((cur) => (cur?.point === insight.point ? null : insight));
    setShowAllReviews(false);
    setTimeout(scrollToReviews, 50);
  };

  // Cited reviews float to the top while a buyer-insight point is selected.
  const cited = new Set(selectedInsight?.reviewIds ?? []);
  const sorted = [...product.reviews].sort((a, b) =>
    reviewSort === 'critical' ? a.rating - b.rating || b.date.localeCompare(a.date) : b.date.localeCompare(a.date),
  );
  const ordered: Review[] = selectedInsight ? [...sorted.filter((r) => cited.has(r.id)), ...sorted.filter((r) => !cited.has(r.id))] : sorted;
  const visibleCount = showAllReviews ? ordered.length : Math.max(INITIAL_REVIEWS, cited.size);
  const visibleReviews = ordered.slice(0, visibleCount);

  return (
    <>
      <View style={styles.flex}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
          <ImageCarousel images={product.images.length ? product.images : [product.thumbnail]} title={product.title} />

          <View style={styles.body} onLayout={(e) => (bodyY.current = e.nativeEvent.layout.y)}>
            <Animated.View entering={FadeIn} style={styles.info}>
              <View style={styles.brandRow}>
                <ThemedText variant="caption" color="primary" style={styles.brand}>
                  {product.brand.toUpperCase()}
                </ThemedText>
                {product.sponsored && <Badge label="Sponsored" tone="sponsored" />}
              </View>
              <ThemedText variant="heading" accessibilityRole="header">
                {product.title}
              </ThemedText>
              <Pressable
                onPress={scrollToReviews}
                accessibilityRole="button"
                accessibilityHint="Scrolls to reviews"
                style={styles.ratingTap}>
                <RatingStars rating={product.rating} count={product.reviewCount} variant="full" size={15} />
              </Pressable>
              <PriceTag price={product.price} mrp={product.mrp} size="lg" />
              <ThemedText variant="caption" color="textSecondary">
                Inclusive of all taxes
              </ThemedText>
            </Animated.View>

            <Card>
              <StockLine stock={product.stock} />
              {outOfStock && (
                <Button
                  title={stockAlertOn ? "We'll notify you" : "Notify me when it's back"}
                  variant={stockAlertOn ? 'ghost' : 'secondary'}
                  icon={<Icon name={{ ios: 'bell', android: 'notifications' }} size={18} color={colors.primary} />}
                  onPress={() => onAlert('back_in_stock')}
                />
              )}
              <InfoLine
                icon={{ ios: 'shippingbox', android: 'local_shipping' }}
                text={
                  delivery === 0
                    ? 'Free delivery'
                    : `${formatPrice(DELIVERY_FEE)} delivery · free above ${formatPrice(FREE_DELIVERY_THRESHOLD)}`
                }
              />
              {returnPolicy && <InfoLine icon={{ ios: 'arrow.uturn.left', android: 'undo' }} text={returnPolicy} />}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <View style={styles.alertRow}>
                <Icon name={{ ios: 'bell.badge', android: 'notifications_active' }} size={18} color={colors.primary} />
                <View style={styles.flex}>
                  <ThemedText>Tell me if the price drops</ThemedText>
                  <ThemedText variant="caption" color="textSecondary">
                    We&apos;ll send a notification
                  </ThemedText>
                </View>
                <Switch
                  value={priceAlertOn}
                  onValueChange={() => onAlert('price_drop')}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.surface}
                  accessibilityLabel="Tell me if the price drops"
                />
              </View>
            </Card>

            <View style={styles.section}>
              <ThemedText variant="subheading" accessibilityRole="header">
                Description
              </ThemedText>
              <ThemedText numberOfLines={expanded ? undefined : 4}>{product.description}</ThemedText>
              {longDescription && (
                <Pressable onPress={() => setExpanded((e) => !e)} accessibilityRole="button" style={styles.textButton}>
                  <ThemedText variant="subheading" color="primary">
                    {expanded ? 'Show less' : 'Read more'}
                  </ThemedText>
                </Pressable>
              )}
            </View>

            {Object.keys(product.specs).length > 0 && (
              <View style={styles.section}>
                <ThemedText variant="subheading" accessibilityRole="header">
                  Specifications
                </ThemedText>
                <View style={[styles.specs, { borderColor: colors.border }]}>
                  {Object.entries(product.specs).map(([key, value], i) => (
                    <View
                      key={key}
                      style={[styles.specRow, { backgroundColor: i % 2 ? colors.surface : colors.surfaceAlt }]}
                      accessible
                      accessibilityLabel={`${key}: ${value}`}>
                      <ThemedText variant="caption" color="textSecondary" style={styles.specKey}>
                        {key}
                      </ThemedText>
                      <ThemedText style={styles.specValue}>{value}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <BuyerInsightsCard
              insights={insights.data}
              isPending={insights.isPending}
              isError={insights.isError}
              onRetry={() => void insights.refetch()}
              onSelect={onSelectInsight}
              selectedPoint={selectedInsight?.point}
            />

            <View style={styles.section} onLayout={(e) => (reviewsY.current = e.nativeEvent.layout.y)}>
              <SectionHeader title="Reviews" subtitle={`${product.reviewCount} verified reviews`} />
              <SegmentedControl
                accessibilityLabel="Sort reviews"
                options={[
                  { value: 'recent', label: 'Most recent' },
                  { value: 'critical', label: 'Most critical' },
                ]}
                value={reviewSort}
                onChange={setReviewSort}
              />
              {selectedInsight && (
                <Animated.View entering={FadeIn} style={[styles.citedBanner, { backgroundColor: colors.primarySoft }]}>
                  <ThemedText variant="caption" style={[styles.flex, { color: colors.primary }]}>
                    {cited.size} review{cited.size === 1 ? '' : 's'} mention &quot;{selectedInsight.point}&quot;
                  </ThemedText>
                  <Pressable
                    onPress={() => setSelectedInsight(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Clear highlighted reviews"
                    style={styles.textButton}>
                    <ThemedText variant="subheading" color="primary">
                      Clear
                    </ThemedText>
                  </Pressable>
                </Animated.View>
              )}
              {visibleReviews.map((r) => (
                <ReviewItem key={r.id} review={r} highlighted={cited.has(r.id)} />
              ))}
              {ordered.length > visibleCount && (
                <Button
                  title={`Show all ${ordered.length} reviews`}
                  variant="ghost"
                  onPress={() => setShowAllReviews(true)}
                />
              )}
            </View>

            {(similar.isPending || !!similar.data?.length) && (
              <View style={styles.section}>
                <SectionHeader title="Similar products" />
                <View style={styles.bleed}>
                  <ProductRow products={similar.data} loading={similar.isPending} />
                </View>
              </View>
            )}
          </View>
        </ScrollView>
        {snackbar}
      </View>

      <BottomBar>
        <IconButton
          icon={wishlisted ? { ios: 'heart.fill', android: 'favorite' } : { ios: 'heart', android: 'favorite_border' }}
          color={wishlisted ? colors.danger : colors.text}
          filled
          accessibilityLabel={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          accessibilityState={{ selected: wishlisted }}
          onPress={onWishlist}
        />
        <Button
          title="Ask AI"
          variant="secondary"
          icon={<Icon name={{ ios: 'sparkles', android: 'auto_awesome' }} size={16} color={colors.primary} />}
          onPress={() => router.push({ pathname: '/product/[id]/ask', params: { id: product.id } })}
          style={styles.askButton}
        />
        <Button
          title={outOfStock ? 'Out of stock' : inCartQty > 0 ? `Go to cart · ${inCartQty}` : 'Add to cart'}
          disabled={outOfStock}
          onPress={onAddToCart}
          style={styles.flex}
        />
      </BottomBar>
    </>
  );
}

function StockLine({ stock }: { stock: number }) {
  const { colors } = useTheme();
  const [label, color] =
    stock === 0
      ? ['Out of stock', colors.danger]
      : stock <= LOW_STOCK
        ? [`Only ${stock} left`, colors.warning]
        : ['In stock', colors.success];
  return (
    <View style={styles.infoLine}>
      <View style={[styles.stockDot, { backgroundColor: color }]} />
      <ThemedText variant="subheading" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

function InfoLine({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.infoLine}>
      <Icon name={icon} size={18} color={colors.textSecondary} />
      <ThemedText style={styles.flex}>{text}</ThemedText>
    </View>
  );
}

function ProductSkeleton() {
  return (
    <View>
      <Skeleton height={320} radius={0} />
      <View style={styles.body}>
        <Skeleton height={12} width="30%" />
        <Skeleton height={22} width="85%" />
        <Skeleton height={16} width="40%" />
        <Skeleton height={28} width="50%" />
        <Skeleton height={120} radius={Radius.lg} />
        <Skeleton height={80} radius={Radius.lg} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingBottom: Spacing.xxl },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  body: { padding: Spacing.lg, gap: Spacing.xl },
  info: { gap: Spacing.sm },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontWeight: '700', letterSpacing: 1 },
  ratingTap: { alignSelf: 'flex-start', minHeight: TouchTarget - 12, justifyContent: 'center' },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stockDot: { width: 10, height: 10, borderRadius: 5, marginHorizontal: 4 },
  divider: { height: StyleSheet.hairlineWidth },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  section: { gap: Spacing.md },
  textButton: { minHeight: TouchTarget, justifyContent: 'center', alignSelf: 'flex-start' },
  specs: { borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.md, overflow: 'hidden' },
  specRow: { flexDirection: 'row', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  specKey: { width: '38%', paddingTop: 3 },
  specValue: { flex: 1 },
  citedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.sm,
    borderRadius: Radius.md,
  },
  bleed: { marginHorizontal: -Spacing.lg },
  askButton: { paddingHorizontal: Spacing.md },
});
