import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ErrorState } from '@/components/error-state';
import { Icon } from '@/components/icon';
import { PriceBreakdownCard } from '@/components/price-breakdown-card';
import { Screen } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { Skeleton } from '@/components/skeleton';
import { useSnackbar } from '@/components/snackbar';
import { StarRatingInput } from '@/components/star-rating-input';
import { STATUS_LABEL, StatusPill } from '@/components/status-pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError, isMockApi } from '@/lib/api';
import { formatDate, formatPrice, shortOrderId } from '@/lib/format';
import * as haptics from '@/lib/haptics';
import { scheduleOrderStatusDemo } from '@/lib/notifications';
import { useDemoSetOrderStatus, useOrder } from '@/lib/queries';
import { useOrdersStore } from '@/store/orders';
import type { Order, OrderItem, OrderStatus } from '@/types';

// Friendly "Something went wrong · Try again" screen instead of a red crash.
export { ErrorFallback as ErrorBoundary } from '@/components/error-fallback';

const STEPS: OrderStatus[] = ['placed', 'shipped', 'delivered'];

export default function OrderScreen() {
  const { id, placed, rate } = useLocalSearchParams<{ id: string; placed?: string; rate?: string }>();
  const { data: order, isPending, isError, error, refetch } = useOrder(id);

  let body;
  if (isError) {
    body =
      error instanceof ApiError && error.status === 404 ? (
        <ErrorState title="Order not found" message="We couldn't find this order on this device." />
      ) : (
        <ErrorState onRetry={refetch} />
      );
  } else if (isPending) {
    body = (
      <View style={styles.scroll}>
        <Skeleton height={140} radius={Radius.lg} />
        <Skeleton height={120} radius={Radius.lg} />
        <Skeleton height={160} radius={Radius.lg} />
      </View>
    );
  } else {
    body = <OrderDetails order={order} justPlaced={placed === '1'} openRating={rate === '1'} />;
  }

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: order ? `Order ${shortOrderId(order.id)}` : 'Order' }} />
      {body}
    </Screen>
  );
}

type OrderDetailsProps = { order: Order; justPlaced: boolean; /** From the "Rate product" notification action. */ openRating: boolean };

function OrderDetails({ order, justPlaced, openRating }: OrderDetailsProps) {
  const { colors } = useTheme();
  const ratings = useOrdersStore((s) => s.ratings);
  const rate = useOrdersStore((s) => s.rate);
  const demoStatus = useDemoSetOrderStatus();
  const { show, snackbar } = useSnackbar();
  const [rating, setRating] = useState<{ item: OrderItem; stars: number } | null>(() => {
    if (!openRating) return null;
    const item = order.items.find((i) => !ratings[i.productId]) ?? order.items[0];
    return item ? { item, stars: 0 } : null;
  });

  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);
  const nextStatus = order.status === 'placed' ? 'shipped' : order.status === 'shipped' ? 'delivered' : null;

  const submitRating = () => {
    if (!rating || rating.stars === 0) return;
    rate(rating.item.productId, rating.stars);
    haptics.success();
    setRating(null);
    show('Thanks for rating!');
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {justPlaced && (
          <Animated.View entering={FadeInDown} style={[styles.success, { backgroundColor: colors.surface, borderColor: colors.success }]}>
            <Icon name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={40} color={colors.success} />
            <ThemedText variant="title" accessibilityRole="header">
              Order placed!
            </ThemedText>
            <ThemedText color="textSecondary" style={styles.center}>
              Thanks for shopping with us. We&apos;ll notify you when it ships.
            </ThemedText>
          </Animated.View>
        )}

        <Card>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <ThemedText variant="subheading">Order {shortOrderId(order.id)}</ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                Placed {formatDate(order.createdAt)}
              </ThemedText>
            </View>
            <StatusPill status={order.status} />
          </View>
          <Timeline order={order} />
          {isMockApi && nextStatus && (
            <Button
              title={`Demo: mark as ${STATUS_LABEL[nextStatus].toLowerCase()}`}
              variant="ghost"
              loading={demoStatus.isPending}
              onPress={() =>
                demoStatus.mutate(
                  { id: order.id, status: nextStatus },
                  {
                    onSuccess: async (updated) => {
                      const scheduled = await scheduleOrderStatusDemo(updated, nextStatus);
                      if (scheduled) show('Order update notification in 5 seconds.');
                    },
                  },
                )
              }
            />
          )}
        </Card>

        <Card>
          <ThemedText variant="subheading" accessibilityRole="header">
            Items
          </ThemedText>
          {order.items.map((item) => {
            const myRating = ratings[item.productId];
            return (
              <View key={item.productId} style={styles.item}>
                <View style={styles.itemRow}>
                  {item.thumbnail ? (
                    <Image source={item.thumbnail} style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]} contentFit="contain" accessible={false} />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]} />
                  )}
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={2}>{item.title}</ThemedText>
                    <ThemedText variant="caption" color="textSecondary">
                      Qty {item.qty} × {formatPrice(item.price)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.itemTotal}>{formatPrice(item.price * item.qty)}</ThemedText>
                </View>
                {myRating ? (
                  <ThemedText variant="caption" color="success" style={styles.rated}>
                    You rated this {myRating}★ · Thanks for rating
                  </ThemedText>
                ) : (
                  <Button
                    title="Rate product"
                    variant="secondary"
                    onPress={() => setRating({ item, stars: 0 })}
                    style={styles.rateButton}
                  />
                )}
              </View>
            );
          })}
        </Card>

        <PriceBreakdownCard breakdown={order} itemCount={itemCount} title="Payment summary" />

        <Card>
          <View style={styles.titleRow}>
            <Icon name={{ ios: 'mappin.and.ellipse', android: 'location_on' }} size={18} color={colors.primary} />
            <ThemedText variant="subheading" accessibilityRole="header">
              Delivery address
            </ThemedText>
          </View>
          <View>
            <ThemedText>{order.address.name}</ThemedText>
            <ThemedText color="textSecondary">{order.address.line1}</ThemedText>
            <ThemedText color="textSecondary">
              {order.address.city} – {order.address.pincode}
            </ThemedText>
            <ThemedText color="textSecondary">+91 {order.address.phone}</ThemedText>
          </View>
        </Card>
      </ScrollView>
      {snackbar}

      <Sheet
        visible={!!rating}
        onClose={() => setRating(null)}
        title="Rate product"
        footer={<Button title="Submit rating" onPress={submitRating} disabled={!rating?.stars} style={styles.flex} />}>
        {rating && (
          <View style={styles.rateBody}>
            <ThemedText numberOfLines={2} style={styles.center}>
              {rating.item.title}
            </ThemedText>
            <StarRatingInput value={rating.stars} onChange={(stars) => setRating({ ...rating, stars })} />
          </View>
        )}
      </Sheet>
    </View>
  );
}

