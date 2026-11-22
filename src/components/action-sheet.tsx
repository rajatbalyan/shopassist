import { useEffect, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SheetAction = {
  key: string;
  label: string;
  icon?: IconName;
  tone?: 'default' | 'primary' | 'danger';
  /** Runs after the sheet has closed. */
  onPress: () => void;
};

type ActionSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  /** Custom content above the actions (e.g. a product summary). */
  header?: ReactNode;
  actions: SheetAction[];
};

const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/**
 * Bottom action sheet: slides up on the UI thread, closes on backdrop tap,
 * swipe down, the Android back button, or after an action.
 */
export function ActionSheet({ visible, onClose, title, message, header, actions }: ActionSheetProps) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(height);

  useEffect(() => {
    if (visible) translateY.set(withTiming(0, { duration: 260 }));
    else translateY.set(height);
  }, [visible, height, translateY]);

  // Animate out, then tell the parent (and run the chosen action, if any).
  const close = (then?: () => void) => {
    translateY.set(
      withTiming(height, { duration: 200 }, (finished) => {
        if (!finished) return;
        // The action runs first so it wins over the "closed without choosing" handler.
        if (then) scheduleOnRN(then);
        scheduleOnRN(onClose);
      }),
    );
  };

  const pan = usePanGesture({
    activeOffsetY: 8,
    onUpdate: (e) => {
      'worklet';
      translateY.set(Math.max(0, e.translationY));
    },
    onDeactivate: (e) => {
      'worklet';
      if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
        translateY.set(withTiming(height, { duration: 180 }, () => scheduleOnRN(onClose)));
      } else {
        translateY.set(withSpring(0, { damping: 20, stiffness: 220 }));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.get(), [0, height * 0.5], [1, 0], 'clamp'),
  }));

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={() => close()}>
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdropStyle]}>
          <Pressable style={styles.flex} onPress={() => close()} accessibilityRole="button" accessibilityLabel="Close" />
        </Animated.View>
        <View style={styles.spacer} pointerEvents="box-none" />
        <GestureDetector gesture={pan}>
          <Animated.View style={[styles.sheet, { backgroundColor: colors.surface }, sheetStyle]} accessibilityViewIsModal>
            <SafeAreaView edges={['bottom']}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              {(title || message) && (
                <View style={styles.titleBlock}>
                  {title && (
                    <ThemedText variant="heading" accessibilityRole="header">
                      {title}
                    </ThemedText>
                  )}
                  {message && <ThemedText color="textSecondary">{message}</ThemedText>}
                </View>
              )}
              {header}
              <View style={styles.actions}>
                {actions.map((a) => {
                  const color = a.tone === 'danger' ? colors.danger : a.tone === 'primary' ? colors.primary : colors.text;
                  return (
                    <Pressable
                      key={a.key}
                      onPress={() => close(a.onPress)}
                      accessibilityRole="button"
                      accessibilityLabel={a.label}
                      style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceAlt }]}>
                      {a.icon && <Icon name={a.icon} size={22} color={color} />}
                      <ThemedText variant={a.tone === 'primary' ? 'subheading' : 'body'} style={{ color }}>
                        {a.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </SafeAreaView>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  spacer: { flex: 1 },
  sheet: {
    borderTopLeftRadius: Radius.lg + 4,
    borderTopRightRadius: Radius.lg + 4,
    paddingBottom: Spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginVertical: Spacing.sm },
  titleBlock: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.xs },
  actions: { paddingTop: Spacing.xs },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    minHeight: TouchTarget + 8,
    paddingHorizontal: Spacing.lg,
  },
});
