# Smart Hisab Pro — Deployment Guide

A 100% free, installable PWA finance/production tracker. Google Sheets is the
database, Google Apps Script is the REST API, GitHub Pages hosts the frontend
(so there's no Google "unsafe site" warning banner).

## 📁 Files
- `Code.gs` — Apps Script backend (doGet / doPost, matches your exact sheet schema)
- `index.html` — the entire app (HTML + CSS + JS in one file)
- `manifest.json` — PWA install config
- `sw.js` — service worker (offline app-shell caching)
- `icons/` — placeholder app icons (192, 512, maskable) — swap these for your own logo anytime

## 1) Deploy the Backend (Google Apps Script)

1. Open your Google Sheet (the one with `Income`, `Expense`, `Production`, `Loan` tabs).
2. `Extensions → Apps Script`.
3. Delete any starter code, paste the full contents of `Code.gs`.
4. If you don't have `Fund` / `Fund_Transaction` sheets yet, don't worry — the
   backend auto-creates them (with headers) the first time they're needed.
5. Click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Click **Deploy**, authorize the permissions Google asks for.
7. Copy the **Web app URL** (ends in `/exec`). You'll need it in step 2.

> Redeploying later? Use **Manage deployments → Edit → New version** — the
> `/exec` URL stays the same once you've created it once via "New deployment".

## 2) Configure the Frontend

Open `index.html`, find this line near the top of the `<script>` block:

```js
const API_URL = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
```

Replace it with the `/exec` URL you copied. Save the file.

## 3) Host on GitHub Pages

1. Create a new GitHub repo (e.g. `smart-hisab-pro`).
2. Upload `index.html`, `manifest.json`, `sw.js`, and the `icons/` folder to
   the repo root (keep the folder structure — `icons/icon-192.png` etc.).
3. Repo → **Settings → Pages** → Source: **Deploy from branch** → Branch:
   `main` / root → Save.
4. Your app will be live at `https://<your-username>.github.io/smart-hisab-pro/`.

## 4) Install it as an App on Your Phone

- **Android (Chrome):** open the site → menu (⋮) → "Add to Home screen" /
  "Install app".
- **iPhone (Safari):** open the site → Share icon → "Add to Home Screen".

Once installed, the app icon, splash screen, and full-screen (no browser bar)
experience all come from `manifest.json`.

## How data flows (and CORS)

Google Apps Script's CORS handling is inconsistent for `OPTIONS` preflight
requests, so the frontend deliberately avoids triggering one:
- `GET` requests (`?action=getAll`) are "simple requests" — no preflight.
- `POST` requests are sent with `Content-Type: text/plain` instead of
  `application/json` — this also avoids a preflight — and `Code.gs` parses
  the JSON body manually (`JSON.parse(e.postData.contents)`).

This is the standard, reliable trick for Apps Script + a separately-hosted
frontend. If you ever see a network error in the console, it is almost never
a CORS issue with this setup — check that `API_URL` is correct and that the
deployment's access is set to **Anyone**.

## Offline behavior

- The **app shell** (HTML/CSS/JS, fonts, chart libraries) is cached on first
  visit → the UI now loads instantly, even with zero signal.
- **Data** is cached in `localStorage` after every successful sync. On
  launch, you instantly see the last-synced numbers while a background sync
  runs (see the "সিঙ্ক হচ্ছে..." badge top-right). If the fetch fails, the
  badge switches to "অফলাইন" and you keep working from cached data.
- New entries added while offline are **not queued** in this version (Apps
  Script has no proper offline-write story without a lot of extra
  complexity). If you're offline, adding an entry will show a clear error
  toast rather than silently failing — this is a deliberate simplicity vs.
  robustness tradeoff. Ask me if you'd like an offline write-queue added.

## Dashboard formulas (exactly as you specified)

```
Hand Cash      = Total Income + Production Withdrawn − Total Expense − Loan Paid
Company Due    = Production Total Earned − Production Total Withdrawn
Remaining Loan = Total Loan Taken − Total Loan Paid
Total Expense  = Sum of all Expense entries
```

These live in one place — the `computeTotals()` function in `index.html` — so
they're easy to find and adjust later.

## PDF export note

The PDF export renders the actual on-screen HTML (via `html2canvas` +
`jsPDF`'s `.html()` method) rather than drawing text directly — this is
deliberate, because jsPDF's built-in fonts don't support Bengali glyphs, but
rendering real DOM does. CSV export has no such limitation and opens
perfectly in Excel/Sheets/LibreOffice with correct Bengali text (UTF-8 BOM
included).

## What's new vs. your old app

- Installable PWA with offline app-shell caching + background sync indicator
- Glassmorphism UI, dark mode, bottom-nav app-like layout, swipe-to-delete rows
- Bar chart: Income vs. Expense (or Production Earned vs. Withdrawn), last 6 months
- Doughnut chart with This Month / Last Month / All-time / Custom range filters
- CSV export (all views) + PDF export (History) that correctly renders Bengali
- Toast notifications + skeleton loaders instead of blocking spinners
- Unified History tab merges Income + Expense + Production + Loan + Fund
  transactions into one searchable, filterable timeline
- Full Fund lifecycle: create, deposit (In), spend (Out), progress bar vs.
  target budget, archive / reactivate

## Known things to double-check before real use

1. **Dashboard formulas** — matched to your spec above; sanity-check with a
   week of real data.
2. **Icons** — the included `icons/*.png` are simple placeholders; swap in
   your real logo at the same filenames/sizes.
3. **API_URL** — must be set before the app can load/save anything.
