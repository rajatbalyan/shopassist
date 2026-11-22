import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as haptics from '@/lib/haptics';

type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  /** Shows a close icon; pressing the chip removes it. */
  onRemove?: () => void;
};

export function Chip({ label, selected = false, onPress, onRemove }: ChipProps) {
  const { colors } = useTheme();
  const handlePress = onRemove ?? onPress;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={onRemove ? `Remove ${label}` : label}
      accessibilityState={{ selected }}
      hitSlop={{ top: 6, bottom: 6 }}
      onPress={() => {
        haptics.tap();
        handlePress?.();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
        pressed && styles.pressed,
      ]}>
      <ThemedText variant="caption" style={[styles.label, { color: selected ? colors.primaryText : colors.text }]}>
        {label}
      </ThemedText>
      {onRemove && (
        <Icon name={{ ios: 'xmark', android: 'close' }} size={12} color={selected ? colors.primaryText : colors.textSecondary} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 36,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  label: { fontSize: 13 },
  pressed: { opacity: 0.7 },
});
