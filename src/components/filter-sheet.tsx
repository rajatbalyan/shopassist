import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { Sheet } from '@/components/sheet';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { joinCategories, parseCategories, PRICE_PRESETS, RATING_OPTIONS } from '@/lib/filters';
import type { Category, SearchFilters } from '@/types';

type FilterSheetProps = {
  visible: boolean;
  filters: SearchFilters;
  categories: Category[] | undefined;
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
};

/** Category / price / rating filters. Mounted only while open so each opening starts fresh. */
export function FilterSheet(props: FilterSheetProps) {
  return props.visible ? <FilterSheetContent {...props} /> : null;
}

const toNumber = (text: string) => {
  const n = parseInt(text.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
};

function FilterSheetContent({ filters, categories, onApply, onClose }: FilterSheetProps) {
  const [selected, setSelected] = useState(() => parseCategories(filters.category));
  const [minPrice, setMinPrice] = useState(filters.minPrice);
  const [maxPrice, setMaxPrice] = useState(filters.maxPrice);
  const [minRating, setMinRating] = useState(filters.minRating);
  const priceError = minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice ? 'Min must be below max' : null;

  const toggleCategory = (slug: string) =>
    setSelected((s) => (s.includes(slug) ? s.filter((x) => x !== slug) : [...s, slug]));

  const apply = () => {
    onApply({ ...filters, category: joinCategories(selected), minPrice, maxPrice, minRating });
    onClose();
  };

  const clear = () => {
    setSelected([]);
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setMinRating(undefined);
  };

  return (
    <Sheet
      visible
      onClose={onClose}
      title="Filters"
      footer={
        <>
          <Button title="Clear" variant="ghost" onPress={clear} style={styles.flex} />
          <Button title="Show results" onPress={apply} disabled={!!priceError} style={styles.flex} />
        </>
      }>
      <Section title="Category">
        <View style={styles.chips}>
          {categories?.map((c) => (
            <Chip key={c.slug} label={c.name} selected={selected.includes(c.slug)} onPress={() => toggleCategory(c.slug)} />
          ))}
        </View>
      </Section>

      <Section title="Price">
        <View style={styles.chips}>
          {PRICE_PRESETS.map((p) => (
            <Chip
              key={p.label}
              label={p.label}
              selected={minPrice === p.min && maxPrice === p.max}
              onPress={() => {
                const active = minPrice === p.min && maxPrice === p.max;
                setMinPrice(active ? undefined : p.min);
                setMaxPrice(active ? undefined : p.max);
              }}
            />
          ))}
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label="Min (₹)"
              keyboardType="number-pad"
              placeholder="0"
              value={minPrice?.toString() ?? ''}
              onChangeText={(t) => setMinPrice(toNumber(t))}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label="Max (₹)"
              keyboardType="number-pad"
              placeholder="Any"
              value={maxPrice?.toString() ?? ''}
              onChangeText={(t) => setMaxPrice(toNumber(t))}
              error={priceError}
            />
          </View>
        </View>
      </Section>

      <Section title="Customer rating">
        <View style={styles.chips}>
          {RATING_OPTIONS.map((r) => (
            <Chip
              key={r}
              label={`${r}★ & up`}
              selected={minRating === r}
              onPress={() => setMinRating(minRating === r ? undefined : r)}
            />
          ))}
        </View>
      </Section>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText variant="subheading" accessibilityRole="header">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md },
});
