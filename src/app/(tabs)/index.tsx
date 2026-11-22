import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Chip } from '@/components/chip';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { ProductGrid } from '@/components/product-grid';
import { ProductRow } from '@/components/product-row';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget } from '@/constants/theme';
import { PROMO } from '@/constants/promo';
import { useTheme } from '@/hooks/use-theme';
import { useCategories, useProductGrid, useProducts } from '@/lib/queries';
import { useSettingsStore } from '@/store/settings';
import { useWishlistStore } from '@/store/wishlist';
import type { Category } from '@/types';

const openCategory = (slug: string) => router.push({ pathname: '/category/[slug]', params: { slug } });

export default function HomeScreen() {
  const { colors } = useTheme();
  const name = useSettingsStore((s) => s.name);
  const wishlistCount = useWishlistStore((s) => s.ids.length);
  const popular = useProductGrid({ sort: 'rating' });
  const categories = useCategories();
  const sponsored = useProducts({ sponsored: true, limit: 10 });
  const sponsoredProducts = sponsored.data?.pages[0]?.items;

  const featured = categories.data?.reduce<Category | undefined>(
    (best, c) => ((c.avgDiscount ?? 0) > (best?.avgDiscount ?? -1) ? c : best),
    undefined,
  );

  const refresh = () => {
    popular.onRefresh();
    void categories.refetch();
    void sponsored.refetch();
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.greetingRow}>
        <View style={styles.flex}>
          <ThemedText variant="title" numberOfLines={1}>
            Hi{name ? `, ${name}` : ' there'}
          </ThemedText>
          <ThemedText color="textSecondary">What are you shopping for today?</ThemedText>
        </View>
        <IconButton
          icon={{ ios: 'heart', android: 'favorite_border' }}
          accessibilityLabel={`Wishlist, ${wishlistCount} item${wishlistCount === 1 ? '' : 's'}`}
          badge={wishlistCount}
          filled
          onPress={() => router.push('/wishlist')}
        />
      </View>

      <Pressable
        onPress={() => router.navigate({ pathname: '/search', params: { focus: String(Date.now()) } })}
        accessibilityRole="search"
        accessibilityLabel="Search products"
        style={({ pressed }) => [
          styles.searchBar,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && { opacity: 0.8 },
        ]}>
        <Icon name={{ ios: 'magnifyingglass', android: 'search' }} size={18} color={colors.textSecondary} />
        <ThemedText color="textSecondary">Search phones, bags, skincare…</ThemedText>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.bleed}>
        {categories.isPending
          ? [0, 1, 2, 3].map((i) => <Skeleton key={i} width={96} height={36} radius={Radius.pill} />)
          : categories.data?.map((c) => <Chip key={c.slug} label={c.name} onPress={() => openCategory(c.slug)} />)}
      </ScrollView>

      {featured?.maxDiscount ? (
        <Animated.View entering={FadeIn}>
          <Pressable
            onPress={() => openCategory(featured.slug)}
            accessibilityRole="button"
            accessibilityLabel={`Up to ${featured.maxDiscount} percent off on ${featured.name}. Shop now`}
            style={({ pressed }) => [styles.banner, { backgroundColor: colors.primary }, pressed && { opacity: 0.9 }]}>
            <View style={styles.bannerText}>
              <ThemedText variant="caption" style={[styles.bannerEyebrow, { color: colors.primaryText }]}>
                {PROMO.eyebrow}
              </ThemedText>
              <ThemedText variant="heading" style={{ color: colors.primaryText }}>
                Up to {featured.maxDiscount}% off on {featured.name}
              </ThemedText>
              <View style={[styles.bannerCta, { backgroundColor: colors.primaryText }]}>
                <ThemedText variant="caption" style={[styles.bannerCtaText, { color: colors.primary }]}>
                  Shop now
                </ThemedText>
              </View>
            </View>
            {featured.image && (
              <View style={[styles.bannerImageWrap, { backgroundColor: colors.surface }]}>
                <Image source={featured.image} style={styles.bannerImage} contentFit="contain" accessible={false} />
              </View>
            )}
          </Pressable>
        </Animated.View>
      ) : categories.isPending ? (
        <Skeleton height={132} radius={Radius.lg} />
      ) : null}

      {(sponsored.isPending || !!sponsoredProducts?.length) && (
        <View style={styles.section}>
          <SectionHeader title="Sponsored" subtitle="Paid placements from sellers" />
          <View style={styles.bleed}>
            <ProductRow products={sponsoredProducts} loading={sponsored.isPending} />
          </View>
        </View>
      )}

      <SectionHeader title="Popular" subtitle="Top rated by buyers" />
    </View>
  );

  return (
    <Screen>
      <ProductGrid {...popular} onRefresh={refresh} ListHeaderComponent={header} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { gap: Spacing.lg, marginBottom: Spacing.xs },
  greetingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    minHeight: TouchTarget + 4,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  // Lets horizontal rows scroll edge to edge inside the padded list.
  bleed: { marginHorizontal: -Spacing.lg },
  chips: { gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  bannerText: { flex: 1, gap: Spacing.xs },
  bannerEyebrow: { fontWeight: '700', letterSpacing: 1, opacity: 0.85 },
  bannerCta: {
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
  },
  bannerCtaText: { fontWeight: '700' },
  bannerImageWrap: { width: 96, height: 96, borderRadius: Radius.md, padding: Spacing.xs },
  bannerImage: { flex: 1 },
  section: { gap: Spacing.md },
});
