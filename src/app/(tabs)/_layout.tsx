import { NativeTabs } from 'expo-router/native-tabs';
import { useMemo } from 'react';

import { useTheme } from '@/hooks/use-theme';
import { useCartCount } from '@/store/cart';

// Friendly "Something went wrong · Try again" screen instead of a red crash.
export { ErrorFallback as ErrorBoundary } from '@/components/error-fallback';

// Static icon configs live at module scope so NativeTabs never sees new objects for them.
const ICONS = {
  home: { sf: { default: 'house', selected: 'house.fill' }, md: 'home' },
  search: { sf: 'magnifyingglass', md: 'search' },
  cart: { sf: { default: 'cart', selected: 'cart.fill' }, md: 'shopping_cart' },
  orders: { sf: { default: 'shippingbox', selected: 'shippingbox.fill' }, md: 'receipt_long' },
  profile: { sf: { default: 'person', selected: 'person.fill' }, md: 'person' },
} as const;

export default function TabsLayout() {
  const { colors } = useTheme();
  const cartCount = useCartCount();
  // A primitive: the triggers below only rebuild when the visible badge text changes.
  const cartBadge = cartCount === 0 ? null : cartCount > 99 ? '99+' : String(cartCount);

  // `colors` is a module-level object per scheme, so these only change with the theme.
  const labelStyle = useMemo(
    () => ({ default: { color: colors.textSecondary }, selected: { color: colors.primary } }),
    [colors],
  );
  const iconColor = useMemo(() => ({ default: colors.textSecondary, selected: colors.primary }), [colors]);

  const triggers = useMemo(
    () => [
      <NativeTabs.Trigger key="index" name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={ICONS.home.sf} md={ICONS.home.md} />
      </NativeTabs.Trigger>,
      <NativeTabs.Trigger key="search" name="search">
        <NativeTabs.Trigger.Label>Search</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={ICONS.search.sf} md={ICONS.search.md} />
      </NativeTabs.Trigger>,
      <NativeTabs.Trigger key="cart" name="cart">
        <NativeTabs.Trigger.Label>Cart</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={ICONS.cart.sf} md={ICONS.cart.md} />
        {/* Any truthy child shows the badge (even "0"), so children are passed only when visible. */}
        <NativeTabs.Trigger.Badge hidden={cartBadge === null}>{cartBadge ?? undefined}</NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>,
      <NativeTabs.Trigger key="orders" name="orders">
        <NativeTabs.Trigger.Label>Orders</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={ICONS.orders.sf} md={ICONS.orders.md} />
      </NativeTabs.Trigger>,
      <NativeTabs.Trigger key="profile" name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={ICONS.profile.sf} md={ICONS.profile.md} />
      </NativeTabs.Trigger>,
    ],
    [cartBadge],
  );

  return (
    <NativeTabs
      tintColor={colors.primary}
      backgroundColor={colors.surface}
      indicatorColor={colors.primarySoft}
      badgeBackgroundColor={colors.danger}
      labelStyle={labelStyle}
      iconColor={iconColor}>
      {triggers}
    </NativeTabs>
  );
}
