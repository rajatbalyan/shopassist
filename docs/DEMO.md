# ShopAssist: 3-minute demo script

Phone: the **preview APK** (Cloud API, real push). PC: PowerShell in the repo root.
Before the interview, run the **Setup** block once and keep that PowerShell window open.

## Setup (before the demo)

```powershell
$PROJECT_ID = "rajat-experiments"
$REGION     = "asia-south2"
$SERVICE    = "shopassist-api"
gcloud config set project $PROJECT_ID
$API       = gcloud run services describe $SERVICE --region $REGION --format "value(status.url)"
$ADMIN_KEY = gcloud secrets versions access latest --secret ADMIN_KEY
$H         = @{ "x-admin-key" = $ADMIN_KEY }
Invoke-RestMethod "$API/health"     # wakes the service (min instances = 0) → { ok: True }
```

On the phone:

1. Profile → **Demo mode** on (the cart reminder fires after 10 s instead of 2 h).
2. Profile → Demo tools → **Push diagnostics**: all three lines green (Allowed, a token, Registered: Yes).
   Tap **Send me a test push** once. It should arrive within seconds.
3. Turn on the price alert for product 121: search "iPhone 5s" → product → **Tell me if the price drops**.
4. Empty the cart. Use light theme for the projector (Profile → Appearance).

## Script

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Open the app. Scroll Home: greeting, banner, Popular grid, **Sponsored** row. | "Expo SDK 58 + React Native. Sponsored items are always labelled. India's CCPA dark-pattern guidelines ban disguised ads." |
| 0:15 | Search tab → turn on **Search in plain words** → type *gift for dad who cooks under 2000* → Search. | "Gemini turns plain words into filters. You can see and remove each chip, and if the AI fails it falls back to a keyword search." |
| 0:35 | Open a product. Pinch and double-tap the image, swipe down to close. | "Native gestures on the UI thread with Gesture Handler and Reanimated." |
| 0:50 | Scroll to **What buyers say** → tap a pro to see the reviews it cites. | "Every pro and con must cite real review ids. The server drops anything without evidence." |
| 1:05 | **Ask AI** → *How is the battery?* → then *Is it waterproof?* | "The answer cites reviews. For the second, the data doesn't say, so it refuses instead of guessing." |
| 1:25 | Back on Home, **long-press** a card → Add to cart. Cart: swipe a row to delete → **Undo**. | "Haptics, a quick-action sheet, and swipe-to-delete with undo. The full price breakdown is shown up front, with no drip pricing." |
| 1:45 | Checkout → fill the address → **Place order** (mock payment). Order placed. | "The server recomputes the totals. It never trusts prices sent by the client." |
| 1:55 | **PC: ship the order** (command A). Lock the phone. | "Admin trigger → Cloud Run → Expo Push → FCM." |
| 2:05 | The push arrives with **Track order / Rate product** → tap **Track order**. | "Action buttons and a deep link to the order, even from a killed app." |
| 2:20 | **PC: drop the price** (command B). Push → tap **Add to cart**. | "Price alerts. The action adds the item to the cart and opens it." |
| 2:40 | Profile → About: **Version** shows the update id (after the OTA in the OTA section) and **Data source: Cloud API**. | "Over-the-air updates through EAS Update on the preview channel." |
| 2:55 | Wrap up. | "Built in 4 days. The repo README covers the architecture and the trade-offs." |

## PC commands

```powershell
# A. Ship the newest order → "Your order has shipped" (Track order / Rate product)
$ORDER_ID = (Invoke-RestMethod -Uri "$API/admin/orders" -Headers $H)[0].id
Invoke-RestMethod -Method Post -Uri "$API/admin/orders/$ORDER_ID/ship" -Headers $H

# (optional) Mark it delivered
Invoke-RestMethod -Method Post -Uri "$API/admin/orders/$ORDER_ID/deliver" -Headers $H

# B. Drop product 121's price 15% → price-alert push (Add to cart / View) to devices with an alert on it
Invoke-RestMethod -Method Post -Uri "$API/admin/products/121/price-drop" -Headers $H -ContentType "application/json" -Body '{"percent":15}'

# C. Test push to this phone (no admin key). Device id: bottom of Push diagnostics (long-press to copy)
$DEVICE_ID = "<device id>"
Invoke-RestMethod -Method Post -Uri "$API/devices/$DEVICE_ID/test-push"
```

Every response includes `pushed`. `pushed: 0` with `note: "No push token registered for this device"`
means the phone hasn't registered. Open Push diagnostics → **Register again**.
Running the price drop again keeps lowering the price, so use a small percent the second time.

## OTA update during the demo (EAS Update, preview channel)

The preview APK checks for updates on launch, downloads in the background, and applies the update on the **next** launch.

One-time setup: the update bundle needs the API URL. `eas.json`'s build `env` applies only to builds, so add the
variable to the EAS `preview` environment:

```powershell
npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --value "https://shopassist-api-wzpqdigtdq-em.a.run.app" --environment preview --visibility plaintext
```

Make a visible change: in `src/constants/promo.ts` set `eyebrow: 'OTA UPDATE LIVE'` (the small text on the Home banner). Then:

```powershell
npx eas-cli@latest update --channel preview --environment preview --message "Demo: banner text"
```

On the phone: close the app fully (swipe it away), open it, wait ~5 s, close and open again. The banner shows the
new text, and Profile → About → **Version** changes from "Embedded build" to `Update xxxxxxxx · <time> · preview`.
Revert `promo.ts` afterwards (and publish again if you want the APK back to the original text).

Updates only reach builds with the same **runtime version** (fingerprint of the native project). JS-only changes are
fine. If you change native config (app.json plugins, new native packages), you need a new APK.

## If something fails live

- **No push arrives.** Profile → Push diagnostics. If a line is red, tap **Register again**, then **Send me a test push**.
  Still nothing: show the recorded video (below) and move on.
- **API slow or down** (cold start, Wi-Fi). Pull to refresh. Every screen has an error state with **Try again**. Run
  `Invoke-RestMethod "$API/health"` to wake the service.
- **AI answers fail.** The server returns safe fallbacks (keyword search, the exact refusal text), so the app keeps
  working. Say so: it's the designed behaviour.
- **Total network failure.** Run the dev build against the mock (`npm run start:dev` with `EXPO_PUBLIC_API_URL` unset in
  `.env`). Profile → Demo tools → **Simulate price drop** and the order screen's demo status button fire the same
  notifications locally, with action buttons.
- **App crashes on a screen.** The error boundary shows "Something went wrong · Try again". Tap **Go to Home**.
- **Backup:** a 3-minute screen recording of this script on the preview APK (record the day before:
  Android quick settings → Screen record, with audio off).
