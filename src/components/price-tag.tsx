import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { discountPercent, formatPrice } from '@/lib/format';

type PriceTagProps = {
  price: number;
  mrp?: number;
  size?: 'md' | 'lg';
};

export function PriceTag({ price, mrp, size = 'md' }: PriceTagProps) {
  const off = mrp ? discountPercent(price, mrp) : 0;
  const large = size === 'lg';
  const label = off
    ? `${formatPrice(price)}, MRP ${formatPrice(mrp!)}, ${off} percent off`
    : formatPrice(price);

  return (
    <View style={styles.row} accessible accessibilityLabel={label}>
      <ThemedText variant="price" style={large && styles.large}>
        {formatPrice(price)}
      </ThemedText>
      {off > 0 && (
        <>
          <ThemedText variant="caption" color="textSecondary" style={styles.mrp}>
            {formatPrice(mrp!)}
          </ThemedText>
          <ThemedText variant="caption" color="success" style={styles.off}>
            {off}% off
          </ThemedText>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: Spacing.xs },
  large: { fontSize: 24, lineHeight: 30 },
  mrp: { textDecorationLine: 'line-through' },
  off: { fontWeight: '700' },
});
