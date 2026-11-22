import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Icon } from '@/components/icon';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { BuyerInsights, Insight } from '@/types';

type BuyerInsightsCardProps = {
  insights: BuyerInsights | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Called with the tapped point so the screen can show its source reviews. */
  onSelect: (insight: Insight) => void;
  selectedPoint?: string;
};

/** "What buyers say": pros and cons, each linked to the reviews it was drawn from. */
export function BuyerInsightsCard({ insights, isPending, isError, onRetry, onSelect, selectedPoint }: BuyerInsightsCardProps) {
  const { colors } = useTheme();

  return (
    <Card>
      <View style={styles.titleRow}>
        <Icon name={{ ios: 'sparkles', android: 'auto_awesome' }} size={18} color={colors.primary} />
        <ThemedText variant="heading" accessibilityRole="header">
          What buyers say
        </ThemedText>
      </View>

      {isPending ? (
        <View style={styles.skeletons}>
          <Skeleton height={14} width="80%" />
          <Skeleton height={14} width="65%" />
          <Skeleton height={14} width="72%" />
        </View>
      ) : isError || !insights ? (
        <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retry}>
          <ThemedText color="textSecondary">Couldn&apos;t load the summary. </ThemedText>
          <ThemedText color="primary" variant="subheading">
            Try again
          </ThemedText>
        </Pressable>
      ) : insights.pros.length === 0 && insights.cons.length === 0 ? (
        <ThemedText color="textSecondary">Not enough reviews to summarise yet.</ThemedText>
      ) : (
        <>
          {insights.pros.length > 0 && (
            <Group label="Liked" tone="pro" items={insights.pros} onSelect={onSelect} selectedPoint={selectedPoint} />
          )}
          {insights.cons.length > 0 && (
            <Group label="Disliked" tone="con" items={insights.cons} onSelect={onSelect} selectedPoint={selectedPoint} />
          )}
        </>
      )}

      <ThemedText variant="caption" color="textSecondary">
        Summarised from verified reviews. Every point links to its source.
      </ThemedText>
    </Card>
  );
}

type GroupProps = {
  label: string;
  tone: 'pro' | 'con';
  items: Insight[];
  onSelect: (insight: Insight) => void;
  selectedPoint?: string;
};

function Group({ label, tone, items, onSelect, selectedPoint }: GroupProps) {
  const { colors } = useTheme();
  const color = tone === 'pro' ? colors.success : colors.warning;

  return (
    <View style={styles.group}>
      <ThemedText variant="caption" style={[styles.groupLabel, { color }]}>
        {label.toUpperCase()}
      </ThemedText>
      {items.map((item) => {
        const n = item.reviewIds.length;
        const selected = selectedPoint === item.point;
        return (
          <Pressable
            key={item.point}
            onPress={() => onSelect(item)}
            accessibilityRole="button"
            accessibilityLabel={`${tone === 'pro' ? 'Pro' : 'Con'}: ${item.point}, from ${n} review${n === 1 ? '' : 's'}`}
            accessibilityHint="Shows the reviews this point came from"
            accessibilityState={{ selected }}
            style={({ pressed }) => [
              styles.point,
              { backgroundColor: selected ? colors.surfaceAlt : 'transparent' },
              pressed && { opacity: 0.7 },
            ]}>
            <Icon
              name={
                tone === 'pro'
                  ? { ios: 'hand.thumbsup.fill', android: 'thumb_up' }
                  : { ios: 'hand.thumbsdown.fill', android: 'thumb_down' }
              }
              size={16}
              color={color}
            />
            <ThemedText style={styles.pointText}>{item.point}</ThemedText>
            <ThemedText variant="caption" color="primary">
              from {n} review{n === 1 ? '' : 's'}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  skeletons: { gap: Spacing.sm },
  retry: { flexDirection: 'row', flexWrap: 'wrap', minHeight: TouchTarget, alignItems: 'center' },
  group: { gap: Spacing.xxs },
  groupLabel: { fontWeight: '700', letterSpacing: 0.5 },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: TouchTarget,
    paddingHorizontal: Spacing.sm,
    marginHorizontal: -Spacing.sm,
    borderRadius: Radius.sm,
  },
  pointText: { flex: 1 },
});
