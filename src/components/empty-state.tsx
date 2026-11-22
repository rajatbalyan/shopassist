import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type EmptyStateProps = {
  title: string;
  message?: string;
  icon?: IconName;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({
  title,
  message,
  icon = { ios: 'shippingbox', android: 'inventory_2' },
  action,
}: EmptyStateProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Icon name={icon} size={32} color={colors.primary} />
      </View>
      <ThemedText variant="heading" style={styles.center}>
        {title}
      </ThemedText>
      {message && (
        <ThemedText color="textSecondary" style={styles.center}>
          {message}
        </ThemedText>
      )}
      {action && <Button title={action.label} onPress={action.onPress} style={styles.action} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  action: { marginTop: Spacing.sm },
});
