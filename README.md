# robotics-consulting

Static marketing site hosted on GitHub Pages.

## Local Development

No build step — it's plain HTML/CSS/JS. To preview changes:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

**Nothing here is live until it's committed and pushed.** GitHub Pages serves whatever is on the deployed branch, so checking `www.sia-robotics-consulting.eu` while iterating locally will show the old site — always verify against `localhost`, not the production URL, while a change is still uncommitted.

### Cache-busting

`index.html` loads `locales/*.json` (via the `i18n-version` meta tag) and `assets/css/main.css` with a `?v=YYYY-MM-DD-NN` query param specifically so browsers don't serve a stale cached copy after an edit. **When editing either**, bump the corresponding `?v=` value (the `i18n-version` meta tag for JSON, the `main.css` link's query string for CSS) — otherwise a hard refresh (`Cmd+Shift+R`, or DevTools → Network → "Disable cache") may be needed to see the change even after reloading.

This convention is *not* applied consistently: `assets/css/prototypes.css` and none of the `assets/js/*.js` files are cache-busted at all. Editing those currently relies on the browser's normal reload behavior (or a hard refresh) to pick up changes — worth fixing the same way if it causes confusion again.

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
curl "https://<your-worker>.workers.dev/api/counter?mode=daily"
```

Then open the site in owner mode and confirm the footer counter is visible and updates.

### Daily breakdown

`?mode=daily` (optional `&date=YYYY-MM-DD`, defaults to today UTC) returns `{ "date": "...", "value": N }` — how many unique visitors first hit on that specific day, as opposed to `?mode=get`'s single running total. Useful for lining up a specific day's real traffic against that day's ad/funnel numbers. See `backend/counter-worker/README.md` for details on how it's stored.

### What is Wrangler?

[Wrangler](https://developers.cloudflare.com/workers/wrangler/) is Cloudflare's CLI for developing and deploying Workers/Pages — it's already a dependency of `backend/counter-worker` (`npm install` there is enough, no global install needed). `npx wrangler login` opens a browser tab to authorize the CLI against your Cloudflare account; once granted, `npm run deploy` (which wraps `wrangler deploy`) can push code and read/write KV from your terminal.

## Analytics / Tracking Events

Both `index.html` and `prototypes.html` share an identical `rcTrack(name, params, opts)` helper that sends events to the Meta Pixel (`fbq`) and, optionally, Google Ads (`gtag`). Sends only happen when `location.hostname === "www.sia-robotics-consulting.eu"` (`rcIsProd`); everywhere else (local dev, previews) events just log to the console via `console.debug("[track]", ...)`, so testing on localhost/preview never pollutes the real ad accounts.

**Testing on the live prod domain itself** (e.g. clicking through the real site to verify a new trigger fires correctly) still hits `rcIsProd`, so it *would* normally send real events to Meta/Ads. To test there without polluting the stats, open the site once with `?rc_debug=1` — this sets a `localStorage` flag (`rc-debug-mode`) that forces the same console-only behavior as off-prod, even on the real domain, until you clear it with `?rc_debug=0`. Neither the Meta Pixel nor `gtag('config', ...)` load at all while the flag is set (both are gated on the same `rcIsProd`).

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

