import { Text, type TextProps } from 'react-native';

import { Typography, type ThemeColor, type TypographyVariant } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  variant?: TypographyVariant;
  color?: ThemeColor;
};

export function ThemedText({ variant = 'body', color = 'text', style, ...rest }: ThemedTextProps) {
  const { colors } = useTheme();
  return <Text style={[Typography[variant], { color: colors[color] }, style]} {...rest} />;
}
