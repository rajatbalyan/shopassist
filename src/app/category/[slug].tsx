import { Stack, useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useCategories } from '@/lib/queries';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: categories } = useCategories();
  const name = categories?.find((c) => c.slug === slug)?.name ?? 'Category';

  return (
    <PlaceholderScreen title={name} edges={[]}>
      <Stack.Screen options={{ title: name }} />
    </PlaceholderScreen>
  );
}
