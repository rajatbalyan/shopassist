import type { ComponentRef, Ref } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextFieldProps = Omit<TextInputProps, 'ref'> & {
  ref?: Ref<ComponentRef<typeof TextInput>>;
  label: string;
  /** Inline validation message; also announced to screen readers. */
  error?: string | null;
};

export function TextField({ label, error, style, ref, ...rest }: TextFieldProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <ThemedText variant="caption" color="textSecondary">
        {label}
      </ThemedText>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? undefined}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          Typography.body,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
          style,
        ]}
        {...rest}
      />
      {error && (
        <ThemedText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.xs },
  input: {
    minHeight: TouchTarget + 4,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
