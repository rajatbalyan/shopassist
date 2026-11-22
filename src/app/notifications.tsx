import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Icon, type IconName } from '@/components/icon';
import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { useSnackbar } from '@/components/snackbar';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as haptics from '@/lib/haptics';
import { ensureNotificationPermission, isExpoGo, openNotificationSettings, sendTestNotification } from '@/lib/notifications';
import { useSettingsStore, type NotificationPrefs } from '@/store/settings';

const PREFS: { key: keyof NotificationPrefs; label: string; caption: string; icon: IconName }[] = [
  {
    key: 'orderUpdates',
    label: 'Order updates',
    caption: 'Shipping and delivery updates, with Track order and Rate product actions.',
    icon: { ios: 'shippingbox', android: 'local_shipping' },
  },
  {
    key: 'cartReminders',
    label: 'Cart reminders',
    caption: 'One gentle reminder if you leave items in your cart.',
    icon: { ios: 'cart', android: 'shopping_cart' },
  },
  {
    key: 'priceAlerts',
    label: 'Price alerts',
    caption: 'Price drops and back-in-stock alerts for products you follow.',
    icon: { ios: 'tag', android: 'sell' },
  },
];

type PermissionStatus = 'granted' | 'ask' | 'blocked' | 'unknown';

/** System permission state, refreshed when the user comes back from Settings. */
function usePermissionStatus() {
  const [status, setStatus] = useState<PermissionStatus>('unknown');

  const refresh = useCallback(() => {
    if (Platform.OS === 'web') return;
    void Notifications.getPermissionsAsync().then((p) =>
      setStatus(p.granted ? 'granted' : p.status === 'denied' && !p.canAskAgain ? 'blocked' : 'ask'),
    );
  }, []);

  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  return { status, refresh };
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const prefs = useSettingsStore((s) => s.notifications);
  const setPref = useSettingsStore((s) => s.setNotificationPref);
  const { status, refresh } = usePermissionStatus();
  const { show, snackbar } = useSnackbar();
  const [sending, setSending] = useState(false);

  const ask = async () => {
    await ensureNotificationPermission('settings');
    refresh();
  };

  const onToggle = (key: keyof NotificationPrefs, value: boolean) => {
    setPref(key, value);
    haptics.tap();
    if (value) void ask();
  };

  const onTest = async () => {
    setSending(true);
    try {
      if (!(await ensureNotificationPermission('settings'))) {
        refresh();
        return;
      }
      await sendTestNotification();
      show('Test notification in 2 seconds.');
    } finally {
      setSending(false);
      refresh();
    }
  };

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText color="textSecondary">Choose what ShopAssist can notify you about. We never send marketing spam.</ThemedText>

        {(status === 'ask' || status === 'blocked') && (
          <Card style={styles.permission}>
            <View style={styles.permissionRow}>
              <Icon name={{ ios: 'bell.slash', android: 'notifications_off' }} size={22} color={colors.warning} />
              <View style={styles.flex}>
                <ThemedText variant="subheading">Notifications are off</ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  {status === 'blocked'
                    ? 'They are blocked for ShopAssist in your phone’s settings.'
                    : 'Allow them to get order updates and price drops.'}
                </ThemedText>
              </View>
            </View>
            <Button
              title={status === 'blocked' ? 'Turn on in Settings' : 'Turn on notifications'}
              variant="secondary"
              onPress={status === 'blocked' ? () => void openNotificationSettings() : () => void ask()}
            />
          </Card>
        )}

        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {PREFS.map((p) => (
            <ListRow
              key={p.key}
              icon={p.icon}
              label={p.label}
              caption={p.caption}
              right={
                <Switch
                  value={prefs[p.key]}
                  onValueChange={(v) => onToggle(p.key, v)}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.surface}
                  accessibilityLabel={p.label}
                />
              }
            />
          ))}
        </View>
        <View style={styles.test}>
          <Button
            title="Send test notification"
            variant="secondary"
            loading={sending}
            disabled={Platform.OS === 'web'}
            onPress={() => void onTest()}
          />
          {isExpoGo && (
            <ThemedText variant="caption" color="textSecondary" style={styles.center}>
              Running in Expo Go: notifications work, but action buttons and push need the development build.
            </ThemedText>
          )}
        </View>
      </ScrollView>
      {snackbar}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  permission: { gap: Spacing.md },
  permissionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  group: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  test: { gap: Spacing.sm },
  center: { textAlign: 'center' },
});
