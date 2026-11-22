import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/chip';
import { ErrorState } from '@/components/error-state';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { ReviewItem } from '@/components/review-item';
import { Sheet } from '@/components/sheet';
import { Skeleton } from '@/components/skeleton';
import { ThemedText } from '@/components/themed-text';
import { TypingIndicator } from '@/components/typing-indicator';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, NOT_GROUNDED_ANSWER } from '@/lib/api';
import * as haptics from '@/lib/haptics';
import { useProduct } from '@/lib/queries';
import type { ChatMessage, Product, Review } from '@/types';

const SUGGESTIONS: Record<string, string[]> = {
  smartphones: ['How is the battery?', 'Is it good for gaming?', 'What do buyers complain about?'],
  laptops: ['How is the battery life?', 'Is it good for work?', 'What do buyers complain about?'],
  'mens-shirts': ['Does it run true to size?', 'Does the colour fade?', 'What do buyers complain about?'],
  'womens-bags': ['Does it fit a laptop?', 'Is the strap comfortable?', 'What do buyers complain about?'],
  'kitchen-accessories': ['Is it easy to clean?', 'Is it sturdy?', 'What do buyers complain about?'],
  beauty: ['Is it good for sensitive skin?', 'How long does it last?', 'What do buyers complain about?'],
  'skin-care': ['Is it good for sensitive skin?', 'Is the texture greasy?', 'What do buyers complain about?'],
};
const DEFAULT_SUGGESTIONS = ['What is the warranty?', 'What is the return policy?', 'What do buyers complain about?'];

let nextId = 0;
const newId = () => `m${Date.now()}-${nextId++}`;

export default function AskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isPending, isError, refetch } = useProduct(id);
  const { colors } = useTheme();

  return (
    // iOS presents this as a page sheet (no top inset needed); Android shows it full screen.
    <SafeAreaView
      edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}
      style={[styles.flex, { backgroundColor: colors.background }]}>
      {isError ? (
        <>
          <Header product={undefined} />
          <ErrorState onRetry={refetch} />
        </>
      ) : isPending ? (
        <>
          <Header product={undefined} />
          <View style={styles.loading}>
            <Skeleton height={60} radius={Radius.lg} width="70%" />
            <Skeleton height={40} radius={Radius.lg} width="50%" />
          </View>
        </>
      ) : (
        <Chat product={product} />
      )}
    </SafeAreaView>
  );
}

function Header({ product }: { product: Product | undefined }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.header, { borderBottomColor: colors.border }]}>
      {product ? (
        <Image source={product.thumbnail} style={[styles.headerThumb, { backgroundColor: colors.surfaceAlt }]} contentFit="contain" accessible={false} />
      ) : (
        <View style={[styles.headerThumb, { backgroundColor: colors.surfaceAlt }]} />
      )}
      <View style={styles.flex}>
        <View style={styles.headerTitleRow}>
          <Icon name={{ ios: 'sparkles', android: 'auto_awesome' }} size={14} color={colors.primary} />
          <ThemedText variant="caption" color="primary" style={styles.bold}>
            Ask AI
          </ThemedText>
        </View>
        <ThemedText variant="subheading" numberOfLines={1} accessibilityRole="header">
          {product?.title ?? 'Loading…'}
        </ThemedText>
      </View>
      <IconButton icon={{ ios: 'xmark', android: 'close' }} accessibilityLabel="Close" onPress={() => router.back()} />
    </View>
  );
}

