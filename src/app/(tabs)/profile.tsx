import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { PlaceholderScreen } from '@/components/placeholder-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useSettingsStore, type ThemePreference } from '@/store/settings';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

// Placeholder Profile: links to every stack route so navigation can be tested end to end.
export default function ProfileScreen() {
  const themePreference = useSettingsStore((s) => s.themePreference);
  const setThemePreference = useSettingsStore((s) => s.setThemePreference);

  return (
    <PlaceholderScreen title="Profile">
      <ThemedText variant="subheading">Theme</ThemedText>
      <View style={styles.row}>
        {THEMES.map((t) => (
          <Chip
            key={t.value}
            label={t.label}
            selected={themePreference === t.value}
            onPress={() => setThemePreference(t.value)}
          />
        ))}
      </View>
      <Button title="Wishlist" variant="ghost" onPress={() => router.push('/wishlist')} />
      <Button title="Notification settings" variant="ghost" onPress={() => router.push('/notifications')} />
      <Button title="Checkout" variant="ghost" onPress={() => router.push('/checkout')} />
      <Button title="Onboarding" variant="ghost" onPress={() => router.push('/onboarding')} />
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
});
