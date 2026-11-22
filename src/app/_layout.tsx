import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { PermissionSheet } from '@/components/permission-sheet';
import { QuickActionSheet } from '@/components/quick-action-sheet';
import { useTheme } from '@/hooks/use-theme';
import { useNotifications } from '@/lib/notifications';
import { queryClient } from '@/lib/queries';

// Deep links (e.g. shopassist://product/1 from a cold start) open on top of the tabs,
// so Back always lands somewhere sensible.
export const unstable_settings = { anchor: '(tabs)' };

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  useNotifications();

  const navigationTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border,
        notification: colors.danger,
      },
    };
  }, [colors, scheme]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerBackButtonDisplayMode: 'minimal',
              headerTintColor: colors.primary,
              headerTitleStyle: { color: colors.text },
              headerStyle: { backgroundColor: colors.surface },
              contentStyle: { backgroundColor: colors.background },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="product/[id]" options={{ title: '' }} />
            <Stack.Screen name="product/[id]/ask" options={{ presentation: 'modal', headerShown: false }} />
            <Stack.Screen name="category/[slug]" options={{ title: 'Category' }} />
            <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
            <Stack.Screen name="wishlist" options={{ title: 'Wishlist' }} />
            <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
            <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
            <Stack.Screen name="+not-found" options={{ title: 'Not found' }} />
          </Stack>
          <QuickActionSheet />
          <PermissionSheet />
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
