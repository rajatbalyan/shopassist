import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Icon } from '@/components/icon';
import { Screen } from '@/components/screen';
import { Skeleton } from '@/components/skeleton';
import { StatusPill } from '@/components/status-pill';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate, formatPrice, shortOrderId } from '@/lib/format';
import * as haptics from '@/lib/haptics';
import { useOrders } from '@/lib/queries';
import type { Order } from '@/types';

const MAX_THUMBS = 4;

export default function OrdersScreen() {
  const { colors } = useTheme();
  const { data: orders, isPending, isError, refetch, isRefetching } = useOrders();

  const title = (
    <ThemedText variant="title" accessibilityRole="header" style={styles.title}>
      Orders
    </ThemedText>
  );

  if (isPending) {
    return (
      <Screen>
        <View style={styles.list}>
          {title}
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={132} radius={Radius.lg} />
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={isError ? [] : orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={title}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              haptics.tap();
              void refetch();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : (
            <EmptyState
              title="No orders yet"
              message="When you place an order, you can track it here."
              icon={{ ios: 'shippingbox', android: 'receipt_long' }}
              action={{ label: 'Start shopping', onPress: () => router.navigate('/') }}
            />
          )
        }
        renderItem={({ item }) => <OrderCard order={item} />}
      />
    </Screen>
  );
}

function OrderCard({ order }: { order: Order }) {
  const { colors } = useTheme();
  const itemCount = order.items.reduce((n, i) => n + i.qty, 0);
  const extra = order.items.length - MAX_THUMBS;

  return (
    <Animated.View entering={FadeIn}>
      <Pressable
        onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
        accessibilityRole="button"
        accessibilityLabel={`Order ${shortOrderId(order.id)}, ${order.status}, ${formatPrice(order.total)}, placed ${formatDate(order.createdAt)}`}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && { opacity: 0.85 },
        ]}>
        <View style={styles.cardTop}>
          <View style={styles.flex}>
            <ThemedText variant="subheading">Order {shortOrderId(order.id)}</ThemedText>
            <ThemedText variant="caption" color="textSecondary">
              Placed {formatDate(order.createdAt)}
            </ThemedText>
          </View>
          <StatusPill status={order.status} />
        </View>
        <View style={styles.thumbs}>
          {order.items.slice(0, MAX_THUMBS).map((item) =>
            item.thumbnail ? (
              <Image
                key={item.productId}
                source={item.thumbnail}
                style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]}
                contentFit="contain"
                accessible={false}
              />
            ) : (
              <View key={item.productId} style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.surfaceAlt }]}>
                <Icon name={{ ios: 'bag', android: 'shopping_bag' }} size={18} color={colors.textSecondary} />
              </View>
            ),
          )}
          {extra > 0 && (
            <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: colors.surfaceAlt }]}>
              <ThemedText variant="caption">+{extra}</ThemedText>
            </View>
          )}
        </View>
        <View style={styles.cardBottom}>
          <ThemedText color="textSecondary">
            {itemCount} item{itemCount === 1 ? '' : 's'}
          </ThemedText>
          <ThemedText variant="price">{formatPrice(order.total)}</ThemedText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { marginBottom: Spacing.xs },
  list: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  card: { padding: Spacing.lg, gap: Spacing.md, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  thumbs: { flexDirection: 'row', gap: Spacing.sm },
  thumb: { width: 52, height: 52, borderRadius: Radius.sm },
  thumbFallback: { alignItems: 'center', justifyContent: 'center' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