function Timeline({ order }: { order: Order }) {
  const { colors } = useTheme();
  const reached = STEPS.indexOf(order.status);
  const dateFor = (status: OrderStatus) =>
    order.history?.find((h) => h.status === status)?.at ?? (status === 'placed' ? order.createdAt : undefined);

  return (
    <View accessibilityRole="list" style={styles.timeline}>
      {STEPS.map((status, i) => {
        const done = i <= reached;
        const date = dateFor(status);
        const last = i === STEPS.length - 1;
        return (
          <View
            key={status}
            style={styles.step}
            accessible
            accessibilityLabel={`${STATUS_LABEL[status]}, ${done ? `done${date ? `, ${formatDate(date)}` : ''}` : 'pending'}`}>
            <View style={styles.rail}>
              <Animated.View
                entering={FadeIn}
                style={[styles.dot, { backgroundColor: done ? colors.success : colors.surface, borderColor: done ? colors.success : colors.border }]}>
                {done && <Icon name={{ ios: 'checkmark', android: 'check' }} size={12} color="#FFFFFF" />}
              </Animated.View>
              {!last && <View style={[styles.line, { backgroundColor: i < reached ? colors.success : colors.border }]} />}
            </View>
            <View style={styles.stepText}>
              <ThemedText variant="subheading" color={done ? 'text' : 'textSecondary'}>
                {STATUS_LABEL[status]}
              </ThemedText>
              <ThemedText variant="caption" color="textSecondary">
                {done && date ? formatDate(date) : done ? 'Done' : 'Pending'}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.xxl },
  success: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  timeline: { paddingTop: Spacing.xs },
  step: { flexDirection: 'row', gap: Spacing.md },
  rail: { alignItems: 'center', width: 24 },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { width: 2, flex: 1, minHeight: 24 },
  stepText: { paddingBottom: Spacing.lg, gap: 2 },
  item: { gap: Spacing.sm },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  thumb: { width: 52, height: 52, borderRadius: Radius.sm },
  itemTotal: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  rated: { marginLeft: 52 + Spacing.md },
  rateButton: { alignSelf: 'flex-start', marginLeft: 52 + Spacing.md },
  rateBody: { gap: Spacing.lg, paddingVertical: Spacing.md },
});
