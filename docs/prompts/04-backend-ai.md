# Prompt 4 — Backend on Cloud Run + real AI (Gemini on Vertex AI)

Prompts 1–3 are done. The app talks to `src/lib/api.ts`, which uses `mockApi` unless `EXPO_PUBLIC_API_URL` is set. This prompt builds the real backend with the **same contract** (see `docs/SPEC.md` → API, AI rules, Notifications) and switches the app to it.

Re-read `CLAUDE.md`, `docs/SPEC.md`, `src/lib/api.ts`, `src/types/index.ts` and `src/data/*.json` first. Don't stop to ask me questions unless a step truly needs my input (GCP project id, login) — then ask once, clearly, and continue with everything that doesn't depend on it.

Before using any SDK, check its current docs: Hono, `@google/genai` (Vertex AI mode), `@google-cloud/firestore`, `expo-server-sdk`, and `gcloud run deploy`. Use a current **Gemini Flash** model available on Vertex AI in `asia-south1` (or `us-central1` if the model isn't there) and put the model name in one config constant.

## 1. Project layout

```
backend/
  package.json        # type: module, scripts: dev, build, start, typecheck
  tsconfig.json
  Dockerfile          # or rely on Cloud Run source deploy with buildpacks — pick one, document it
  .env.example        # GCP_PROJECT_ID, GCP_LOCATION, GEMINI_MODEL, ADMIN_KEY
  src/
    index.ts          # Hono app, routes, error handler, request logging
    config.ts
    data/products.json, categories.json   # copied from src/data at build time by a script
    lib/catalog.ts    # load, filter, sort, paginate (port the mock logic; share types)
    lib/firestore.ts  # orders, devices, alerts, insights cache
    lib/ai.ts         # Gemini client + prompts + JSON schema outputs
    lib/push.ts       # Expo push via expo-server-sdk, chunking, receipts logged
    routes/*.ts
```

Share types: either import from `../src/types` via a path alias, or copy them into `backend/src/types.ts` with a comment saying they must match. Pick the simpler one that builds cleanly.

## 2. Endpoints (exact contract from the spec)

- Catalog: `GET /products`, `/products/:id`, `/products/:id/similar`, `/categories` — same filtering/sorting/pagination as the mock.
- Sponsored items: keep the `sponsored` flag; in `/products` results insert at most one sponsored item per 10 results, always flagged.
- `POST /devices` `{ deviceId, pushToken }` → upsert in Firestore.
- `POST /alerts` `{ deviceId, productId, type }` and `DELETE /alerts` → Firestore.
- `POST /orders` → validate body (zod), recompute totals **server-side** with the same pricing rule (₹49 delivery under ₹499), never trust client totals. `GET /orders?deviceId=`, `GET /orders/:id`.
- Admin (header `x-admin-key` must equal `ADMIN_KEY`):
  - `POST /admin/orders/:id/ship` → status `shipped`, push `order_update` to the order's device: title "Your order has shipped", body with item name, `categoryId`/`categoryIdentifier: "order_update"`, `channelId: "order-updates"`, `data: { url: "shopassist://order/<id>", orderId }`.
  - `POST /admin/orders/:id/deliver` → status `delivered` (no push needed, or a simple one).
  - `POST /admin/products/:id/price-drop` `{ percent }` → store an override price in Firestore, push `price_alert` to devices subscribed to that product: `data: { url: "shopassist://product/<id>", productId }`, `channelId: "price-alerts"`.
- `GET /health`.

## 3. AI endpoints (Gemini on Vertex AI, structured JSON output)

All AI calls: temperature ≤ 0.2, JSON schema output, a 15 s timeout, one retry, and a safe fallback response on failure (never a 500 to the app for AI errors). Log token usage.

- `POST /ask` `{ productId, question, history }` → `{ answer, grounded, citations }`.
  - System prompt: you are a shopping assistant for ONE product; use ONLY the provided product JSON and reviews; if the answer isn't there, set `grounded: false` and answer exactly "That isn't in the product details or reviews."; never invent specs, prices or policies; ≤ 120 words; `citations` = review ids actually used.
  - **Post-check**: drop any citation id that isn't one of this product's review ids; if the model claims `grounded: true` but cites nothing and the answer mentions a number not present in the product JSON, downgrade to `grounded: false`.
  - Cap history to the last 6 turns. Reject questions over 500 characters.
- `GET /products/:id/insights` → `BuyerInsights`: 2–4 pros, 1–3 cons, each with `reviewIds`. Post-check: remove points whose ids don't exist; must keep at least one con if any review ≤ 3★ exists. **Cache** in Firestore by product id + review count.
- `POST /search/parse` `{ query }` → `{ filters, explanation }` using a strict schema (category must be one of the real category slugs; prices as numbers). If parsing fails, return `{ filters: { search: query }, explanation: "Showing results for “query”" }`.

Basic abuse protection: simple in-memory rate limit per deviceId/IP on AI routes (e.g. 20/min).

## 4. Local run and tests

- `npm run dev` runs on `PORT` (default 8080) with Application Default Credentials.
- Add a small test script (`npm test`, vitest or node:test) covering: catalog filtering, server-side totals, `/ask` post-check logic (with the model call mocked), admin key rejection.

## 5. Deploy to Cloud Run (I'll run commands that need my login; you prepare everything)

Write `backend/DEPLOY.md` with exact Windows-PowerShell-friendly commands:

1. `gcloud auth login` and `gcloud config set project <PROJECT_ID>` (ask me for the project id once).
2. Enable APIs: Cloud Run, Cloud Build, Artifact Registry, Firestore, Vertex AI, Secret Manager.
3. Create Firestore (Native mode) in `asia-south1`.
4. Create the `ADMIN_KEY` secret in Secret Manager.
5. A dedicated service account with only: Vertex AI User, Cloud Datastore User, Secret Manager Secret Accessor.
6. `gcloud run deploy shopassist-api --source backend --region asia-south1 --service-account ... --set-env-vars ... --set-secrets ADMIN_KEY=... --allow-unauthenticated --min-instances 0 --max-instances 3`.
7. How to read logs, and a `curl`/PowerShell `Invoke-RestMethod` example for every admin trigger (ship order, price drop) — these are what I'll run live in the demo.

If `gcloud` is installed and already logged in on this machine, run the steps yourself after asking me for the project id; otherwise stop at the doc.

## 6. Switch the app to the real API

- `.env` (git-ignored) with `EXPO_PUBLIC_API_URL=<Cloud Run URL>`; `.env.example` committed. Update `eas.json` `preview` env to use the same URL.
- On app start (after permission is granted, in a development build), get the Expo push token via `getPushToken()` and `POST /devices`. Re-send if the token changes.
- Price-alert toggle and "Notify me when it's back" now call `/alerts`.
- Orders now come from the API; keep the mock-only "Demo: mark as shipped" button hidden when the real API is used (the admin trigger replaces it).
- Product prices respect the server's price override after a price drop.
- Handle API errors gracefully everywhere (existing `ErrorState`), with a 10 s request timeout and one retry for GETs.

## 7. Verify and commit

1. Backend: typecheck + tests pass. App: `npx tsc --noEmit`, `npx expo lint`, `npx expo-doctor` clean.
2. Commit: `feat: cloud run backend with gemini ai, firestore and expo push`.
3. Reply with: what you built, deviations, the exact commands I must run (in order), and a test checklist: AI answers (one grounded, one refused), insights with real citations, plain-words search, order → admin ship → push with actions, price alert → admin price drop → push → Add to cart action.
