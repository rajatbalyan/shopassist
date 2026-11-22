import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Card } from '@/components/card';
import { IconButton } from '@/components/icon-button';
import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isMockApi, mockDropPrice } from '@/lib/api';
import * as haptics from '@/lib/haptics';
import { ensureNotificationPermission, schedulePriceDropDemo } from '@/lib/notifications';
import { queryClient, queryKeys, useOrders } from '@/lib/queries';
import { useAlertsStore } from '@/store/alerts';
import { useSettingsStore, type ThemePreference } from '@/store/settings';
import { useWishlistStore } from '@/store/wishlist';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export default function ProfileScreen() {
  const { colors } = useTheme();
  const name = useSettingsStore((s) => s.name);
  const setName = useSettingsStore((s) => s.setName);
  const themePreference = useSettingsStore((s) => s.themePreference);
  const setThemePreference = useSettingsStore((s) => s.setThemePreference);
  const demoMode = useSettingsStore((s) => s.demoMode);
  const setDemoMode = useSettingsStore((s) => s.setDemoMode);
  const wishlistCount = useWishlistStore((s) => s.ids.length);
  const { data: orders } = useOrders();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [dropping, setDropping] = useState(false);
  const { show, snackbar } = useSnackbar();

  const saveName = () => {
    setName(draft);
    setEditing(false);
    haptics.success();
  };

  const initial = name.trim().charAt(0).toUpperCase();

  // Demo: a product with a price alert on (else the first wishlist item) gets 10% cheaper,
  // and the "price drop" notification the backend will send arrives 5 s later.
  const simulatePriceDrop = async () => {
    const alerts = useAlertsStore.getState().subscriptions;
    const id =
      Object.keys(alerts).find((pid) => alerts[pid]?.includes('price_drop')) ?? useWishlistStore.getState().ids[0];
    if (!id) {
      show('Turn on a price alert or save a product to your wishlist first.');
      return;
    }
    if (!useSettingsStore.getState().notifications.priceAlerts) {
      show('Price alerts are off in Notification settings.', {
        actionLabel: 'Settings',
        onAction: () => router.push('/notifications'),
      });
      return;
    }
    setDropping(true);
    try {
      if (!(await ensureNotificationPermission('settings'))) {
        show('Notifications are off, so the alert can’t be shown.');
        return;
      }
      const { product, oldPrice } = mockDropPrice(id);
      await queryClient.invalidateQueries({ queryKey: queryKeys.product(id) });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      await schedulePriceDropDemo(product, oldPrice);
      haptics.success();
      show(`${product.title} dropped to a lower price. Notification in 5 seconds.`);
    } finally {
      setDropping(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText variant="title" accessibilityRole="header">
          Profile
        </ThemedText>

        <Card style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]} accessible={false}>
            <ThemedText variant="title" style={{ color: colors.primaryText }}>
              {initial || '🙂'}
            </ThemedText>
          </View>
          <View style={styles.flex}>
            {editing ? (
              <TextInput
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={saveName}
                onBlur={saveName}
                autoFocus
                maxLength={30}
                returnKeyType="done"
                placeholder="Your name"
                placeholderTextColor={colors.textSecondary}
                accessibilityLabel="Your name"
                style={[Typography.heading, styles.nameInput, { color: colors.text, borderColor: colors.primary }]}
              />
            ) : (
              <>
                <ThemedText variant="heading" numberOfLines={1}>
                  {name || 'Add your name'}
                </ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  Used to greet you on Home
                </ThemedText>
              </>
            )}
          </View>
          <IconButton
            icon={editing ? { ios: 'checkmark', android: 'check' } : { ios: 'pencil', android: 'edit' }}
            accessibilityLabel={editing ? 'Save name' : 'Edit name'}
            onPress={() => {
              if (editing) saveName();
              else {
                setDraft(name);
                setEditing(true);
              }
            }}
          />
        </Card>

        <Group title="Shopping">
          <ListRow
            icon={{ ios: 'heart', android: 'favorite_border' }}
            label="Wishlist"
            value={String(wishlistCount)}
            onPress={() => router.push('/wishlist')}
          />
          <ListRow
            icon={{ ios: 'shippingbox', android: 'receipt_long' }}
            label="Orders"
            value={orders ? String(orders.length) : undefined}
            onPress={() => router.navigate('/orders')}
          />
          <ListRow
            icon={{ ios: 'bell', android: 'notifications' }}
            label="Notification settings"
            onPress={() => router.push('/notifications')}
          />
        </Group>

        <Group title="Appearance">
          <View style={styles.padded}>
            <SegmentedControl
              accessibilityLabel="Theme"
              options={THEMES}
              value={themePreference}
              onChange={setThemePreference}
            />
          </View>
        </Group>

        <Group title="Demo tools">
          <ListRow
            icon={{ ios: 'timer', android: 'timer' }}
            label="Demo mode"
            caption="Shortens timers so features can be shown live, e.g. the cart reminder fires after 10 seconds instead of 2 hours."
            right={
              <Switch
                value={demoMode}
                onValueChange={setDemoMode}
                trackColor={{ true: colors.primary, false: colors.border }}
                thumbColor={colors.surface}
                accessibilityLabel="Demo mode"
              />
            }
          />
          {isMockApi && (
            <ListRow
              icon={{ ios: 'tag', android: 'sell' }}
              label={dropping ? 'Simulating…' : 'Simulate price drop'}
              caption="Drops a followed or wishlisted product by 10% and sends a price-alert notification 5 s later."
              onPress={dropping ? undefined : () => void simulatePriceDrop()}
            />
          )}
        </Group>

        <Group title="About">
          <ListRow label="Version" value={Constants.expoConfig?.version ?? '1.0.0'} />
          <ListRow label="Built with" value="Expo + React Native" />
          <ListRow label="Product data" value="DummyJSON demo data" />
          <ListRow label="Data source" value={isMockApi ? 'Local mock' : 'Cloud API'} />
        </Group>
      </ScrollView>
      {snackbar}
    </Screen>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <ThemedText variant="caption" color="textSecondary" style={styles.groupTitle} accessibilityRole="header">
        {title.toUpperCase()}
      </ThemedText>
      <View style={[styles.groupBody, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: Spacing.xxxl },
  identity: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  nameInput: { borderBottomWidth: 2, paddingVertical: Spacing.xs, minHeight: TouchTarget },
  group: { gap: Spacing.sm },
  groupTitle: { fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: Spacing.xs },
  groupBody: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  padded: { padding: Spacing.md },
});
