import { router } from 'expo-router';

import { Button } from '@/components/button';
import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function OnboardingScreen() {
  return (
    <PlaceholderScreen title="Welcome to ShopAssist">
      <Button title="Continue" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </PlaceholderScreen>
  );
}
