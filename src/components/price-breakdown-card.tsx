import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPrice } from '@/lib/format';
import type { PriceBreakdown } from '@/lib/pricing';

type PriceBreakdownCardProps = {
  breakdown: Pick<PriceBreakdown, 'subtotal' | 'delivery' | 'total'>;
  itemCount: number;
  title?: string;
};

/** Subtotal / delivery / total. The same card is used in cart, checkout and order detail. */
export function PriceBreakdownCard({ breakdown, itemCount, title = 'Price details' }: PriceBreakdownCardProps) {
  const { colors } = useTheme();
  const { subtotal, delivery, total } = breakdown;

  return (
    <Card>
      <ThemedText variant="subheading" accessibilityRole="header">
        {title}
      </ThemedText>
      <Line label={`Subtotal (${itemCount} item${itemCount === 1 ? '' : 's'})`} value={formatPrice(subtotal)} />
      <Line
        label="Delivery"
        value={delivery === 0 ? 'FREE' : formatPrice(delivery)}
        valueColor={delivery === 0 ? colors.success : undefined}
      />
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.row} accessible accessibilityLabel={`Total ${formatPrice(total)}`}>
        <ThemedText variant="subheading">Total</ThemedText>
        <ThemedText variant="price">{formatPrice(total)}</ThemedText>
      </View>
      <ThemedText variant="caption" color="textSecondary">
        Inclusive of all taxes. No other fees will be added.
      </ThemedText>
    </Card>
  );
}

function Line({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}, ${value}`}>
      <ThemedText color="textSecondary">{label}</ThemedText>
      <ThemedText style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  value: { fontVariant: ['tabular-nums'], fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth },
});
