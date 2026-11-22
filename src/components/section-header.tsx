import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing, TouchTarget } from '@/constants/theme';

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function SectionHeader({ title, subtitle, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <ThemedText variant="heading" accessibilityRole="header">
          {title}
        </ThemedText>
        {subtitle && (
          <ThemedText variant="caption" color="textSecondary">
            {subtitle}
          </ThemedText>
        )}
      </View>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={`${actionLabel}, ${title}`}
          style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
          <ThemedText variant="subheading" color="primary">
            {actionLabel}
          </ThemedText>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  text: { flex: 1, gap: Spacing.xxs },
  action: { minHeight: TouchTarget, justifyContent: 'center', paddingLeft: Spacing.md },
});
