import { useEffect, useState } from 'react';
import { Modal, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { FadeIn, FadeOut, interpolate, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/icon-button';
import { ThemedText } from '@/components/themed-text';
import { ZoomableImage } from '@/components/zoomable-image';
import { Radius, Spacing } from '@/constants/theme';
import { useSettingsStore } from '@/store/settings';

type ImageViewerProps = {
  images: string[];
  title: string;
  /** Image to open on; `null` hides the viewer. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
};

const HINT_MS = 2500;

/** Full-screen gallery overlay with zoomable images. */
export function ImageViewer({ images, title, index, onIndexChange, onClose }: ImageViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dismissY = useSharedValue(0);
  const [chrome, setChrome] = useState(true);
  const hintSeen = useSettingsStore((s) => s.zoomHintSeen);
  const setHintSeen = useSettingsStore((s) => s.setZoomHintSeen);
  const visible = index !== null;
  const [showHint, setShowHint] = useState(false);

  // One-time "Pinch to zoom" hint on the first open.
  useEffect(() => {
    if (!visible || hintSeen) return;
    setHintSeen();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot hint tied to opening the modal
    setShowHint(true);
  }, [visible, hintSeen, setHintSeen]);

  useEffect(() => {
    if (!showHint) return;
    const id = setTimeout(() => setShowHint(false), HINT_MS);
    return () => clearTimeout(id);
  }, [showHint]);

  const backdrop = useAnimatedStyle(() => ({
    opacity: interpolate(dismissY.get(), [0, 300], [1, 0.3], 'clamp'),
  }));

  const page = (direction: -1 | 1) => {
    if (index === null) return;
    const next = index + direction;
    if (next >= 0 && next < images.length) onIndexChange(next);
  };

  const close = () => {
    dismissY.set(0);
    setChrome(true);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <GestureHandlerRootView style={styles.flex}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdrop]} />
        {index !== null && (
          <View style={styles.center}>
            <ZoomableImage
              key={index}
              uri={images[index]}
              width={width}
              height={height}
              accessibilityLabel={`${title}, image ${index + 1} of ${images.length}`}
              dismissY={dismissY}
              onClose={close}
              onSingleTap={() => setChrome((c) => !c)}
              onPage={page}
            />
          </View>
        )}

        {chrome && (
          <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} style={[styles.top, { top: insets.top + Spacing.sm }]} pointerEvents="box-none">
            {images.length > 1 && index !== null && (
              <View style={styles.counter}>
                <ThemedText variant="caption" style={styles.light}>
                  {index + 1} / {images.length}
                </ThemedText>
              </View>
            )}
            <View style={styles.flex} />
            <IconButton icon={{ ios: 'xmark', android: 'close' }} color="#FFFFFF" accessibilityLabel="Close image viewer" onPress={close} style={styles.close} />
          </Animated.View>
        )}

        {showHint && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(300)} style={[styles.hint, { bottom: insets.bottom + Spacing.xxl }]} pointerEvents="none">
            <ThemedText variant="subheading" style={styles.light}>
              Pinch to zoom · double-tap · swipe down to close
            </ThemedText>
          </Animated.View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { backgroundColor: '#000000' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  top: { position: 'absolute', left: Spacing.lg, right: Spacing.sm, flexDirection: 'row', alignItems: 'center' },
  counter: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs },
  close: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: Radius.pill },
  light: { color: '#FFFFFF' },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
});
