import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

// Stretch goal: simple placeholder until the 3-slide onboarding is built.
export default function OnboardingScreen() {
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.root}>
        <ThemedText variant="title" accessibilityRole="header">
          Welcome to ShopAssist
        </ThemedText>
        <ThemedText color="textSecondary">Shop smarter with honest, review-based answers.</ThemedText>
        <Button title="Continue" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: Spacing.xl, gap: Spacing.lg },
});
