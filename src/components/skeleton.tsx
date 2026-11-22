import { useEffect, useState } from 'react';
import { StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type SkeletonProps = {
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Placeholder block with a moving shimmer highlight. */
export function Skeleton({ width = '100%', height = 16, radius = Radius.sm, style }: SkeletonProps) {
  const { colors } = useTheme();
  const [layoutWidth, setLayoutWidth] = useState(0);
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.ease) }), -1);
    return () => cancelAnimation(progress);
  }, [progress]);

  const shimmer = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(progress.value, [0, 1], [-layoutWidth, layoutWidth]) }],
  }));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
      style={[styles.base, { width, height, borderRadius: radius, backgroundColor: colors.skeleton }, style]}>
      <Animated.View
        style={[styles.highlight, { width: layoutWidth * 0.6, backgroundColor: colors.skeletonHighlight }, shimmer]}
      />
    </View>
  );
}

/** Skeleton matching ProductCard's layout. */
export function ProductCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton height="auto" style={styles.image} radius={Radius.md} />
      <Skeleton height={14} />
      <Skeleton height={14} width="70%" />
      <Skeleton height={18} width="50%" />
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  highlight: { ...StyleSheet.absoluteFill, opacity: 0.7 },
  card: { flex: 1, gap: Spacing.sm },
  image: { aspectRatio: 1 },
});
