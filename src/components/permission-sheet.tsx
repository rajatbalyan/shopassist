import { ActionSheet } from '@/components/action-sheet';
import { useUiStore } from '@/store/ui';

/** Explainer shown before the system notification prompt. Mounted once in the root layout. */
export function PermissionSheet() {
  const mode = useUiStore((s) => s.permissionPrompt);
  const answer = useUiStore((s) => s.answerPermission);

  return (
    <ActionSheet
      visible={!!mode}
      // Closing without choosing counts as "Not now". The resolver ignores repeat answers.
      onClose={() => answer(false)}
      title="Get order updates and price drops"
      message={
        mode === 'denied'
          ? 'Notifications are turned off for ShopAssist. Turn them on in Settings to hear when your order ships or a price drops.'
          : "We'll tell you when your order ships, when a price you follow drops, and remind you once about your cart. No marketing spam."
      }
      actions={[
        {
          key: 'allow',
          label: mode === 'denied' ? 'Turn on in Settings' : 'Turn on notifications',
          icon: { ios: 'bell.badge', android: 'notifications_active' },
          tone: 'primary',
          onPress: () => answer(true),
        },
        { key: 'later', label: 'Not now', onPress: () => answer(false) },
      ]}
    />
  );
}
