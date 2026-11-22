import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, isMockApi } from '@/lib/api';
import * as haptics from '@/lib/haptics';
import {
  ensureNotificationPermission,
  getPushTokenResult,
  maskPushToken,
  pushTokenSuffix,
  sendTestNotification,
  syncPushToken,
} from '@/lib/notifications';
import { useSettingsStore } from '@/store/settings';

type Tone = 'ok' | 'warn' | 'bad';
type Line = { label: string; value: string; tone: Tone };
type Diagnostics = { permission: Line; token: Line; registered: Line; canPush: boolean };

const PERMISSION: Record<string, Line> = {
  granted: { label: 'Permission', value: 'Allowed', tone: 'ok' },
  denied: { label: 'Permission', value: 'Blocked (turn on in system settings)', tone: 'bad' },
  undetermined: { label: 'Permission', value: 'Not asked yet', tone: 'warn' },
};

async function collect(): Promise<Diagnostics> {
  const perm = await Notifications.getPermissionsAsync().catch(() => null);
  const permission = perm?.granted
    ? PERMISSION.granted!
    : perm?.status === 'denied'
      ? PERMISSION.denied!
      : PERMISSION.undetermined!;

  const { token, reason } = await getPushTokenResult();
  const tokenLine: Line = token
    ? { label: 'Push token', value: maskPushToken(token), tone: 'ok' }
    : { label: 'Push token', value: reason ?? 'None', tone: 'bad' };

  let registered: Line;
  if (isMockApi) registered = { label: 'Registered with API', value: 'Mock mode (no API)', tone: 'warn' };
  else if (!token) registered = { label: 'Registered with API', value: 'No token to register', tone: 'bad' };
  else {
    try {
      const status = await api.getDevice(useSettingsStore.getState().deviceId);
      registered = !status.registered
        ? { label: 'Registered with API', value: 'No', tone: 'bad' }
        : status.tokenSuffix === pushTokenSuffix(token)
          ? { label: 'Registered with API', value: 'Yes', tone: 'ok' }
          : { label: 'Registered with API', value: 'Old token (tap Register again)', tone: 'warn' };
    } catch (e) {
      registered = {
        label: 'Registered with API',
        value: e instanceof ApiError ? `Couldn’t check: ${e.message}` : 'Couldn’t check',
        tone: 'warn',
      };
    }
  }
  return { permission, token: tokenLine, registered, canPush: !!token && !isMockApi };
}

/** Profile → Demo tools: everything needed to debug push live, plus a real test push. */
export function PushDiagnostics({ onMessage }: { onMessage: (text: string) => void }) {
  const { colors } = useTheme();
  const [data, setData] = useState<Diagnostics | null>(null);
  const [busy, setBusy] = useState<'test' | 'register' | null>(null);
  const deviceId = useSettingsStore((s) => s.deviceId);

  const refresh = useCallback(() => {
    let cancelled = false;
    void collect().then((d) => {
      if (!cancelled) setData(d);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  useFocusEffect(refresh);

  const toneColor = (tone: Tone) => (tone === 'ok' ? colors.success : tone === 'warn' ? colors.warning : colors.danger);

  const register = async () => {
    setBusy('register');
    try {
      if (!(await ensureNotificationPermission('settings'))) return;
      const ok = await syncPushToken(true);
      onMessage(ok ? 'Push token registered with the API.' : 'Couldn’t register the push token.');
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const sendTest = async () => {
    setBusy('test');
    try {
      if (isMockApi) {
        // Mock mode has no server to push from; a local notification proves the UI path.
        if (!(await ensureNotificationPermission('settings'))) return;
        await sendTestNotification();
        onMessage('Mock mode: sent a local test notification instead (2 s).');
        return;
      }
      // Make sure the server has this device's current token first.
      if (!(await syncPushToken())) {
        onMessage('No push token yet. Check the lines above.');
        return;
      }
      const result = await api.sendTestPush(useSettingsStore.getState().deviceId);
      haptics.success();
      onMessage(result.pushed > 0 ? 'Test push sent. It should arrive in a few seconds.' : (result.note ?? 'Expo didn’t accept the push.'));
    } catch (e) {
      onMessage(e instanceof ApiError ? e.message : 'Couldn’t send the test push.');
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const lines = data ? [data.permission, data.token, data.registered] : [];

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
          <Icon name={{ ios: 'antenna.radiowaves.left.and.right', android: 'cell_tower' }} size={18} color={colors.primary} />
        </View>
        <ThemedText style={styles.flex} accessibilityRole="header">
          Push diagnostics
        </ThemedText>
      </View>
      {data === null ? (
        <ThemedText variant="caption" color="textSecondary">
          Checking…
        </ThemedText>
      ) : (
        lines.map((line) => (
          <View key={line.label} style={styles.line} accessible accessibilityLabel={`${line.label}: ${line.value}`}>
            <View style={[styles.dot, { backgroundColor: toneColor(line.tone) }]} />
            <ThemedText variant="caption" color="textSecondary" style={styles.lineLabel}>
              {line.label}
            </ThemedText>
            <ThemedText variant="caption" style={styles.flex} numberOfLines={2}>
              {line.value}
            </ThemedText>
          </View>
        ))
      )}
      {/* Long-press to copy: lets the PowerShell test-push command in DEPLOY.md target this phone. */}
      <ThemedText variant="caption" color="textSecondary" selectable>
        Device id: {deviceId}
      </ThemedText>
      <View style={styles.actions}>
        <Button
          title={isMockApi ? 'Send local test' : 'Send me a test push'}
          onPress={() => void sendTest()}
          loading={busy === 'test'}
          disabled={busy !== null}
          style={styles.flex}
        />
        {!isMockApi && (
          <Button
            title="Register again"
            variant="secondary"
            onPress={() => void register()}
            loading={busy === 'register'}
            disabled={busy !== null}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: Spacing.lg, gap: Spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xs },
  iconWrap: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  lineLabel: { width: 112 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, flexWrap: 'wrap' },
});
