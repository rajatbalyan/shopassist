# Prompt 2 — Core screens

Prompt 1 is done (foundation, data layer, stores, navigation shell, base components). Re-read `CLAUDE.md` and `docs/SPEC.md`, and look at what exists in `src/` before starting. Reuse the existing components, theme, hooks, `api`, `queries.ts`, `pricing.ts` and stores — do not duplicate them. If you need a new reusable piece, add it to `src/components/` or `src/lib/`.

This prompt replaces every placeholder screen with the real, polished screen. **Gestures (long-press sheet, swipe-to-delete, pinch-to-zoom) and notifications are NOT in this prompt** — they come in Prompt 3. Leave clean hooks for them (e.g. a `onLongPress` prop on `ProductCard` that does nothing yet, a remove button in cart rows).

Don't stop to ask me questions; decide, note it, keep going. Check the Expo SDK 58 docs before using any Expo / Expo Router API you're unsure of.

## Quality bar (applies to every screen)

- Four states on every data screen: loading (skeletons shaped like the content), empty (friendly message + action), error (`ErrorState` with retry), offline (`OfflineBanner`).
- Looks like a real store app: consistent spacing from `Spacing`, `Radius`, `Typography`; both themes look good; no text overflow on small phones (360 dp wide).
- Accessibility: every icon button has `accessibilityLabel`; touch targets ≥ 44 pt; images have meaningful labels.
- Subtle motion only: Reanimated layout animations (`FadeIn`, `FadeInDown`, `LinearTransition`) for list items and state changes. No heavy custom animation.
- Haptic `tap` on primary buttons, `success` on add-to-cart and order placed.
- All prices go through `formatPrice` and all totals through `getPriceBreakdown`.

## 1. Home — `src/app/(tabs)/index.tsx`

- Header: "Hi, {name}" (or "Hi there"), subtitle, wishlist icon button with count.
- Search bar look-alike that navigates to the Search tab and focuses the input.
- Category chips (horizontal) → `category/[slug]`.
- Featured banner: the category with the highest average discount ("Up to N% off on Laptops") → category screen.
- "Sponsored" row: horizontal list of sponsored products; each card shows a visible **Sponsored** badge, and the section title says "Sponsored". Never disguise ads.
- "Popular" section: 2-column infinite grid sorted by rating, pull-to-refresh, skeletons, footer spinner while loading more.
- Remember the scroll position when navigating to a product and back (Should).

## 2. Search — `src/app/(tabs)/search.tsx`

