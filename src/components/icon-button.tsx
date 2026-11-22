import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, TouchTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import * as haptics from '@/lib/haptics';

type IconButtonProps = Omit<PressableProps, 'style' | 'children'> & {
  icon: IconName;
  /** Required: icon-only buttons must be labelled for screen readers. */
  accessibilityLabel: string;
  size?: number;
  color?: string;
  filled?: boolean;
  /** Small count bubble in the corner; hidden when 0 or undefined. */
  badge?: number;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({ icon, size = 22, color, filled, badge, onPress, style, ...rest }: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={6}
      onPress={(e) => {
        haptics.tap();
        onPress?.(e);
      }}
      style={({ pressed }) => [
        styles.base,
        filled && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
        pressed && styles.pressed,
        rest.disabled && styles.disabled,
        style,
      ]}
      {...rest}>
      <Icon name={icon} size={size} color={color ?? colors.text} />
      {!!badge && (
        <View style={[styles.badge, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
          <ThemedText style={styles.badgeText}>{badge > 99 ? '99+' : badge}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: TouchTarget,
    height: TouchTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  badge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: '700' },
});
