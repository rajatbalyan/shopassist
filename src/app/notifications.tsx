import { ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import type { IconName } from '@/components/icon';
import { ListRow } from '@/components/list-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const prefs = useSettingsStore((s) => s.notifications);
  const setPref = useSettingsStore((s) => s.setNotificationPref);

  return (
    <Screen edges={[]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText color="textSecondary">Choose what ShopAssist can notify you about. We never send marketing spam.</ThemedText>
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
                  onValueChange={(v) => setPref(p.key, v)}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={colors.surface}
                  accessibilityLabel={p.label}
                />
              }
            />
          ))}
        </View>
        <View style={styles.test}>
          <Button title="Send test notification" variant="secondary" disabled />
          <ThemedText variant="caption" color="textSecondary" style={styles.center}>
            Available after Prompt 3
          </ThemedText>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, gap: Spacing.lg },
  group: { borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  test: { gap: Spacing.sm },
  center: { textAlign: 'center' },
});