function Chat({ product }: { product: Product }) {
  const { colors } = useTheme();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [openReview, setOpenReview] = useState<Review | null>(null);

  const suggestions = SUGGESTIONS[product.category] ?? DEFAULT_SUGGESTIONS;
  const reviewsById = new Map(product.reviews.map((r) => [r.id, r]));

  const ask = async (text: string) => {
    const question = text.trim();
    if (!question || loading) return;
    haptics.tap();
    const userMessage: ChatMessage = { id: newId(), role: 'user', text: question };
    const history = messages;
    setMessages((m) => [...m, userMessage]);
    setInput('');
    setFailed(null);
    setLoading(true);
    try {
      const res = await api.ask(product.id, question, history);
      setMessages((m) => [
        ...m,
        {
          id: newId(),
          role: 'assistant',
          // Never show model text for an ungrounded answer: use the fixed refusal.
          text: res.grounded ? res.answer : NOT_GROUNDED_ANSWER,
          grounded: res.grounded,
          citations: res.citations,
        },
      ]);
    } catch {
      setFailed(question);
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    if (!failed) return;
    setMessages((m) => m.slice(0, -1));
    void ask(failed);
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <Header product={product} />
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View style={styles.intro}>
            <ThemedText color="textSecondary">
              Ask anything about this product. Answers come only from its details and buyer reviews. If something
              isn&apos;t covered, I&apos;ll say so instead of guessing.
            </ThemedText>
            <View style={styles.suggestions}>
              {suggestions.map((q) => (
                <Chip key={q} label={q} onPress={() => ask(q)} />
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <MessageBubble message={item} reviewsById={reviewsById} onOpenReview={setOpenReview} />
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            {loading && <TypingIndicator />}
            {failed && (
              <Pressable
                onPress={retry}
                accessibilityRole="button"
                accessibilityLabel="Couldn't get an answer. Tap to retry"
                style={[styles.errorBubble, { borderColor: colors.danger }]}>
                <Icon name={{ ios: 'exclamationmark.triangle', android: 'warning' }} size={16} color={colors.danger} />
                <ThemedText variant="caption" color="danger" style={styles.flex}>
                  Couldn&apos;t reach the assistant. Tap to retry.
                </ThemedText>
              </Pressable>
            )}
          </View>
        }
      />
      <View style={[styles.composer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <TextInput
          ref={inputRef}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about this product"
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={300}
          accessibilityLabel="Your question"
          style={[Typography.body, styles.input, { color: colors.text, backgroundColor: colors.surfaceAlt }]}
        />
        <IconButton
          icon={{ ios: 'arrow.up', android: 'send' }}
          color={colors.primaryText}
          accessibilityLabel="Send question"
          disabled={!input.trim() || loading}
          onPress={() => ask(input)}
          style={[styles.send, { backgroundColor: colors.primary }]}
        />
      </View>

      <Sheet visible={!!openReview} onClose={() => setOpenReview(null)} title="Cited review">
        {openReview && <ReviewItem review={openReview} />}
      </Sheet>
    </KeyboardAvoidingView>
  );
}

type MessageBubbleProps = {
  message: ChatMessage;
  reviewsById: Map<string, Review>;
  onOpenReview: (review: Review) => void;
};

function MessageBubble({ message, reviewsById, onOpenReview }: MessageBubbleProps) {
  const { colors } = useTheme();

  if (message.role === 'user') {
    return (
      <Animated.View entering={FadeInDown.duration(200)} style={[styles.bubble, styles.user, { backgroundColor: colors.primary }]}>
        <ThemedText style={{ color: colors.primaryText }}>{message.text}</ThemedText>
      </Animated.View>
    );
  }

  if (!message.grounded) {
    return (
      <Animated.View
        entering={FadeInDown.duration(200)}
        style={[styles.bubble, styles.assistant, styles.notGrounded, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
        accessibilityLabel={`Not in the product information. ${message.text}`}>
        <Icon name={{ ios: 'info.circle', android: 'info' }} size={16} color={colors.textSecondary} />
        <ThemedText color="textSecondary" style={styles.flex}>
          {message.text}
        </ThemedText>
      </Animated.View>
    );
  }

  const cited = (message.citations ?? []).flatMap((id) => {
    const r = reviewsById.get(id);
    return r ? [r] : [];
  });

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      style={[styles.bubble, styles.assistant, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ThemedText>{message.text}</ThemedText>
      <View style={styles.sourceRow}>
        <Icon name={{ ios: 'checkmark.seal', android: 'verified' }} size={14} color={colors.success} />
        <ThemedText variant="caption" color="textSecondary">
          {cited.length
            ? `Based on product details and ${cited.length} review${cited.length === 1 ? '' : 's'}`
            : 'Based on product details'}
        </ThemedText>
      </View>
      {cited.length > 0 && (
        <View style={styles.citations}>
          {cited.map((r) => (
            <Chip
              key={r.id}
              label={`${r.reviewerName.split(' ')[0]} · ${r.rating}★`}
              onPress={() => onOpenReview(r)}
            />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '700' },
  loading: { padding: Spacing.lg, gap: Spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerThumb: { width: 40, height: 40, borderRadius: Radius.sm },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  messages: { padding: Spacing.lg, gap: Spacing.md, flexGrow: 1 },
  intro: { gap: Spacing.md, marginBottom: Spacing.sm },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  bubble: { maxWidth: '85%', padding: Spacing.md, borderRadius: Radius.lg, gap: Spacing.sm },
  user: { alignSelf: 'flex-end', borderBottomRightRadius: Radius.sm },
  assistant: { alignSelf: 'flex-start', borderBottomLeftRadius: Radius.sm, borderWidth: StyleSheet.hairlineWidth },
  notGrounded: { flexDirection: 'row', alignItems: 'flex-start', borderStyle: 'dashed', borderWidth: 1 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  citations: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  footer: { gap: Spacing.md },
  errorBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    minHeight: TouchTarget,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: TouchTarget,
    maxHeight: 120,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
  },
  send: { borderRadius: Radius.pill },
});
