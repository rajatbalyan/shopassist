import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import {
  GestureDetector,
  useExclusiveGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const SPRING = { damping: 20, stiffness: 200 };
const SWIPE_CLOSE_DISTANCE = 120;
const SWIPE_PAGE_DISTANCE = 80;

type ZoomableImageProps = {
  uri: string;
  width: number;
  height: number;
  accessibilityLabel: string;
  /** Vertical drag at 1× (drives the viewer's backdrop fade). */
  dismissY: SharedValue<number>;
  onClose: () => void;
  onSingleTap: () => void;
  /** -1 for previous image, 1 for next (horizontal swipe at 1×). */
  onPage: (direction: -1 | 1) => void;
};

/**
 * Full-screen image with pinch-to-zoom (1–4×, springs back below 1×), pan clamped to the
 * image bounds, double-tap to toggle 1× / 2.5× at the tap point, and swipe down to close.
 * All gesture math runs on the UI thread.
 */
export function ZoomableImage({
  uri,
  width,
  height,
  accessibilityLabel,
  dismissY,
  onClose,
  onSingleTap,
  onPage,
}: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  const swipeX = useSharedValue(0);
  // Drives `enabled` on the pans so only one of them handles a drag.
  const zoomed = useSharedValue(false);
  const notZoomed = useSharedValue(true);

  const setZoomed = (z: boolean) => {
    'worklet';
    zoomed.set(z);
    notZoomed.set(!z);
  };

  const clampTranslation = (x: number, y: number, s: number) => {
    'worklet';
    const maxX = Math.max(0, (width * s - width) / 2);
    const maxY = Math.max(0, (height * s - height) / 2);
    return { x: Math.min(maxX, Math.max(-maxX, x)), y: Math.min(maxY, Math.max(-maxY, y)) };
  };

  const pinch = usePinchGesture({
    onBegin: () => {
      'worklet';
      savedScale.set(scale.get());
      savedTx.set(tx.get());
      savedTy.set(ty.get());
    },
    onUpdate: (e) => {
      'worklet';
      // Allow a little rubber-band below 1×; hard cap at 4×.
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE * 0.6, savedScale.get() * e.scale));
      // Keep the point under the fingers still while zooming.
      const fx = e.focalX - width / 2;
      const fy = e.focalY - height / 2;
      const ratio = next / savedScale.get();
      tx.set(fx - (fx - savedTx.get()) * ratio);
      ty.set(fy - (fy - savedTy.get()) * ratio);
      scale.set(next);
    },
    onDeactivate: () => {
      'worklet';
      if (scale.get() <= MIN_SCALE) {
        scale.set(withSpring(MIN_SCALE, SPRING));
        tx.set(withSpring(0, SPRING));
        ty.set(withSpring(0, SPRING));
        setZoomed(false);
        return;
      }
      const c = clampTranslation(tx.get(), ty.get(), scale.get());
      tx.set(withSpring(c.x, SPRING));
      ty.set(withSpring(c.y, SPRING));
      setZoomed(true);
    },
  });

  // Moving around a zoomed image.
  const pan = usePanGesture({
    enabled: zoomed,
    maxPointers: 1,
    onBegin: () => {
      'worklet';
      savedTx.set(tx.get());
      savedTy.set(ty.get());
    },
    onUpdate: (e) => {
      'worklet';
      const c = clampTranslation(savedTx.get() + e.translationX, savedTy.get() + e.translationY, scale.get());
      tx.set(c.x);
      ty.set(c.y);
    },
  });

  // At 1×: swipe down closes, swipe sideways changes image.
  const swipe = usePanGesture({
    enabled: notZoomed,
    maxPointers: 1,
    minDistance: 12,
    onUpdate: (e) => {
      'worklet';
      if (Math.abs(e.translationX) > Math.abs(e.translationY)) {
        swipeX.set(e.translationX);
        dismissY.set(0);
      } else {
        swipeX.set(0);
        dismissY.set(Math.max(0, e.translationY));
      }
    },
    onDeactivate: (e) => {
      'worklet';
      if (dismissY.get() > SWIPE_CLOSE_DISTANCE || (dismissY.get() > 20 && e.velocityY > 1000)) {
        scheduleOnRN(onClose);
        return;
      }
      if (Math.abs(swipeX.get()) > SWIPE_PAGE_DISTANCE) scheduleOnRN(onPage, swipeX.get() < 0 ? 1 : -1);
      swipeX.set(withTiming(0, { duration: 150 }));
      dismissY.set(withSpring(0, SPRING));
    },
  });

  const doubleTap = useTapGesture({
    numberOfTaps: 2,
    onDeactivate: (e) => {
      'worklet';
      if (e.canceled) return;
      if (scale.get() > MIN_SCALE) {
        scale.set(withTiming(MIN_SCALE));
        tx.set(withTiming(0));
        ty.set(withTiming(0));
        setZoomed(false);
        return;
      }
      // Zoom so the tapped point moves toward the centre.
      const c = clampTranslation(
        (width / 2 - e.x) * (DOUBLE_TAP_SCALE - 1),
        (height / 2 - e.y) * (DOUBLE_TAP_SCALE - 1),
        DOUBLE_TAP_SCALE,
      );
      scale.set(withTiming(DOUBLE_TAP_SCALE));
      tx.set(withTiming(c.x));
      ty.set(withTiming(c.y));
      setZoomed(true);
    },
  });

  const singleTap = useTapGesture({
    onDeactivate: (e) => {
      'worklet';
      if (!e.canceled) scheduleOnRN(onSingleTap);
    },
  });

  const taps = useExclusiveGestures(doubleTap, singleTap);
  const gesture = useSimultaneousGestures(pinch, pan, swipe, taps);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.get() + swipeX.get() },
      { translateY: ty.get() + dismissY.get() },
      { scale: scale.get() * (1 - Math.min(dismissY.get(), 300) / 1500) },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ width, height }, style]} accessible accessibilityLabel={accessibilityLabel} accessibilityRole="image">
        <Image source={uri} style={StyleSheet.absoluteFill} contentFit="contain" transition={150} />
      </Animated.View>
    </GestureDetector>
  );
}
