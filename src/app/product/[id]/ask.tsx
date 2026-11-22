import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { ThemedText } from '@/components/themed-text';
import { useProduct } from '@/lib/queries';

export default function AskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product } = useProduct(id);

  return (
    <PlaceholderScreen title="Ask AI" edges={[]}>
      {product && <ThemedText color="textSecondary">About: {product.title}</ThemedText>}
    </PlaceholderScreen>
  );
}
