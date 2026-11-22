import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { BottomBar } from '@/components/bottom-bar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { Icon, type IconName } from '@/components/icon';
import { PriceBreakdownCard } from '@/components/price-breakdown-card';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPrice } from '@/lib/format';
import * as haptics from '@/lib/haptics';
import { getPriceBreakdown } from '@/lib/pricing';
import { useCreateOrder } from '@/lib/queries';
import { useCartLines, useCartStore } from '@/store/cart';
import { useSettingsStore } from '@/store/settings';
import type { Address } from '@/types';

type Field = keyof Address;

const EMPTY: Address = { name: '', phone: '', line1: '', city: '', pincode: '' };

function validate(a: Address): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (a.name.trim().length < 2) errors.name = 'Enter the full name';
  if (!/^[6-9]\d{9}$/.test(a.phone)) errors.phone = 'Enter a valid 10-digit mobile number';
  if (a.line1.trim().length < 5) errors.line1 = 'Enter house number, street and area';
  if (a.city.trim().length < 2) errors.city = 'Enter the city';
  if (!/^[1-9]\d{5}$/.test(a.pincode)) errors.pincode = 'Enter a valid 6-digit pincode';
  return errors;
}

export default function CheckoutScreen() {
  const { colors } = useTheme();
  const headerHeight = useHeaderHeight();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const phoneRef = useRef<ComponentRef<typeof TextInput>>(null);
  const line1Ref = useRef<ComponentRef<typeof TextInput>>(null);
  const cityRef = useRef<ComponentRef<typeof TextInput>>(null);
  const pincodeRef = useRef<ComponentRef<typeof TextInput>>(null);

  const lines = useCartLines();
  const clearCart = useCartStore((s) => s.clear);
  const deviceId = useSettingsStore((s) => s.deviceId);
  const lastAddress = useSettingsStore((s) => s.lastAddress);
  const setLastAddress = useSettingsStore((s) => s.setLastAddress);
  const createOrder = useCreateOrder();

  const [address, setAddress] = useState<Address>(lastAddress ?? EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);

  const errors = validate(address);
  const valid = Object.keys(errors).length === 0;
  const errorFor = (f: Field) => ((submitted || touched[f]) && errors[f]) || null;

  const itemCount = lines.reduce((n, l) => n + l.qty, 0);
  const breakdown = getPriceBreakdown(lines.map((l) => ({ price: l.product.price, qty: l.qty })));

  const set = (f: Field) => (value: string) => setAddress((a) => ({ ...a, [f]: value }));
  const blur = (f: Field) => () => setTouched((t) => ({ ...t, [f]: true }));
  const digits = (f: Field, max: number) => (v: string) => set(f)(v.replace(/\D/g, '').slice(0, max));

  const placeOrder = () => {
    setSubmitted(true);
    if (!valid) {
      haptics.warning();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    const clean: Address = {
      name: address.name.trim(),
      phone: address.phone,
      line1: address.line1.trim(),
      city: address.city.trim(),
      pincode: address.pincode,
    };
    createOrder.mutate(
      {
        deviceId,
        address: clean,
        items: lines.map((l) => ({
          productId: l.productId,
          title: l.product.title,
          qty: l.qty,
          price: l.product.price,
          thumbnail: l.product.thumbnail,
        })),
      },
      {
        onSuccess: (order) => {
          haptics.success();
          setLastAddress(clean);
          router.replace({ pathname: '/order/[id]', params: { id: order.id, placed: '1' } });
          clearCart();
        },
        onError: () => haptics.warning(),
      },
    );
  };

  if (lines.length === 0 && !createOrder.isSuccess) {
    return (
      <Screen edges={[]}>
        <EmptyState
          title="Your cart is empty"
          message="Add something to your cart to check out."
          icon={{ ios: 'cart', android: 'shopping_cart' }}
          action={{ label: 'Start shopping', onPress: () => router.navigate('/') }}
        />
      </Screen>
    );
  }

  return (
    <Screen edges={[]}>
      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={headerHeight} style={styles.flex}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Section title="Delivery address" icon={{ ios: 'mappin.and.ellipse', android: 'location_on' }}>
            <Card>
              <TextField
                label="Full name"
                value={address.name}
                onChangeText={set('name')}
                onBlur={blur('name')}
                error={errorFor('name')}
                autoComplete="name"
                textContentType="name"
                returnKeyType="next"
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
              <TextField
                ref={phoneRef}
                label="Mobile number"
                value={address.phone}
                onChangeText={digits('phone', 10)}
                onBlur={blur('phone')}
                error={errorFor('phone')}
                keyboardType="phone-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                placeholder="10-digit number"
                returnKeyType="next"
                onSubmitEditing={() => line1Ref.current?.focus()}
              />
              <TextField
                ref={line1Ref}
                label="Address (house no., street, area)"
                value={address.line1}
                onChangeText={set('line1')}
                onBlur={blur('line1')}
                error={errorFor('line1')}
                autoComplete="street-address"
                textContentType="fullStreetAddress"
                returnKeyType="next"
                onSubmitEditing={() => cityRef.current?.focus()}
              />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <TextField
                    ref={cityRef}
                    label="City"
                    value={address.city}
                    onChangeText={set('city')}
                    onBlur={blur('city')}
                    error={errorFor('city')}
                    textContentType="addressCity"
                    returnKeyType="next"
                    onSubmitEditing={() => pincodeRef.current?.focus()}
                  />
                </View>
                <View style={styles.flex}>
                  <TextField
                    ref={pincodeRef}
                    label="Pincode"
                    value={address.pincode}
                    onChangeText={digits('pincode', 6)}
                    onBlur={blur('pincode')}
                    error={errorFor('pincode')}
                    keyboardType="number-pad"
                    autoComplete="postal-code"
                    textContentType="postalCode"
                    returnKeyType="done"
                  />
                </View>
              </View>
            </Card>
          </Section>

          <Section title="Order summary" icon={{ ios: 'bag', android: 'shopping_bag' }}>
            <Card>
              {lines.map((l) => (
                <View key={l.productId} style={styles.item}>
                  <Image source={l.product.thumbnail} style={[styles.thumb, { backgroundColor: colors.surfaceAlt }]} contentFit="contain" accessible={false} />
                  <View style={styles.flex}>
                    <ThemedText numberOfLines={2}>{l.product.title}</ThemedText>
                    <ThemedText variant="caption" color="textSecondary">
                      Qty {l.qty} × {formatPrice(l.product.price)}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.itemTotal}>{formatPrice(l.product.price * l.qty)}</ThemedText>
                </View>
              ))}
            </Card>
            <PriceBreakdownCard breakdown={breakdown} itemCount={itemCount} />
          </Section>

          <Section title="Payment" icon={{ ios: 'creditcard', android: 'credit_card' }}>
            <View
              style={[styles.payment, { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}
              accessibilityRole="radio"
              accessibilityState={{ selected: true }}
              accessibilityLabel="Demo payment, no money is charged">
              <Icon name={{ ios: 'largecircle.fill.circle', android: 'radio_button_checked' }} size={20} color={colors.primary} />
              <View style={styles.flex}>
                <ThemedText variant="subheading">Demo payment</ThemedText>
                <ThemedText variant="caption" color="textSecondary">
                  No money is charged
                </ThemedText>
              </View>
            </View>
          </Section>

          {createOrder.isError && (
            <Animated.View entering={FadeIn} style={[styles.error, { borderColor: colors.danger }]} accessibilityRole="alert">
              <Icon name={{ ios: 'exclamationmark.triangle', android: 'warning' }} size={18} color={colors.danger} />
              <ThemedText color="danger" style={styles.flex}>
                Couldn&apos;t place your order. Nothing was charged. Please try again.
              </ThemedText>
            </Animated.View>
          )}
        </ScrollView>

        <BottomBar>
          <View style={styles.flex}>
            <ThemedText variant="caption" color="textSecondary">
              Total to pay
            </ThemedText>
            <ThemedText variant="price">{formatPrice(breakdown.total)}</ThemedText>
          </View>
          <Button title="Place order" onPress={placeOrder} loading={createOrder.isPending} style={styles.placeButton} />
        </BottomBar>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconName;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitle}>
        <Icon name={icon} size={18} color={colors.primary} />
        <ThemedText variant="subheading" accessibilityRole="header">
          {title}
        </ThemedText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: Spacing.lg, gap: Spacing.xl, paddingBottom: Spacing.xxl },
  section: { gap: Spacing.md },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  thumb: { width: 48, height: 48, borderRadius: Radius.sm },
  itemTotal: { fontWeight: '600', fontVariant: ['tabular-nums'] },
  payment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  placeButton: { paddingHorizontal: Spacing.xl },
});
