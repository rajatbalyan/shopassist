# ShopAssist API: local run and Cloud Run deploy

Commands are for **Windows PowerShell**, run from the repo root (`D:\Programming\Practice\shopassist`).
Build method: the **Dockerfile** in `backend/`. `gcloud run deploy --source backend` uses it
(a Dockerfile takes precedence over buildpacks), so the Node version and build steps are pinned.

## 0. Variables (paste once per PowerShell session)

```powershell
$PROJECT_ID = "rajat-experiments"
$REGION     = "asia-south2"          # Cloud Run + Firestore (Delhi)
$AI_REGION  = "global"               # Vertex AI location for Gemini (see step 3b)
$MODEL      = "gemini-3.5-flash-lite" # also the default in backend/src/config.ts (3.8 Flash is blocked for new projects)
$DATABASE   = "shopassist"           # named Firestore database (not "(default)")
$SERVICE    = "shopassist-api"
$SA_NAME    = "shopassist-api"
$SA         = "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
```

## 1. Log in and pick the project

```powershell
gcloud auth login
gcloud config set project $PROJECT_ID
# Only for running the backend locally against Firestore/Vertex:
gcloud auth application-default login
gcloud auth application-default set-quota-project $PROJECT_ID
```

Billing must be enabled on the project.

## 2. Enable APIs

```powershell
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com firestore.googleapis.com aiplatform.googleapis.com secretmanager.googleapis.com
```

## 3. Firestore (Native mode) in $REGION

The API uses a **named** database, `shopassist` (set by `FIRESTORE_DATABASE_ID`). Skip this if it already exists
(`gcloud firestore databases list`).

```powershell
gcloud firestore databases create --database=$DATABASE --location=$REGION --type=firestore-native
```

Collections are created on first write: `orders`, `devices`, `alerts`, `priceOverrides`, `insights`.
No composite indexes are needed.

### 3b. Check the Gemini model responds (optional)

The model is called through the Vertex AI **global** endpoint (`GCP_LOCATION=global`). The global
endpoint has no region prefix in its host. Google picks the serving region, so AI requests
aren't pinned to India. Quick check before deploying:

```powershell
$token = gcloud auth print-access-token
$body = '{"contents":[{"role":"user","parts":[{"text":"Reply with OK"}]}]}'
Invoke-RestMethod -Method Post -ContentType "application/json" -Headers @{ Authorization = "Bearer $token" } -Body $body `
  -Uri "https://aiplatform.googleapis.com/v1/projects/$PROJECT_ID/locations/global/publishers/google/models/${MODEL}:generateContent"
