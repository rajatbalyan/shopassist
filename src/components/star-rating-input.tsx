import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as haptics from '@/lib/haptics';

type StarRatingInputProps = { value: number; onChange: (stars: number) => void };

export function StarRatingInput({ value, onChange }: StarRatingInputProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={`Rating, ${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Pressable
          key={star}
          accessibilityRole="button"
          accessibilityLabel={`${star} star${star > 1 ? 's' : ''}`}
          accessibilityState={{ selected: star <= value }}
          onPress={() => {
            haptics.tap();
            onChange(star);
          }}
          style={styles.star}>
          <Text style={[styles.glyph, { color: star <= value ? colors.star : colors.border }]}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center' },
  star: { width: TouchTarget + 8, height: TouchTarget + 8, alignItems: 'center', justifyContent: 'center' },
  glyph: { fontSize: 36 },
});
