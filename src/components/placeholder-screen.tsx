import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type PlaceholderScreenProps = {
  title: string;
  edges?: Edge[];
  children?: ReactNode;
};

/** Temporary screen used until Prompt 2 builds the real UI. */
export function PlaceholderScreen({ title, edges, children }: PlaceholderScreenProps) {
  return (
    <Screen edges={edges}>
      <View style={styles.root}>
        <ThemedText variant="title" accessibilityRole="header">
          {title}
        </ThemedText>
        <ThemedText color="textSecondary">Coming in Prompt 2</ThemedText>
        {children}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: Spacing.xl, gap: Spacing.md },
});
