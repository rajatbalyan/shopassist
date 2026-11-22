import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** SF Symbol on iOS, Material Symbol on Android/web. */
export type IconName = Extract<SymbolViewProps['name'], { ios?: unknown }>;

type IconProps = {
  name: IconName;
  size?: number;
  color?: ColorValue;
};

export function Icon({ name, size = 22, color }: IconProps) {
  const { colors } = useTheme();
  return (
    <SymbolView
      name={{ web: name.android, ...name }}
      size={size}
      tintColor={color ?? colors.text}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}
