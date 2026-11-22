import type { ErrorBoundaryProps } from 'expo-router';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Friendly replacement for a red crash screen. Exported as `ErrorBoundary` from the root
 * layout (catches everything) and from busy routes (so the rest of the app stays usable).
 * Deliberately depends on nothing but the theme: it must render even if providers failed.
 */
export function ErrorFallback({ error, retry }: ErrorBoundaryProps) {
  const { colors } = useTheme();

  useEffect(() => {
    console.error('[ErrorBoundary]', error);
  }, [error]);

  const goHome = () => {
    try {
      router.replace('/');
    } catch {
      void retry();
    }
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.body}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name={{ ios: 'exclamationmark.triangle', android: 'error' }} size={32} color={colors.primary} />
        </View>
        <ThemedText variant="heading" style={styles.center} accessibilityRole="header">
          Something went wrong
        </ThemedText>
        <ThemedText color="textSecondary" style={styles.center}>
          This screen hit a problem. Your cart and orders are safe.
        </ThemedText>
        {__DEV__ && (
          <ThemedText variant="caption" color="danger" style={styles.center} numberOfLines={4}>
            {error.message}
          </ThemedText>
        )}
        <View style={styles.actions}>
          <Button title="Try again" onPress={() => void retry()} fullWidth />
          <Button title="Go to Home" variant="ghost" onPress={goHome} fullWidth />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.md },
  iconWrap: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.md },
});
