# Interview notes: likely questions, honest answers

**1. Why React Native (Expo) over Flutter or native?**
I already know TypeScript and React, so I could ship a real app in four days instead of learning a language first.
Expo gives me one codebase for Android and iOS, file-based routing with deep links, and EAS for cloud builds and OTA
updates. I didn't need Android Studio or Xcode. The new architecture and Reanimated keep gestures on the UI thread, so it doesn't feel
like a web view. Flutter would have been fine too, but I'd have spent day one learning Dart instead of building.

**2. How do you stop the AI from hallucinating?**
In three layers. First, the prompt contains only that product's JSON and its reviews, at temperature 0.2, with a JSON schema for the
output. Second, the server checks what comes back. Citations must be real review ids for that product, an uncited answer
with a number that isn't in the data gets replaced by the refusal text, and insights without evidence are dropped.
Third, the UI shows the citations, so the user can check the source. It can still word something badly, but it can't
invent a spec and cite it.

**3. How does a push reach a killed app, and how do the buttons work?**
The app registers an Expo push token (FCM underneath on Android) with my API. The backend sends through Expo's push
service with a `categoryId` and `channelId`. Android shows the notification with the buttons from the category, without
my code running. When you tap, the OS starts the app. On launch I read `getLastNotificationResponse()`, wait until the
navigator and the saved cart are loaded, then route based on the action: Track order, Rate, Add to cart, or the deep link in
`data.url`.

**4. Why both TanStack Query and Zustand?**
They solve different problems. Server data needs caching, retries, refetching on reconnect and pagination. That's
TanStack Query. The cart, wishlist and settings are local, must survive restarts, and are small. That's Zustand with
AsyncStorage. I hit a real bug here: a selector that built new objects on every read caused a render loop. The fix was to select stable
references and join them in `useMemo`.

**5. Why is the AI on a server instead of calling Gemini from the app?**
Any key in an APK can be extracted. With the server, the app has no secrets. Vertex AI runs under a least-privilege service
account, I can rate-limit per device, apply the post-checks, cache insights, and change models without shipping an app
update. I actually had to switch models mid-project, and only the server config changed.

**6. How would this scale?**
Cloud Run scales out automatically. The API is stateless apart from a per-instance rate limiter and a small price
cache, which I'd move to Redis or Memorystore. Firestore scales for these access patterns, which are single-document reads
and simple equality queries with no composite indexes. The expensive part is AI, so I'd cache insights per review count (already done),
add per-user quotas, and batch insight generation offline. Push already goes in chunks through Expo. At high volume I'd queue
it with Cloud Tasks.

**7. What would you do differently with more time?**
Real authentication (device ids are fine for a demo, not for real accounts) and real payments. Also end-to-end tests with
Maestro on a real device, and a proper catalog database with search (Algolia, or Postgres full-text) instead of an in-memory
JSON file. I'd also run evals on the AI answers: a fixed question set per product scored for groundedness, so a model change can't
quietly make it worse.

**8. How did you handle Indian retail rules?**
The CCPA's 2023 dark-pattern guidelines call out disguised ads and drip pricing. Sponsored products always carry a
"Sponsored" label and are capped at one per 10 results. The cart shows the full price, including delivery, before
checkout, and there are no surprise fees at payment. Prices are whole rupees formatted with `en-IN`.

**9. How do you know it won't crash in the demo?**
There are error boundaries on the root layout and busy routes, timeouts and retries on every request, visible error states,
and refetch on reconnect. I audited for render loops: unstable selectors, effect dependencies, and props passed to the native
tabs. Backend tests cover totals, AI post-checks, admin auth, rate limits and push payloads. As a fallback, there's a Push
diagnostics screen with a real test push, and a mock mode that fires the same notifications locally.

**10. What was the hardest part?**
Push end to end. It touches Firebase, EAS credentials, the native build, permissions, Android channels, notification categories,
the backend, and cold-start routing, and a mistake in any one shows up as "nothing happened". So I built the diagnostics
screen: it shows permission, token, registration, and a test push. That turned "it doesn't work" into a specific red line.
