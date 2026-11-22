import { router, Stack } from 'expo-router';

import { EmptyState } from '@/components/empty-state';
import { Screen } from '@/components/screen';

/** Unknown routes and deep links (e.g. shopassist://nope) land here. */
export default function NotFoundScreen() {
  return (
    <Screen edges={[]}>
      <Stack.Screen options={{ title: 'Not found' }} />
      <EmptyState
        title="We couldn’t find that page"
        message="The link may be old or mistyped. Let’s get you back to shopping."
        icon={{ ios: 'questionmark.circle', android: 'help' }}
        action={{ label: 'Go home', onPress: () => router.replace('/') }}
      />
    </Screen>
  );
}
