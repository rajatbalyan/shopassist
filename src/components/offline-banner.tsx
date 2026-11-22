import { useNetInfo } from '@react-native-community/netinfo';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Shows a slim banner while the device has no network connection. */
export function OfflineBanner() {
  const { isConnected } = useNetInfo();
  const { colors } = useTheme();
  // `null` means "unknown yet": don't flash the banner on launch.
  if (isConnected !== false) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.warning }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite">
      <Icon name={{ ios: 'wifi.slash', android: 'wifi_off' }} size={16} color={colors.background} />
      <ThemedText variant="caption" style={{ color: colors.background }}>
        You&apos;re offline. Showing saved data.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
});
