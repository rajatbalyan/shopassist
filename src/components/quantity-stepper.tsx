import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type QuantityStepperProps = {
  value: number;
  min?: number;
  max: number;
  onChange: (value: number) => void;
  /** Used in labels, e.g. "Decrease quantity of iPhone 13". */
  itemName: string;
};

export function QuantityStepper({ value, min = 1, max, onChange, itemName }: QuantityStepperProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.root, { borderColor: colors.border }]}
      accessible={false}
      accessibilityLabel={`Quantity ${value}`}>
      <IconButton
        icon={{ ios: 'minus', android: 'remove' }}
        size={16}
        accessibilityLabel={`Decrease quantity of ${itemName}`}
        disabled={value <= min}
        onPress={() => onChange(value - 1)}
      />
      <ThemedText variant="subheading" style={styles.value} accessibilityLabel={`Quantity ${value}`}>
        {value}
      </ThemedText>
      <IconButton
        icon={{ ios: 'plus', android: 'add' }}
        size={16}
        accessibilityLabel={`Increase quantity of ${itemName}`}
        disabled={value >= max}
        onPress={() => onChange(value + 1)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.pill,
  },
  value: { minWidth: 24, textAlign: 'center' },
});