- Text input with a **visible search button** next to it (do not rely on the keyboard's submit key). Auto-focus when opened from Home.
- Typing searches with a 300 ms debounce; submitting saves to "Recent searches" (max 8, clear-all, stored in settings).
- **The query stays visible** above the results ("Results for 'iphone' · 12 items").
- Sort menu: Relevance, Price low→high, Price high→low, Rating.
- Filters bottom sheet (build a simple modal sheet yourself or use Expo Router's `formSheet` presentation if available in v58): category (multi-select chips), price range presets (Under ₹1,000, ₹1,000–5,000, ₹5,000–20,000, ₹20,000+) plus custom min/max, minimum rating (4★+, 3★+).
- Active filters appear as removable chips under the search bar; "Clear all".
- **Saved filters** (Should): "Save this search" stores query + filters in settings; saved searches show as chips when the input is empty.
- **"Search in plain words"** toggle (Should): when on, submit calls `api.parseSearch(query)`, applies the returned filters as chips, and shows a one-line explanation ("Showing Kitchen under ₹2,000"). The user can remove any chip. Sponsored items may appear in results but must carry the badge.
- Results: 2-column infinite grid; empty state suggests removing filters and shows popular categories.

## 3. Product detail — `src/app/product/[id].tsx`

- Image carousel (horizontal paging `FlatList` with `expo-image`), page dots, and a **thumbnail strip** below it. Leave a `ZoomableImage` wrapper component in place (renders a normal image for now; Prompt 3 adds pinch-to-zoom).
- Brand, title, rating stars + review count (tap scrolls to reviews), price, crossed-out MRP, discount %, "Inclusive of all taxes".
- Stock: "In stock", "Only N left" (≤ 5), or "Out of stock" with a **Notify me when it's back** button.
- **Price alert** toggle: "Tell me if the price drops" (stores in `alerts` store; the actual push comes in Prompts 4–5). Show a toast/snackbar confirmation.
- Delivery line using `getPriceBreakdown` logic: "Free delivery" or "₹49 delivery · free above ₹499".
- Description (collapsible after 4 lines), specs as a clean key/value table.
- **"What buyers say"** card from `useInsights(id)`: pros (green) and cons (amber), each point with "from N reviews". Tapping a point scrolls to the reviews list and highlights the cited reviews. Footer line: "Summarised from verified reviews. Every point links to its source." Show cons even when they hurt; that's the point.
- Reviews list: sort by Most recent / Most critical; verified badge; show 5 then "Show all".
- "Similar products" horizontal row (`useSimilar`).
- Sticky bottom bar: wishlist heart, **Ask AI** button, **Add to cart** (becomes "Go to cart · N" after adding; disabled when out of stock).
- Header: back, share icon (no-op for now), cart icon with badge.

## 4. Ask AI — `src/app/product/[id]/ask.tsx` (modal)

- Header with product thumbnail + title, close button.
- 3 suggested questions as chips, tailored by category (e.g. smartphones: "How is the battery?", "Is it good for gaming?", "What do buyers complain about?").
- Chat list (user right, assistant left), typing indicator while waiting, auto-scroll to bottom, `KeyboardAvoidingView` that works on Android and iOS.
- Calls `api.ask({ productId, question, history })`.
  - Grounded answers show a small "Based on product details and N reviews" line; citation chips open the cited review in a small sheet.
  - Not-grounded answers are styled differently (muted, info icon) with the text "That isn't in the product details or reviews." Never invent an answer client-side.
- Input with send button; disable send while empty or loading. Keep the conversation in component state (per product, cleared on close).

## 5. Cart — `src/app/(tabs)/cart.tsx`

- Rows: image, title, price, quantity stepper (1–stock), remove button (Prompt 3 adds swipe-to-delete), total per row. After removing, show an **Undo** snackbar using `lastRemoved`.
- "Add ₹X more for free delivery" with a progress bar (from `freeDeliveryRemaining`).
- **Price breakdown card**: Subtotal, Delivery (or "FREE"), **Total**. Exactly the same numbers checkout will charge — no fees added later.
- Checkout button (sticky). Empty state: illustration-style icon, "Your cart is empty", "Start shopping" → Home.
- Wishlist suggestions row at the bottom if the wishlist isn't empty.

## 6. Checkout — `src/app/checkout.tsx`

- Address form: name, 10-digit phone, address line, city, 6-digit pincode; inline validation messages; remember the last address in settings.
- Order summary (items + the same price breakdown).
- Payment section: one option, "Demo payment (no money is charged)".
- "Place order" → `api.createOrder` → clear cart → navigate to `order/[id]` with a success header ("Order placed!") and `success` haptic. Handle loading and error.

## 7. Orders — `src/app/(tabs)/orders.tsx` and `src/app/order/[id].tsx`

- List: order id (short), date, item thumbnails, total, status pill (Placed / Shipped / Delivered). Empty state → Home.
- Detail: vertical status timeline (Placed → Shipped → Delivered with dates where known), items, price breakdown, address, and a **Rate product** button per item that opens a star-rating sheet (store locally; show "Thanks for rating").
- In mock mode, add a small "Demo: mark as shipped" button on the order detail (only when `EXPO_PUBLIC_API_URL` is not set) so the timeline can be shown off before the backend exists.

## 8. Other screens

- `category/[slug].tsx`: title, product count, sort menu, 2-column infinite grid.
- `wishlist.tsx`: grid with remove and "Move to cart"; empty state.
- `(tabs)/profile.tsx`: avatar initial + editable name; sections: Wishlist, Orders, Notification settings, Appearance (System / Light / Dark segmented control), Demo mode toggle (with explanation), About (app version from `expo-constants`, "Built with Expo + React Native", "Product data: DummyJSON demo data"). Remove the temporary test links from Prompt 1.
- `notifications.tsx`: toggles for Order updates, Cart reminders, Price alerts (saved in settings). A disabled "Send test notification" button with caption "Available after Prompt 3" — Prompt 3 wires it up.
- `onboarding.tsx`: leave as a simple placeholder (Stretch).

## 9. ProductCard upgrades

- Wishlist heart toggle on the image corner (with haptic and accessibility label).
- Out-of-stock overlay.
- Accept an optional `onLongPress` prop (no-op default) for Prompt 3.

## 10. Housekeeping

- Remove the broken `reset-project` script from `package.json`.
- Delete the temporary `PlaceholderScreen` if nothing uses it anymore.

## 11. Verify and commit

1. `npx tsc --noEmit` and `npx expo lint` must pass; `npx expo-doctor` clean.
2. Click through every route in your head against the spec's Screens table and fix gaps.
3. Commit: `feat: core screens (home, search, product, ask AI, cart, checkout, orders, profile)`.
4. Reply with: what you built, deviations, anything I must do, and a **numbered phone test checklist** covering every screen and the main flow (browse → product → ask AI → add to cart → checkout → order detail → mark shipped).
