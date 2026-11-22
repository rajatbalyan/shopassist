import { useColorScheme } from 'react-native';

import { Colors, type ColorScheme, type ThemeColors } from '@/constants/theme';
import { useSettingsStore } from '@/store/settings';

/** Resolved theme: the user's override if set, otherwise the system scheme. */
export function useTheme(): { colors: ThemeColors; scheme: ColorScheme } {
  const system = useColorScheme();
  const preference = useSettingsStore((s) => s.themePreference);
  const scheme: ColorScheme = preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference;
  return { colors: Colors[scheme], scheme };
}
