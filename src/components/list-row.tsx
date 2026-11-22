import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ListRowProps = {
  label: string;
  icon?: IconName;
  value?: string;
  caption?: string;
  /** Replaces the chevron (e.g. a Switch). */
  right?: ReactNode;
  onPress?: () => void;
};

/** Settings-style row: icon, label, optional value and chevron. */
export function ListRow({ label, icon, value, caption, right, onPress }: ListRowProps) {
  const { colors } = useTheme();
  const content = (
    <>
      {icon && (
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name={icon} size={18} color={colors.primary} />
        </View>
      )}
      <View style={styles.text}>
        <ThemedText>{label}</ThemedText>
        {caption && (
          <ThemedText variant="caption" color="textSecondary">
            {caption}
          </ThemedText>
        )}
      </View>
      {value && (
        <ThemedText color="textSecondary" numberOfLines={1} style={styles.value}>
          {value}
        </ThemedText>
      )}
      {right ?? (onPress && <Icon name={{ ios: 'chevron.right', android: 'chevron_right' }} size={16} color={colors.textSecondary} />)}
    </>
  );

  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: TouchTarget + 8,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  iconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: Spacing.xxs },
  value: { maxWidth: '40%' },
});
