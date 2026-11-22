import type { Href } from 'expo-router';
import { Share } from 'react-native';

import { formatPrice } from '@/lib/format';
import type { Product } from '@/types';

export const SCHEME = 'shopassist';

/** `deepLink('product/1')` → `shopassist://product/1` */
export const deepLink = (path: string) => `${SCHEME}://${path.replace(/^\//, '')}`;

/** Turns `shopassist://order/42?rate=1` (or a plain path) into a router href: `/order/42?rate=1`. */
export function linkToHref(url: string): Href {
  const path = url.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  return `/${path.replace(/^\//, '')}` as Href;
}

/** Opens the native share sheet with the product's title, price and deep link. */
export async function shareProduct(product: Pick<Product, 'id' | 'title' | 'price'>) {
  const url = deepLink(`product/${product.id}`);
  try {
    await Share.share({
      title: product.title,
      message: `${product.title} — ${formatPrice(product.price)} on ShopAssist\n${url}`,
    });
  } catch {
    // Dismissed or unavailable: nothing to do.
  }
}
