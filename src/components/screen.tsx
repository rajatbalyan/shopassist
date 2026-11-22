import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { OfflineBanner } from '@/components/offline-banner';
import { useTheme } from '@/hooks/use-theme';

type ScreenProps = {
  children: ReactNode;
  /**
   * Safe-area edges to pad. Tab screens (no header) want `['top']`;
   * stack screens with a native header want `[]`.
   */
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  showOfflineBanner?: boolean;
};

export function Screen({ children, edges = ['top'], style, showOfflineBanner = true }: ScreenProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {showOfflineBanner && <OfflineBanner />}
      <View style={[styles.content, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
});
