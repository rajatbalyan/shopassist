import { Image, type ImageProps } from 'expo-image';

/**
 * Product image that will support pinch-to-zoom and double-tap in Prompt 3.
 * For now it renders a plain image so callers don't change later.
 */
export function ZoomableImage(props: ImageProps) {
  return <Image contentFit="contain" transition={200} {...props} />;
}
