# ShopAssist — Product Spec (source of truth)

ShopAssist is a cross-platform (Android + iOS) retail shopping app with an AI product assistant.
It is a 3-day demo project for an interview on **Wednesday, Nov 25, 2026**. Scope discipline matters:
**Must** items ship first, **Should** items next, **Stretch** only if everything else is done and polished.

Demo goals: show (1) fast learning of mobile dev, (2) a real, polished app, (3) grounded AI that refuses to make things up,
(4) native gestures, (5) push notifications with action buttons, (6) awareness of retail business realities
(returns, trust, sponsored listings, India's dark-pattern rules).

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Expo SDK 58 (React Native 0.88), TypeScript strict |
| Navigation | Expo Router, routes in `src/app/` |
| Server state | TanStack Query |
| Local state | Zustand + `persist` (AsyncStorage) |
| Gestures / animation | react-native-gesture-handler + react-native-reanimated |
| Images | expo-image |
| Haptics | expo-haptics |
| Notifications | expo-notifications + Expo Push Service |
| Network status | @react-native-community/netinfo |
| Backend (Prompt 4) | Node.js + Hono (or Express) on Google Cloud Run, Firestore for orders/devices |
| AI | Gemini on Vertex AI (server-side only; the app never holds an API key) |
| Builds | EAS Build (development + preview APK), EAS Update |

## Folder structure

```
src/
  app/                      # routes only (Expo Router)
    _layout.tsx             # providers + root Stack
    (tabs)/_layout.tsx      # NativeTabs: Home, Search, Cart (badge), Orders, Profile
    (tabs)/index.tsx | search.tsx | cart.tsx | orders.tsx | profile.tsx
    product/[id].tsx
    product/[id]/ask.tsx    # modal
    category/[slug].tsx
    order/[id].tsx
    wishlist.tsx | checkout.tsx | notifications.tsx | onboarding.tsx
  components/               # reusable UI
  lib/                      # api.ts, queries.ts, notifications.ts, format.ts, haptics.ts
  store/                    # cart.ts, wishlist.ts, settings.ts, orders.ts
  data/                     # products.json (seed)
  constants/theme.ts
  types/index.ts
scripts/                    # build-seed.mjs
backend/                    # Cloud Run API (Prompt 4)
docs/                       # SPEC.md, prompts/
```

## Screens

| Route | Screen | Contents | Priority |
| --- | --- | --- | --- |
| `(tabs)/index` | Home | Greeting with name, search bar shortcut, category chips, featured banner, "Popular" 2-column grid, "Sponsored" row (clearly labelled) | Must |
| `(tabs)/search` | Search | Input **with a visible search button**, query stays visible on results, debounced (300 ms), filters (category, price range, min rating), sort (relevance, price ↑↓, rating), **saved filters** (Should), **natural-language search** toggle (Should) | Must |
| `(tabs)/cart` | Cart | Items with quantity stepper, swipe-to-delete with undo, **full price breakdown up front** (subtotal, delivery, total — no surprise fees), Checkout button, empty state; tab badge = item count | Must |
| `(tabs)/orders` | Orders | Orders list with status pill (Placed, Shipped, Delivered) | Should |
| `(tabs)/profile` | Profile | Name, wishlist link, notification settings, theme (System/Light/Dark), About | Must |
| `product/[id]` | Product detail | Image carousel with thumbnails, pinch-to-zoom + double-tap, price/MRP/discount, rating, description, specs, **"What buyers say"** (pros/cons from reviews, each citing reviews), Add to cart, Ask AI, Similar products, **price-drop / back-in-stock alert toggle** | Must |
| `product/[id]/ask` | Ask AI (modal) | Chat about this product, 3 suggested questions, answers grounded in product data + reviews; says when info isn't available | Must |
| `category/[slug]` | Category | Grid of a category | Should |
| `wishlist` | Wishlist | Saved items, move to cart | Should |
| `checkout` | Checkout | Address form with validation, order summary with the same price breakdown, mock Pay | Should |
| `order/[id]` | Order detail | Status timeline, items, "Rate product"; opened by push deep link | Should |
| `notifications` | Notification settings | Toggles (order updates, cart reminders, price alerts), "Send test notification" | Should |
| `onboarding` | Onboarding | 3 slides, asks name + notification permission | Stretch |

## Features

| Area | Feature | Priority |
| --- | --- | --- |
| Catalog | Grid list (`FlatList`, 2 columns), skeleton loaders, pull-to-refresh, infinite scroll | Must |
| Catalog | Search + filters + sort; search button; persisted query | Must |
| Catalog | Sponsored products labelled "Sponsored" (never disguised — India's CCPA dark-pattern rules) | Must |
| Cart | Cart + wishlist persisted locally | Must |
| Cart | Price breakdown shown before checkout: free delivery at ₹499+, else ₹49; no hidden fees (no drip pricing) | Must |
| Cart | Checkout (mock payment) creates an order | Should |
| AI | Ask about this product — grounded, refuses to guess | Must |
| AI | "What buyers say": 2–4 pros and 1–3 cons from reviews, each linked to the review(s) it came from | Must |
| AI | Natural-language search ("gift for dad who cooks under ₹2000") → structured filters, shown as removable chips | Should |
| Gestures | Long-press product card → haptic + quick-action sheet (Add to cart, Wishlist, Share) | Must |
| Gestures | Swipe-to-delete in cart with undo snackbar | Must |
| Gestures | Pinch-to-zoom + double-tap on product images | Should |
| Notifications | Local cart reminder (2 h; 10 s in demo mode) | Must |
| Notifications | Push "Order shipped" with **Track order** / **Rate product** actions; deep link `shopassist://order/<id>` | Should |
| Notifications | Price-drop / back-in-stock push with **Add to cart** action | Should |
| UX | Light/dark theme, system default + override | Must |
| UX | Loading / empty / error / offline states on every data screen | Must |
| UX | Remember scroll position on Home and Search when returning | Should |
| UX | Share product (native share sheet + deep link) | Stretch |
| UX | App icon quick actions (Search, My cart) | Stretch |
| Release | Development build, preview APK, one EAS Update during demo | Should |

## Data model (TypeScript)

```ts
type Review = { id: string; rating: number; comment: string; reviewerName: string; date: string; verified: boolean };
type Product = {
  id: string; title: string; brand: string; category: string; description: string;
  price: number; mrp: number;            // INR, integers
  rating: number; reviewCount: number;
  images: string[]; thumbnail: string;
  specs: Record<string, string>;
  stock: number; tags: string[];
  sponsored?: boolean;
  reviews: Review[];
};
type CartItem = { productId: string; qty: number; priceAtAdd: number };
type OrderStatus = 'placed' | 'shipped' | 'delivered';
type Order = { id: string; items: { productId: string; title: string; qty: number; price: number }[];
  subtotal: number; delivery: number; total: number; address: Address; status: OrderStatus; createdAt: string };
type Address = { name: string; phone: string; line1: string; city: string; pincode: string };
type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string; grounded?: boolean; citations?: string[] };
type BuyerInsights = { pros: Insight[]; cons: Insight[] };
type Insight = { point: string; reviewIds: string[] };
```

## API (Prompt 4 builds it; the app uses a mock with the same contract until then)

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/products?search=&category=&minPrice=&maxPrice=&minRating=&sort=&page=&limit=` | Paginated list |
| GET | `/products/:id` | One product |
| GET | `/products/:id/similar` | 4 from the same category |
| GET | `/products/:id/insights` | `BuyerInsights` from reviews (cached) |
| GET | `/categories` | Category list |
| POST | `/search/parse` | `{ query }` → `{ filters, explanation }` (natural-language search) |
| POST | `/ask` | `{ productId, question, history }` → `{ answer, grounded, citations }` |
| POST | `/devices` | `{ deviceId, pushToken }` |
| POST | `/alerts` | `{ deviceId, productId, type: 'price_drop' \| 'back_in_stock' }` |
| POST | `/orders` | Create order |
| GET | `/orders?deviceId=` , `/orders/:id` | List / detail |
| POST | `/admin/orders/:id/ship` | Demo trigger: mark shipped + push (admin key) |
| POST | `/admin/products/:id/price-drop` | Demo trigger: drop price + push to subscribers (admin key) |

The app reads the base URL from `EXPO_PUBLIC_API_URL`. If it is not set, `src/lib/api.ts` uses the local mock.

## AI rules (server-side)

- `/ask`: prompt contains ONLY that product's JSON and its reviews. Answer only from it. If not present, answer
  "That isn't in the product details or reviews." with `grounded: false`. Temperature ≤ 0.2, ≤ 120 words, cite review ids used.
- `/products/:id/insights`: every pro/con must list the review ids it came from; drop any point without evidence; balanced (cons are shown, not hidden).
- `/search/parse`: output only fields from the filter schema; unknown intent → plain keyword search.

## Notifications

- Categories: `order_update` (Track order, Rate product), `price_alert` (Add to cart, View).
- Payload `data.url` holds the deep link; tapping or an action opens the right screen even from a killed app.
- Android channels: "Order updates", "Price alerts", "Reminders".
- Push needs a development build (not Expo Go on Android since SDK 53). Local notifications work in Expo Go.

## Non-negotiables

- No secrets in the app bundle. No `android/` or `ios/` edits (Continuous Native Generation).
- Always `npx expo install` for packages. Run `npx tsc --noEmit` and `npx expo lint` before finishing a task.
- Accessible: labels on icon buttons, touch targets ≥ 44 pt, contrast in both themes.
- Prices in INR, formatted with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })`.
