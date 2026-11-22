import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { Sheet } from '@/components/sheet';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SORT_OPTIONS } from '@/lib/filters';
import * as haptics from '@/lib/haptics';
import type { ProductSort } from '@/types';

type SortSheetProps = {
  visible: boolean;
  value: ProductSort | undefined;
  onChange: (sort: ProductSort) => void;
  onClose: () => void;
};

export function SortSheet({ visible, value = 'relevance', onChange, onClose }: SortSheetProps) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title="Sort by">
      {SORT_OPTIONS.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              haptics.tap();
              onChange(o.value);
              onClose();
            }}
            style={({ pressed }) => [
              styles.option,
              { backgroundColor: selected ? colors.primarySoft : pressed ? colors.surfaceAlt : 'transparent' },
            ]}>
            <ThemedText variant="subheading" color={selected ? 'primary' : 'text'} style={styles.label}>
              {o.label}
            </ThemedText>
            {selected && <Icon name={{ ios: 'checkmark', android: 'check' }} size={18} color={colors.primary} />}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TouchTarget + 4,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  label: { flex: 1 },
});
