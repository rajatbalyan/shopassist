import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { ProductGrid } from '@/components/product-grid';
import { Screen } from '@/components/screen';
import { SortSheet } from '@/components/sort-sheet';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { sortLabel } from '@/lib/filters';
import { useCategories, useProductGrid } from '@/lib/queries';
import type { ProductSort } from '@/types';

// Friendly "Something went wrong · Try again" screen instead of a red crash.
export { ErrorFallback as ErrorBoundary } from '@/components/error-fallback';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { colors } = useTheme();
  const [sort, setSort] = useState<ProductSort>('relevance');
  const [sortOpen, setSortOpen] = useState(false);
  const { data: categories } = useCategories();
  const grid = useProductGrid({ category: slug, sort });
  const category = categories?.find((c) => c.slug === slug);
  const name = category?.name ?? 'Category';
  const count = grid.total ?? category?.count;

  const header = (
    <View style={styles.header}>
      <View style={styles.flex}>
        <ThemedText variant="title" numberOfLines={2} accessibilityRole="header">
          {name}
        </ThemedText>
        {count !== undefined && (
          <ThemedText color="textSecondary">
            {count} product{count === 1 ? '' : 's'}
          </ThemedText>
        )}
      </View>
      <Pressable
        onPress={() => setSortOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`Sort, currently ${sortLabel(sort)}`}
        style={({ pressed }) => [
          styles.sort,
          { borderColor: colors.border, backgroundColor: colors.surface },
          pressed && { opacity: 0.7 },
        ]}>
        <Icon name={{ ios: 'arrow.up.arrow.down', android: 'swap_vert' }} size={16} color={colors.text} />
        <ThemedText variant="caption" numberOfLines={1} style={styles.sortLabel}>
          {sortLabel(sort)}
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: name }} />
      <ProductGrid
        {...grid}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            title="Nothing here yet"
            message="This category has no products right now."
            action={{ label: 'Browse all products', onPress: () => router.navigate('/') }}
          />
        }
      />
      <SortSheet visible={sortOpen} value={sort} onChange={setSort} onClose={() => setSortOpen(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xs },
  sort: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 44,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.pill,
    maxWidth: 170,
  },
  sortLabel: { fontSize: 13, flexShrink: 1 },
});
