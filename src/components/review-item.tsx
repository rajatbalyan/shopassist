import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Badge } from '@/components/badge';
import { RatingStars } from '@/components/rating-stars';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDate } from '@/lib/format';
import type { Review } from '@/types';

type ReviewItemProps = { review: Review; highlighted?: boolean };

export function ReviewItem({ review, highlighted }: ReviewItemProps) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={FadeIn}
      layout={LinearTransition}
      style={[
        styles.root,
        { borderColor: highlighted ? colors.primary : colors.border, backgroundColor: highlighted ? colors.primarySoft : colors.surface },
      ]}>
      <View style={styles.header}>
        <RatingStars rating={review.rating} variant="full" size={12} />
        {review.verified && <Badge label="Verified purchase" tone="success" />}
      </View>
      <ThemedText>{review.comment}</ThemedText>
      <ThemedText variant="caption" color="textSecondary">
        {review.reviewerName} · {formatDate(review.date)}
      </ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.xs },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
});
