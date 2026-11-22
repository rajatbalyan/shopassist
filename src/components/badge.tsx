import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'sponsored';

type BadgeProps = { label: string; tone?: BadgeTone; style?: StyleProp<ViewStyle> };

export function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  const { colors } = useTheme();
  const { bg, fg } = {
    neutral: { bg: colors.surfaceAlt, fg: colors.textSecondary },
    primary: { bg: colors.primarySoft, fg: colors.primary },
    success: { bg: colors.surfaceAlt, fg: colors.success },
    warning: { bg: colors.surfaceAlt, fg: colors.warning },
    danger: { bg: colors.surfaceAlt, fg: colors.danger },
    sponsored: { bg: colors.sponsoredBg, fg: colors.sponsoredText },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      <ThemedText variant="caption" style={[styles.text, { color: fg }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
    borderRadius: Radius.sm,
  },
  text: { fontWeight: '700' },
});
