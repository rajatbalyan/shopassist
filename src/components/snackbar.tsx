import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SnackbarOptions = { actionLabel?: string; onAction?: () => void; duration?: number };
type SnackbarState = SnackbarOptions & { message: string; key: number };

/**
 * Local snackbar for a screen. Render `snackbar` last inside the screen so it floats
 * above content; `bottom` lifts it above a sticky bar.
 */
export function useSnackbar(bottom = Spacing.lg) {
  const [state, setState] = useState<SnackbarState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setState(null);
  }, []);

  const show = useCallback(
    (message: string, options: SnackbarOptions = {}) => {
      if (timer.current) clearTimeout(timer.current);
      setState({ message, ...options, key: Date.now() });
      timer.current = setTimeout(hide, options.duration ?? (options.actionLabel ? 5000 : 2500));
    },
    [hide],
  );

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const snackbar = state ? (
    <Snackbar
      key={state.key}
      message={state.message}
      actionLabel={state.actionLabel}
      onAction={() => {
        state.onAction?.();
        hide();
      }}
      bottom={bottom}
    />
  ) : null;

  return { show, hide, snackbar };
}

type SnackbarProps = { message: string; actionLabel?: string; onAction?: () => void; bottom: number };

function Snackbar({ message, actionLabel, onAction, bottom }: SnackbarProps) {
  const { colors, scheme } = useTheme();
  // Inverted surface so it stands out in both themes.
  const bg = scheme === 'dark' ? colors.text : '#1F1D2B';
  const fg = scheme === 'dark' ? colors.background : '#FFFFFF';
  const action = scheme === 'dark' ? '#4B3FD1' : '#B7AEFF';

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(150)}
      style={[styles.wrap, { bottom }]}
      pointerEvents="box-none">
      <View style={[styles.bar, { backgroundColor: bg }]} accessibilityRole="alert" accessibilityLiveRegion="polite">
        <ThemedText style={[styles.message, { color: fg }]}>{message}</ThemedText>
        {actionLabel && (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.6 }]}>
            <ThemedText variant="subheading" style={{ color: action }}>
              {actionLabel}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: Spacing.lg, right: Spacing.lg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.md,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    minHeight: TouchTarget + 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  message: { flex: 1, paddingVertical: Spacing.md },
  action: { minHeight: TouchTarget, justifyContent: 'center', paddingHorizontal: Spacing.md },
});
