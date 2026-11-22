import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { EmptyState } from '@/components/empty-state';
import { FilterSheet } from '@/components/filter-sheet';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { ProductGrid } from '@/components/product-grid';
import { Screen } from '@/components/screen';
import { SortSheet } from '@/components/sort-sheet';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { describeSearch, filterChips, hasActiveFilters, sortLabel } from '@/lib/filters';
import * as haptics from '@/lib/haptics';
import { useCategories, useProductGrid } from '@/lib/queries';
import { useSettingsStore, type SavedFilter } from '@/store/settings';
import type { ProductSort, SearchFilters } from '@/types';

type Filters = Omit<SearchFilters, 'search' | 'sort'>;

export default function SearchScreen() {
  const { colors } = useTheme();
  // `q` comes from deep links: shopassist://search?q=phone
  const { focus, q } = useLocalSearchParams<{ focus?: string; q?: string }>();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [input, setInput] = useState('');
  // In plain-words mode the query only changes on submit, so it is tracked separately.
  const [submitted, setSubmitted] = useState('');
  const [filters, setFilters] = useState<Filters>({});
  const [sort, setSort] = useState<ProductSort>('relevance');
  const [plainWords, setPlainWords] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'filters' | 'sort' | null>(null);

  // Apply a new `q` once (adjusting state during render, not in an effect).
  const [linkedQuery, setLinkedQuery] = useState<string | undefined>(undefined);
  if (q !== undefined && q !== linkedQuery) {
    setLinkedQuery(q);
    setInput(q);
    setSubmitted(q.trim());
    setExplanation(null);
  }

  const debounced = useDebouncedValue(input.trim(), 300);
  // Typing searches after the debounce; pressing Search applies the text immediately.
  const query = plainWords ? submitted : submitted === input.trim() ? submitted : debounced;

  const categories = useCategories();
  const recentSearches = useSettingsStore((s) => s.recentSearches);
  const savedFilters = useSettingsStore((s) => s.savedFilters);
  const addRecentSearch = useSettingsStore((s) => s.addRecentSearch);
  const clearRecentSearches = useSettingsStore((s) => s.clearRecentSearches);
  const saveFilter = useSettingsStore((s) => s.saveFilter);
  const removeFilter = useSettingsStore((s) => s.removeFilter);

  const active = !!query || hasActiveFilters(filters);
  const grid = useProductGrid({ ...filters, search: query || undefined, sort });
  const chips = filterChips(filters, categories.data);
  const currentSearch: SearchFilters = { ...filters, search: query || undefined, sort };
  const alreadySaved = savedFilters.some((s) => JSON.stringify(s.filters) === JSON.stringify(currentSearch));

  // Opened from Home's search bar: focus the input (param changes on every tap).
  useEffect(() => {
    if (!focus) return;
    const id = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(id);
  }, [focus]);

  const runSearch = async (text = input) => {
    const q = text.trim();
    haptics.tap();
    if (q) addRecentSearch(q);
    if (!plainWords || !q) {
      setSubmitted(q);
      setInput(q);
      setExplanation(null);
      return;
    }
    setParsing(true);
    try {
      const { filters: parsed, explanation: why } = await api.parseSearch(q);
      const { search, sort: parsedSort, ...rest } = parsed;
      setFilters(rest);
      setSubmitted(search ?? '');
      if (parsedSort) setSort(parsedSort);
      setExplanation(why);
    } catch {
      // Fall back to a plain keyword search rather than failing.
      setSubmitted(q);
      setExplanation(null);
    } finally {
      setParsing(false);
      inputRef.current?.blur();
    }
  };

  const clearAll = () => {
    setFilters({});
    setExplanation(null);
  };

  const applySaved = (saved: SavedFilter) => {
    const { search, sort: savedSort, ...rest } = saved.filters;
    setInput(search ?? '');
    setSubmitted(search ?? '');
    setFilters(rest);
    setSort(savedSort ?? 'relevance');
    setExplanation(null);
  };

  const resultsTitle = query ? `Results for "${query}"` : 'Filtered results';
  const count = grid.total;

  const resultsHeader = (
    <View style={styles.resultsHeader}>
      {explanation && (
        <Animated.View entering={FadeInDown} style={[styles.explanation, { backgroundColor: colors.primarySoft }]}>
          <Icon name={{ ios: 'sparkles', android: 'auto_awesome' }} size={16} color={colors.primary} />
          <ThemedText variant="caption" style={[styles.flex, { color: colors.primary }]}>
            {explanation}
          </ThemedText>
        </Animated.View>
      )}
      <View style={styles.resultsRow}>
        <ThemedText variant="subheading" numberOfLines={2} style={styles.flex} accessibilityRole="header">
          {resultsTitle}
          {count !== undefined && (
            <ThemedText color="textSecondary">
              {' '}
              · {count} item{count === 1 ? '' : 's'}
            </ThemedText>
          )}
        </ThemedText>
      </View>
      <View style={styles.toolbar}>
        <ToolbarButton
          icon={{ ios: 'arrow.up.arrow.down', android: 'swap_vert' }}
          label={sortLabel(sort)}
          onPress={() => setSheet('sort')}
          a11y={`Sort, currently ${sortLabel(sort)}`}
        />
        <ToolbarButton
          icon={{ ios: 'slider.horizontal.3', android: 'tune' }}
          label={chips.length ? `Filters (${chips.length})` : 'Filters'}
          onPress={() => setSheet('filters')}
          a11y={`Filters, ${chips.length} active`}
        />
        {!alreadySaved && (
          <ToolbarButton
            icon={{ ios: 'bookmark', android: 'bookmark_border' }}
            label="Save"
            a11y="Save this search"
            onPress={() => {
              saveFilter(describeSearch(currentSearch, categories.data), currentSearch);
              haptics.success();
            }}
          />
        )}
      </View>
    </View>
  );

  const popularCategories = (
    <View style={styles.chipWrap}>
      {categories.data?.map((c) => (
        <Chip
          key={c.slug}
          label={c.name}
          onPress={() => router.push({ pathname: '/category/[slug]', params: { slug: c.slug } })}
        />
      ))}
    </View>
  );

  return (
    <Screen>
      <View style={styles.top}>
        <View style={styles.inputRow}>
          <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name={{ ios: 'magnifyingglass', android: 'search' }} size={18} color={colors.textSecondary} />
            <TextInput
              ref={inputRef}
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => runSearch()}
              placeholder={plainWords ? 'e.g. gift for dad who cooks under ₹2000' : 'Search products'}
              placeholderTextColor={colors.textSecondary}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel="Search products"
              style={[Typography.body, styles.input, { color: colors.text }]}
            />
            {!!input && (
              <IconButton
                icon={{ ios: 'xmark.circle.fill', android: 'cancel' }}
                size={18}
                color={colors.textSecondary}
                accessibilityLabel="Clear search text"
                onPress={() => {
                  setInput('');
                  setSubmitted('');
                  setExplanation(null);
                  inputRef.current?.focus();
                }}
              />
            )}
          </View>
          <Button title="Search" onPress={() => runSearch()} loading={parsing} style={styles.searchButton} />
        </View>

        <View style={styles.toggleRow}>
          <Icon name={{ ios: 'sparkles', android: 'auto_awesome' }} size={16} color={colors.primary} />
          <ThemedText style={styles.flex}>Search in plain words</ThemedText>
          <Switch
            value={plainWords}
            onValueChange={(on) => {
              setPlainWords(on);
              setSubmitted(on ? '' : input.trim());
              setExplanation(null);
            }}
            trackColor={{ true: colors.primary, false: colors.border }}
            thumbColor={colors.surface}
            accessibilityLabel="Search in plain words"
          />
        </View>

        {chips.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeChips}>
            {chips.map((c) => (
              <Chip key={c.key} label={c.label} selected onRemove={() => setFilters((f) => c.remove(f))} />
            ))}
            <Chip label="Clear all" onPress={clearAll} />
          </ScrollView>
        )}
      </View>

      {active ? (
        <ProductGrid
          {...grid}
          ListHeaderComponent={resultsHeader}
          ListEmptyComponent={
            <View>
              <EmptyState
                title="No matches"
                message={
                  chips.length
                    ? 'Try removing a filter, or search for something broader.'
                    : 'Try a different word, or browse a category.'
                }
                icon={{ ios: 'magnifyingglass', android: 'search_off' }}
                action={chips.length ? { label: 'Clear filters', onPress: clearAll } : undefined}
              />
              <ThemedText variant="subheading" style={styles.sectionTitle}>
                Popular categories
              </ThemedText>
              {popularCategories}
            </View>
          }
        />
      ) : (
        <ScrollView contentContainerStyle={styles.idle} keyboardShouldPersistTaps="handled">
          {savedFilters.length > 0 && (
            <Animated.View entering={FadeIn} style={styles.idleSection}>
              <ThemedText variant="subheading" accessibilityRole="header">
                Saved searches
              </ThemedText>
              <View style={styles.chipWrap}>
                {savedFilters.map((s) => (
                  <View key={s.id} style={[styles.savedChip, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                    <Pressable
                      onPress={() => applySaved(s)}
                      accessibilityRole="button"
                      accessibilityLabel={`Run saved search ${s.name}`}
                      style={styles.savedLabel}>
                      <Icon name={{ ios: 'bookmark.fill', android: 'bookmark' }} size={14} color={colors.primary} />
                      <ThemedText variant="caption" numberOfLines={1} style={styles.savedText}>
                        {s.name}
                      </ThemedText>
                    </Pressable>
                    <IconButton
                      icon={{ ios: 'xmark', android: 'close' }}
                      size={12}
                      color={colors.textSecondary}
                      accessibilityLabel={`Delete saved search ${s.name}`}
                      onPress={() => removeFilter(s.id)}
                      style={styles.savedRemove}
                    />
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {recentSearches.length > 0 && (
            <Animated.View entering={FadeIn} style={styles.idleSection}>
              <View style={styles.resultsRow}>
                <ThemedText variant="subheading" style={styles.flex} accessibilityRole="header">
                  Recent searches
                </ThemedText>
                <Pressable
                  onPress={clearRecentSearches}
                  accessibilityRole="button"
                  accessibilityLabel="Clear all recent searches"
                  style={styles.textButton}>
                  <ThemedText variant="subheading" color="primary">
                    Clear all
                  </ThemedText>
                </Pressable>
              </View>
              {recentSearches.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => {
                    setInput(q);
                    void runSearch(q);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Search again for ${q}`}
                  style={({ pressed }) => [styles.recentRow, pressed && { opacity: 0.6 }]}>
                  <Icon name={{ ios: 'clock.arrow.circlepath', android: 'history' }} size={18} color={colors.textSecondary} />
                  <ThemedText style={styles.flex} numberOfLines={1}>
                    {q}
                  </ThemedText>
                  <Icon name={{ ios: 'arrow.up.left', android: 'north_west' }} size={14} color={colors.textSecondary} />
                </Pressable>
              ))}
            </Animated.View>
          )}

          <View style={styles.idleSection}>
            <ThemedText variant="subheading" accessibilityRole="header">
              Popular categories
            </ThemedText>
            {categories.isPending ? <ActivityIndicator color={colors.primary} /> : popularCategories}
          </View>
        </ScrollView>
      )}

      <SortSheet visible={sheet === 'sort'} value={sort} onChange={setSort} onClose={() => setSheet(null)} />
      <FilterSheet
        visible={sheet === 'filters'}
        filters={filters}
        categories={categories.data}
        onApply={(f) => {
          setFilters(f);
          setExplanation(null);
        }}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}

type ToolbarButtonProps = {
  icon: IconName;
  label: string;
  a11y: string;
  onPress: () => void;
};

function ToolbarButton({ icon, label, a11y, onPress }: ToolbarButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.toolbarButton,
        { borderColor: colors.border, backgroundColor: colors.surface },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size={16} color={colors.text} />
      <ThemedText variant="caption" numberOfLines={1} style={styles.toolbarLabel}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, gap: Spacing.sm },
  inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: TouchTarget + 4,
    paddingLeft: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
  },
  input: { flex: 1, paddingVertical: Spacing.sm },
  searchButton: { paddingHorizontal: Spacing.lg },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: TouchTarget },
  activeChips: { gap: Spacing.sm, paddingBottom: Spacing.xs },
  resultsHeader: { gap: Spacing.sm, marginBottom: Spacing.xs },
  resultsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  explanation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  toolbar: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.pill,
    maxWidth: 200,
  },
  toolbarLabel: { fontSize: 13, flexShrink: 1 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  sectionTitle: { marginBottom: Spacing.sm },
  idle: { padding: Spacing.lg, gap: Spacing.xl },
  idleSection: { gap: Spacing.sm },
  textButton: { minHeight: TouchTarget, justifyContent: 'center' },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: TouchTarget },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingLeft: Spacing.md,
    maxWidth: '100%',
  },
  savedLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, minHeight: 40, flexShrink: 1 },
  savedText: { fontSize: 13, flexShrink: 1 },
  savedRemove: { width: 36, height: 36 },
});
