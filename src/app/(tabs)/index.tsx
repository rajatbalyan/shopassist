import { FlatList, StyleSheet, View } from 'react-native';

import { ErrorState } from '@/components/error-state';
import { ProductCard } from '@/components/product-card';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { ProductCardSkeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useProducts } from '@/lib/queries';
import { useSettingsStore } from '@/store/settings';

const SKELETONS = Array.from({ length: 6 }, (_, i) => i);

// Placeholder Home: proves seed data, images and ProductCard work. Full Home is Prompt 2.
export default function HomeScreen() {
  const name = useSettingsStore((s) => s.name);
  const { data, isPending, isError, refetch, isRefetching } = useProducts({ limit: 10 });
  const products = data?.pages[0]?.items ?? [];

  const header = (
    <View style={styles.header}>
      <ThemedText variant="title">{name ? `Hi, ${name}` : 'ShopAssist'}</ThemedText>
      <ThemedText color="textSecondary">Full Home screen coming in Prompt 2</ThemedText>
      <SectionHeader title="Popular" />
    </View>
  );

  if (isError) {
    return (
      <Screen>
        <ErrorState onRetry={refetch} />
      </Screen>
    );
  }

  return (
    <Screen>
      {isPending ? (
        <FlatList
          data={SKELETONS}
          keyExtractor={String}
          numColumns={2}
          ListHeaderComponent={header}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.content}
          renderItem={() => <ProductCardSkeleton />}
        />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          numColumns={2}
          ListHeaderComponent={header}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.content}
          onRefresh={refetch}
          refreshing={isRefetching}
          renderItem={({ item }) => <ProductCard product={item} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm, marginBottom: Spacing.md },
  content: { padding: Spacing.lg, gap: Spacing.md },
  column: { gap: Spacing.md },
});
