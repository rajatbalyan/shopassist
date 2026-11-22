import { StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type RatingStarsProps = {
  rating: number;
  count?: number;
  /** `compact` shows one star + number (for cards); `full` shows five stars. */
  variant?: 'compact' | 'full';
  size?: number;
};

export function RatingStars({ rating, count, variant = 'compact', size = 13 }: RatingStarsProps) {
  const { colors } = useTheme();
  const rounded = Math.round(rating);
  const label = `Rated ${rating.toFixed(1)} out of 5${count !== undefined ? `, ${count} reviews` : ''}`;

  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={label}>
      {variant === 'full' ? (
        <Text style={{ fontSize: size, letterSpacing: 1 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Text key={i} style={{ color: i <= rounded ? colors.star : colors.border }}>
              ★
            </Text>
          ))}
        </Text>
      ) : (
        <Text style={{ fontSize: size, color: colors.star }}>★</Text>
      )}
      <ThemedText variant="caption" style={{ fontSize: size - 1 }}>
        {rating.toFixed(1)}
      </ThemedText>
      {count !== undefined && (
        <ThemedText variant="caption" color="textSecondary" style={{ fontSize: size - 1 }}>
          ({count})
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
});
