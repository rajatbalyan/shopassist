# Prompt 5 — Real push on Android, polish, README, release

Prompts 1–4 are done and the backend is live on Cloud Run (project `rajat-experiments`, region `asia-south2`, model `gemini-3.5-flash-lite` on the `global` location). Re-read `CLAUDE.md`, `docs/SPEC.md`, `backend/DEPLOY.md` and the current code before starting. Don't stop to ask me questions unless a step truly needs my input; ask once, clearly, and continue with everything else.

The interview demo is on **Wednesday, Nov 25**. Priorities in order: (1) nothing crashes, (2) push with action buttons works on the APK, (3) it looks polished, (4) the repo explains itself.

## Part A — Firebase / FCM for Android push

I'll do the console parts. You do the code and config.

1. I will put `google-services.json` in the repo root (Firebase Android app with package `com.rajatbalyan.shopassist`). Wire it up: `android.googleServicesFile: "./google-services.json"` in `app.json`. This file is not a secret — commit it. If it isn't there yet when you reach this step, continue with the rest and tell me at the end.
2. Make sure nothing in the repo contains the **FCM service account private key** (a JSON with `"private_key"`). Add patterns to `.gitignore` (e.g. `*-firebase-adminsdk-*.json`, `fcm-service-account*.json`) so it can never be committed. I upload that key to EAS myself.
3. Verify the full push path in code: permission → `getPushToken()` (with the EAS `projectId` from `expo-constants`) → `POST /devices` → backend `expo-server-sdk` → categories `order_update` / `price_alert` with action buttons → response handling and deep links. Fix anything missing. Make sure Android channel ids in the push payloads match the channels the app creates.
4. Add a **"Push diagnostics"** row in Profile → Demo tools: shows permission status, whether a push token exists (masked), whether it's registered with the API, and a "Send me a test push" button that calls a new admin-free endpoint `POST /devices/:deviceId/test-push` (rate-limited to 3/min per device) which sends a real Expo push to that device. This is my safety net during the demo.

## Part B — Stability (most important)

1. Add an app-level error boundary (Expo Router `ErrorBoundary` export in the root layout and per route where useful) with a friendly "Something went wrong · Try again" screen instead of a red crash.
2. Re-audit for render loops and unstable values: every Zustand selector, every `useEffect` dependency list, and every prop passed to `NativeTabs`. Fix anything suspicious.
3. Every network call has a timeout, a retry for GETs, and a visible error state. Kill Wi-Fi mid-session and make sure nothing crashes.
4. Cold-start the app from a notification and a deep link with an empty cart, a full cart, and no network. Fix anything that breaks.
5. Run the backend tests and the app's `tsc` + `lint` + `expo-doctor`.

## Part C — Polish

1. **App icon and splash**: create a clean, original brand mark for ShopAssist (simple shopping-bag + spark motif in the primary color, no third-party logos). Generate the PNGs (icon 1024, Android adaptive foreground/background/monochrome, splash) with a small Node script using a dev dependency such as `sharp` or `@resvg/resvg-js` from an SVG you write. Wire them into `app.json`.
2. App display name **ShopAssist** everywhere.
3. Visual pass on a 360 dp-wide screen in both themes: spacing, text truncation, contrast, empty states, skeletons matching final layouts.
4. Performance pass: `FlatList` tuning (`getItemLayout` where sizes are fixed, `removeClippedSubviews` on Android, sensible `windowSize`), memoized row components, `expo-image` caching and placeholders.
5. Accessibility pass: labels on all icon buttons, roles, minimum touch targets, screen-reader order on Product and Cart.
6. Profile → About: app version, data source (Mock / Cloud API with host), "Built with Expo SDK 58 + React Native 0.88", "AI: Gemini on Google Cloud, answers grounded in product data", "Product data: DummyJSON demo data".
7. Optional only if everything above is done: simple onboarding (3 slides, name, notification permission) shown once.

## Part D — OTA updates

1. Configure EAS Update for the `preview` channel (`expo-updates`, `runtimeVersion` with the fingerprint policy, `updates.url` with the project id). Check the v58 docs for the current setup.
2. Add a tiny "Version" label in About that shows the update id / "Embedded build" so I can prove an OTA update landed during the demo.
3. Document in `docs/DEMO.md` exactly how to publish an update to the preview channel and what to change for a visible demo (e.g. the Home banner text).

## Part E — Documentation

1. **README.md** (replace the template one):
   - One-paragraph pitch + 4–6 screenshot placeholders (`docs/screenshots/*.png`, I'll add the images).
   - Feature list grouped: Shopping, AI (grounded answers, buyer insights with citations, plain-words search), Gestures, Notifications, Reliability.
   - Architecture diagram in Mermaid (app → Cloud Run API → Gemini on Vertex/Agent Platform, Firestore, Expo Push → FCM/APNs).
   - Key decisions and why: Expo + Router, TanStack Query + Zustand, server-side AI with no keys in the app, grounding + post-checks, recomputing totals server-side, labelled sponsored items and no drip pricing (India's CCPA dark-pattern guidelines), least-privilege service account.
   - How to run (app, backend locally, deploy) — link `backend/DEPLOY.md`.
   - "Built in 4 days" timeline (Sat learning + setup, Sun core app + gestures + notifications + backend, Mon AI + push, Tue polish + release).
2. **docs/DEMO.md** — a 3-minute demo script with exact steps and the exact PowerShell commands (from DEPLOY.md section 9, with region `asia-south2` and secret `ADMIN_KEY`) to: ship an order, drop a price, and send a test push. Include a "If something fails live" fallback list (mock mode, Demo tools buttons, screen recording).
3. **docs/INTERVIEW-NOTES.md** — 10 likely questions about this project with short, honest answers in my voice (e.g. "Why React Native over Flutter?", "How do you stop the AI from hallucinating?", "How does push reach a killed app?", "What would you do differently with more time?", "How would this scale?").

## Part F — Release build prep

1. `eas.json` preview profile has `EXPO_PUBLIC_API_URL` set to the Cloud Run URL and the `preview` update channel.
2. Bump version to `1.0.0`.
3. List the exact commands I must run, in order: upload FCM key to EAS, rebuild the development build (native config changed), build the preview APK, publish a test OTA update.

## Finish

1. All checks green (app `tsc`, `lint`, `expo-doctor`; backend `typecheck`, `test`).
2. Commit in logical commits (stability, push, polish, OTA, docs), then tag `v1.0.0`. Do not push — I'll push.
3. Reply with: what changed, anything you couldn't do, the exact commands for me in order, and a final 15-step phone test checklist on the **preview APK** that mirrors the demo script.