```

A response with a candidate means the model is enabled for the project. A 404 or 403 means the model isn't
available to this project. Change `$MODEL` and the `GEMINI_MODEL` default together.

## 4. ADMIN_KEY secret

```powershell
$ADMIN_KEY = -join ((48..57) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
[IO.File]::WriteAllText("$env:TEMP\admin-key.txt", $ADMIN_KEY)   # no trailing newline
gcloud secrets create ADMIN_KEY --replication-policy=automatic --data-file="$env:TEMP\admin-key.txt"
Remove-Item "$env:TEMP\admin-key.txt"
```

Read it back any time with `gcloud secrets versions access latest --secret ADMIN_KEY`.

## 5. Dedicated service account (least privilege)

```powershell
gcloud iam service-accounts create $SA_NAME --display-name "ShopAssist API"
gcloud projects add-iam-policy-binding $PROJECT_ID --member "serviceAccount:$SA" --role roles/aiplatform.user --condition=None
gcloud projects add-iam-policy-binding $PROJECT_ID --member "serviceAccount:$SA" --role roles/datastore.user --condition=None
# Secret access only on this one secret (narrower than a project-wide grant):
gcloud secrets add-iam-policy-binding ADMIN_KEY --member "serviceAccount:$SA" --role roles/secretmanager.secretAccessor
```

## 6. Deploy

```powershell
npm --prefix backend run sync-data   # make sure backend/src/data matches the app's catalog
gcloud run deploy $SERVICE `
  --source backend `
  --region $REGION `
  --service-account $SA `
  --set-env-vars "GCP_PROJECT_ID=$PROJECT_ID,GCP_LOCATION=$AI_REGION,GEMINI_MODEL=$MODEL,STORE=firestore,FIRESTORE_DATABASE_ID=$DATABASE" `
  --set-secrets "ADMIN_KEY=ADMIN_KEY:latest" `
  --allow-unauthenticated `
  --min-instances 0 `
  --max-instances 3

$API = gcloud run services describe $SERVICE --region $REGION --format "value(status.url)"
Invoke-RestMethod "$API/health"
Invoke-RestMethod "$API/products?limit=2"
```

The first deploy asks to create an Artifact Registry repo (`cloud-run-source-deploy`). Answer **Y**.
If the build fails with a permission error, grant the build service account the builder role and redeploy:

```powershell
$PN = gcloud projects describe $PROJECT_ID --format "value(projectNumber)"
gcloud projects add-iam-policy-binding $PROJECT_ID --member "serviceAccount:$PN-compute@developer.gserviceaccount.com" --role roles/run.builder --condition=None
```

## 7. Point the app at the API

```powershell
"EXPO_PUBLIC_API_URL=$API" | Out-File -Encoding utf8 .env
```

Restart Metro after changing `.env` (`npm run start:dev`). For EAS builds, add the same URL to the
`preview` profile in `eas.json`:

```json
"preview": {
  "distribution": "internal",
  "android": { "buildType": "apk" },
  "env": { "EXPO_PUBLIC_API_URL": "https://shopassist-api-wzpqdigtdq-em.a.run.app" }
}
```

Profile → About → "Data source" shows **Cloud API** when the app uses it.

## 8. Logs

```powershell
gcloud run services logs read $SERVICE --region $REGION --limit 50
gcloud beta run services logs tail $SERVICE --region $REGION      # live (needs the beta component)
```

Every request logs one JSON line. AI calls log `ai.usage` (tokens, latency) and `ai.error`;
pushes log `push.sent`, `push.error` and `push.receipt`. Filter in Logs Explorer with
`resource.labels.service_name="shopassist-api" jsonPayload.message="ai.usage"`.

## 9. Demo admin triggers

```powershell
$API       = gcloud run services describe $SERVICE --region $REGION --format "value(status.url)"
$ADMIN_KEY = gcloud secrets versions access latest --secret ADMIN_KEY
$H         = @{ "x-admin-key" = $ADMIN_KEY }

# Newest orders (to copy the full order id; the app shows only the last 6 characters)
Invoke-RestMethod -Uri "$API/admin/orders" -Headers $H | Format-Table id, status, total, createdAt

# Ship an order → "Your order has shipped" push with Track order / Rate product
$ORDER_ID = (Invoke-RestMethod -Uri "$API/admin/orders" -Headers $H)[0].id
Invoke-RestMethod -Method Post -Uri "$API/admin/orders/$ORDER_ID/ship" -Headers $H

# Mark it delivered (simple push)
Invoke-RestMethod -Method Post -Uri "$API/admin/orders/$ORDER_ID/deliver" -Headers $H

# Price drop 15% on product 121 → push to devices with a price alert on it (Add to cart / View)
Invoke-RestMethod -Method Post -Uri "$API/admin/products/121/price-drop" -Headers $H -ContentType "application/json" -Body '{"percent":15}'
```

The same with `curl.exe` (use `curl.exe`, not the PowerShell `curl` alias):

```powershell
curl.exe -s -X POST "$API/admin/orders/$ORDER_ID/ship" -H "x-admin-key: $ADMIN_KEY"
curl.exe -s -X POST "$API/admin/products/121/price-drop" -H "x-admin-key: $ADMIN_KEY" -H "Content-Type: application/json" -d '{\"percent\":15}'
```

Responses include `pushed` (how many devices Expo accepted). `pushed: 0` with
`note: "No push token registered for this device"` means the app hasn't registered a token
(Expo Go, notifications not allowed, or `.env` not pointing at this API).

## Local development

```powershell
cd backend
npm install
Copy-Item .env.example .env        # then edit: project id, ADMIN_KEY, STORE
npm run dev                        # http://localhost:8080, reloads on change
npm test                           # vitest: catalog, totals, AI post-checks, admin auth
npm run typecheck
```

- `STORE=memory` needs no GCP access (data resets on restart). AI routes then return their safe
  fallbacks unless ADC and `GCP_PROJECT_ID` are set.
- To use the local API from a phone: `EXPO_PUBLIC_API_URL=http://<your-PC-LAN-IP>:8080` in the
  app's `.env` (same Wi-Fi; allow Node through Windows Firewall).

## 10. Test push to one device (no admin key)

The app's **Profile → Demo tools → Push diagnostics → Send me a test push** calls this. From a PC,
copy the device id from the bottom of Push diagnostics (long-press to select):

```powershell
$DEVICE_ID = "<device id>"
Invoke-RestMethod "$API/devices/$DEVICE_ID"                       # { registered, tokenSuffix }
Invoke-RestMethod -Method Post -Uri "$API/devices/$DEVICE_ID/test-push"   # 3 per minute per device
```

`404` means the device never registered a push token (open the app's Push diagnostics → Register again).
