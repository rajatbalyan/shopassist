import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Sticky action bar for the bottom of a screen. The bottom safe-area edge is measured
 * per view, so it clears the home indicator and (on iOS) a translucent tab bar.
 */
export function BottomBar({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.bar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
      <View style={styles.row}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: StyleSheet.hairlineWidth },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
});
