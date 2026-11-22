import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ZoomableImage } from '@/components/zoomable-image';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ImageCarouselProps = { images: string[]; title: string };

/** Paging image carousel with dots and a thumbnail strip. */
export function ImageCarousel({ images, title }: ImageCarouselProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);

  const goTo = (i: number) => {
    setIndex(i);
    listRef.current?.scrollToIndex({ index: i, animated: true });
  };

  return (
    <View style={{ backgroundColor: colors.surfaceAlt }}>
      <FlatList
        ref={listRef}
        data={images}
        keyExtractor={(uri, i) => `${i}-${uri}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item, index: i }) => (
          <View style={{ width, height: width * 0.9 }}>
            <ZoomableImage
              source={item}
              style={styles.image}
              accessibilityLabel={`${title}, image ${i + 1} of ${images.length}`}
            />
          </View>
        )}
      />
      {images.length > 1 && (
        <>
          <View style={styles.dots} accessibilityLabel={`Image ${index + 1} of ${images.length}`}>
            {images.map((uri, i) => (
              <View
                key={`dot-${i}-${uri}`}
                style={[styles.dot, { backgroundColor: i === index ? colors.primary : colors.border }, i === index && styles.dotActive]}
              />
            ))}
          </View>
          <FlatList
            data={images}
            horizontal
            keyExtractor={(uri, i) => `thumb-${i}-${uri}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbs}
            style={{ backgroundColor: colors.background }}
            renderItem={({ item, index: i }) => (
              <Pressable
                onPress={() => goTo(i)}
                accessibilityRole="button"
                accessibilityLabel={`Show image ${i + 1}`}
                accessibilityState={{ selected: i === index }}
                style={[
                  styles.thumb,
                  { backgroundColor: colors.surface, borderColor: i === index ? colors.primary : colors.border },
                ]}>
                <Image source={item} style={styles.thumbImage} contentFit="contain" />
              </Pressable>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  image: { flex: 1 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { width: 18 },
  thumbs: { gap: Spacing.sm, padding: Spacing.md },
  thumb: { width: 56, height: 56, borderRadius: Radius.sm, borderWidth: 2, overflow: 'hidden' },
  thumbImage: { flex: 1 },
});
