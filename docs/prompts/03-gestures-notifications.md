# Prompt 3 — Gestures, local notifications, deep links, EAS config

Prompts 1 and 2 are done. Re-read `CLAUDE.md`, `docs/SPEC.md`, and the current `src/` before starting. Reuse existing components, stores and libs. Check the Expo SDK 58 docs (`https://docs.expo.dev/versions/v58.0.0/`) for `expo-notifications`, Expo Router linking and EAS, and the installed `react-native-gesture-handler` / `react-native-reanimated` versions' docs, before writing code — their APIs changed recently.

Don't stop to ask me questions; decide, note it, keep going.

## Part A — Gestures (react-native-gesture-handler + Reanimated, UI-thread animations)

1. **Long-press on `ProductCard`** (everywhere it's used):
   - Press-in scales the card to 0.97 (Reanimated), long-press (~350 ms) fires `haptics.longPress()` and opens a **quick-action sheet**: Add to cart / Remove from wishlist or Add to wishlist / Share / View product.
   - The sheet: a reusable `ActionSheet` component (slides up with Reanimated, backdrop tap and swipe-down to close, safe-area aware, accessible).
   - A normal tap still opens the product.
2. **Swipe-to-delete in Cart**:
   - Use Gesture Handler's Reanimated-based swipeable row (check the installed version's export). Swipe left reveals a red Delete action; a full swipe deletes.
   - `haptics.warning()` on delete, animated row collapse (`LinearTransition` / `FadeOut`), and the existing **Undo** snackbar restores the item at the same position.
3. **Pinch-to-zoom + double-tap** in `ZoomableImage` on the product screen:
   - Tapping an image opens a full-screen viewer (modal route or overlay) with the gallery.
   - In the viewer: `Gesture.Simultaneous(pinch, pan)` for zoom + move, `Gesture.Exclusive(doubleTap, singleTap)` — double-tap toggles 1× / 2.5× at the tap point, single tap toggles the close button. Clamp scale to 1–4× and clamp panning to the image bounds; spring back below 1×. Swipe down at 1× closes the viewer.
   - Show a one-time hint "Pinch to zoom" on first open (store a flag in settings).
4. **Share** (from the product header and the action sheet): React Native `Share` with the product title, price and the deep link `shopassist://product/<id>`.
5. Pull-to-refresh is already there; make sure it fires a light haptic.

## Part B — Notifications (local, plus everything push will reuse)

Create `src/lib/notifications.ts` as the single place for notification logic:

1. **Handler**: show alerts, sound and badge while the app is in the foreground.
2. **Permissions, asked in context** (never on app launch): the first time the user adds to cart, turns on a price alert, or enables a toggle on the Notifications screen, show a small explainer sheet ("Get order updates and price drops") → then the system prompt. If denied, show a "Turn on in Settings" button that opens app settings (`Linking.openSettings()`).
3. **Android channels**: `order-updates` (high importance), `price-alerts` (default), `reminders` (low).
4. **Categories with action buttons** (`setNotificationCategoryAsync`):
   - `order_update`: **Track order** (opens app), **Rate product** (opens app).
   - `price_alert`: **Add to cart** (opens app), **View** (opens app).
5. **Response handling**: one hook in the root layout handles both taps and action buttons, including the case where a notification launched the app from a killed state (check `useLastNotificationResponse` / the response listener API in the v58 docs):
   - Read `data.url` (deep link) and `actionIdentifier`.
   - `track` → `order/<id>`; `rate` → `order/<id>?rate=1` (auto-opens the rating sheet); `add_to_cart` → add the product (from `data.productId`), `haptics.success()`, open Cart; default tap → `router.push(data.url)`.
6. **Cart reminder** (respects the Cart reminders toggle): when the app goes to background with items in the cart, schedule one local reminder ("You left N items in your cart") for 2 h later, or 10 s when Demo mode is on, deep-linking to the cart. Cancel it when the cart is emptied, an order is placed, or the app returns to the foreground.
7. **Demo triggers that work before the backend exists** (only in mock mode):
   - The existing "Demo: mark as shipped" on order detail now also schedules an `order_update` notification 5 s later: "Your order #XXXX has shipped" with Track / Rate actions and `data.url = shopassist://order/<id>`.
   - Profile → Demo tools: **Simulate price drop** — picks a product with a price alert on (or the first wishlist item), lowers its displayed price by 10% in local state, and schedules a `price_alert` notification 5 s later with Add to cart / View actions.
8. Wire the **Send test notification** button on the Notifications screen.
9. Prepare for push (used in Prompts 4–5, no backend calls yet): `getPushToken()` that returns the Expo push token when running in a development build with a projectId, and returns `null` with a clear console warning in Expo Go. Don't call it on launch yet.

## Part C — Deep links

- Make sure these open the right screens from a cold start and from the background: `shopassist://product/<id>`, `shopassist://order/<id>`, `shopassist://cart`, `shopassist://search?q=<text>`. Add a small redirect route if `cart` / `search` need it (tabs).
- Unknown links land on a friendly not-found screen (`+not-found.tsx`) with a "Go home" button.
- Document how to test each one in the final reply (e.g. `npx uri-scheme open "shopassist://product/1" --android`).

## Part D — EAS configuration (files only, I'll run the builds)

1. Create `eas.json` with three profiles:
   - `development`: `developmentClient: true`, `distribution: "internal"`, Android `buildType: "apk"`.
   - `preview`: `distribution: "internal"`, Android `buildType: "apk"`, env `EXPO_PUBLIC_API_URL` left empty for now.
   - `production`: defaults.
   Add `"cli": { "appVersionSource": "remote" }` if the v58 docs recommend it.
2. Make sure `app.json` has everything a development build with notifications needs (expo-notifications plugin with the notification icon/color, Android `POST_NOTIFICATIONS` handled by the plugin). Do not add `google-services.json` — I'll add Firebase in Prompt 5.
3. Add npm scripts: `"start:go": "expo start --go"`, `"start:dev": "expo start --dev-client"`.

## Verify and commit

1. `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` — all clean.
2. Commit: `feat: gestures, local notifications with actions, deep links, eas config`.
3. Reply with: what you built, deviations, and a **phone test checklist** split into (a) what works in Expo Go and (b) what needs the development build (notification action buttons in particular), plus the exact deep-link test commands.
