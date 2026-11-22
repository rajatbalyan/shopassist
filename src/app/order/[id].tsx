import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { ThemedText } from '@/components/themed-text';

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <PlaceholderScreen title="Order" edges={[]}>
      <ThemedText color="textSecondary">Order #{id}</ThemedText>
    </PlaceholderScreen>
  );
}
