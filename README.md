# robotics-consulting

Static marketing site hosted on GitHub Pages.

## Visitor Counter Backend

GitHub Pages cannot run backend code, so the counter API is deployed separately as a Cloudflare Worker.

- Worker code: `backend/counter-worker/src/worker.js`
- Worker config: `backend/counter-worker/wrangler.toml`
- Worker package: `backend/counter-worker/package.json`
- Worker guide: `backend/counter-worker/README.md`

### Frontend setting

In `index.html`, set `counterApiEndpoint` to your deployed worker URL:

```js
var counterApiEndpoint = "https://<your-worker>.workers.dev/api/counter";
```

Until you replace the placeholder URL, the site cannot auto-update the counter and will only show the fallback value from `assets/counter.json` in owner mode.

### Deploy backend

```bash
cd backend/counter-worker
npm install
npx wrangler login
npx wrangler kv namespace create COUNTER_KV
npm run deploy
```

Before `npm run deploy`, put the returned KV namespace id into `backend/counter-worker/wrangler.toml`.

After deploy:

1. Copy the Worker URL into `index.html`
2. Publish the updated static site to GitHub Pages
3. Open the site in owner mode and verify the footer counter increments

### Owner mode

Counter is visible only in owner mode. Open the site with:

```text
https://<your-domain>/?counter_access=<ownerCounterToken>
```

Token is stored in `index.html` as `ownerCounterToken`.

### Quick verification

Check the backend directly:

```bash
curl "https://<your-worker>.workers.dev/api/counter?mode=get"
curl "https://<your-worker>.workers.dev/api/counter?mode=hit"
```

Then open the site in owner mode and confirm the footer counter is visible and updates.

## Analytics / Tracking Events

Both `index.html` and `prototypes.html` share an identical `rcTrack(name, params, opts)` helper (`index.html:1490-1509`, `prototypes.html:477-496`) that sends events to the Meta Pixel (`fbq`) and, optionally, Google Ads (`gtag`). Sends only happen when `location.hostname === "www.sia-robotics-consulting.eu"` (`rcIsProd`); everywhere else (local dev, previews) events just log to the console via `console.debug("[track]", ...)`, so testing never pollutes the real ad accounts.

| Event | Meta type | Fires on | Page(s) | GA/Ads event |
|---|---|---|---|---|
| `PageView` | standard | every page load | both | — |
| `Scroll50` | custom | scrolled ≥50% of page height (once) | both | — |
| `ViewContent` | standard | `#contact` (index) / `.cta-box` (prototypes) scrolls into view, 30% threshold (once) | both (different target section) | — |
| `FormStart` | custom | focus enters `#contact-form` (once) | index only | — |
| `Contact` | standard | click on WhatsApp contact link | index only | `generate_lead` |
| `Lead` | standard | Web3Forms submit succeeds | index only | `generate_lead` |
| `ChecklistDownload` | custom | click on `#leadmag-link` / `#hero-leadmag-link` (once) | both | `file_download` |
| `CTAClick` | custom | click on a `.btn` inside `.cta`/`.cta-box`/`.mobile-cta-bar` (index; param = button text) or `#cta-button` (prototypes; param fixed to `"prototypes-page"`) (once) | both | `select_content` |
| `GalleryView` | custom | first time the prototypes-page gallery lightbox opens (once) | prototypes only | — |

Meta Events Manager shows localized display names for standard events (e.g. `ViewContent` → "Просмотр контента", `Lead` → "Лид", `Contact` → "Контакт") — same event, just translated in the UI, not a separate event in code.

Rough funnel intent, useful when reading Events Manager reports: `PageView` → `Scroll50` / `ViewContent` / `GalleryView` (engagement) → `CTAClick` / `ChecklistDownload` (intent) → `Lead` / `Contact` (conversion).

