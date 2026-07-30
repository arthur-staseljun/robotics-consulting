# Counter Worker (Cloudflare)

This Worker provides a tiny backend for the site footer counter.

## What is Wrangler?

[Wrangler](https://developers.cloudflare.com/workers/wrangler/) is Cloudflare's own CLI for developing, testing and deploying Workers (and Pages). It's a `devDependency` of this package (see `package.json`), so `npm install` here is enough — no global install needed. You run it via `npx wrangler <command>` or the `npm run dev` / `npm run deploy` scripts below, which just wrap it. `npx wrangler login` opens a browser tab where Cloudflare asks you to authorize the CLI for your account ("Authorization granted to Wrangler") — after that, `wrangler`/`npm run deploy` can push code and manage KV under that account from your terminal.

## API

`GET /api/counter`

- `?mode=get` — returns the running total without incrementing
- `?mode=hit` — increments the running total by 1 (and the matching daily counter, see below) and returns the new total
- `?mode=daily` — returns the count of `hit`s for a single UTC day, without touching anything. Optional `&date=YYYY-MM-DD`; defaults to today (UTC) if omitted. Returns `{ "date": "...", "value": 0 }` for a day with no data, or `400` if `date` isn't `YYYY-MM-DD`.

Example responses:

```json
{ "value": 32 }
```

```json
{ "date": "2026-07-28", "value": 52 }
```

### Why there's a daily breakdown

The running total (`?mode=get`) is a single KV value that gets overwritten on every hit — it only ever answers "what's the number right now", with no history. Meta Pixel's `PageView` isn't deduplicated (it fires on every page load), so it inflates fast whenever the site is reloaded repeatedly for testing. This counter's `hit` only fires once ever per browser (deduplicated client-side via a `localStorage` flag in `index.html`/`prototypes.html`), which makes it a much cleaner cross-check — but only once it's also broken down by day, so a given day's ad/funnel numbers can be lined up against the same day's real unique visitors. Each `hit` now also increments a `daily:YYYY-MM-DD` KV key alongside the total, and `?mode=daily` reads it back.

## Project files

- Entry point: `src/worker.js`
- Local compatibility export: `worker.js`
- Wrangler config: `wrangler.toml`
- Package manifest: `package.json`

## 1) Prerequisites

- Cloudflare account
- Node.js 18+

## 2) Install dependencies

```bash
cd backend/counter-worker
npm install
```

## 3) Login to Cloudflare

```bash
npx wrangler login
```

## 4) Create KV namespace

```bash
npx wrangler kv namespace create COUNTER_KV
```

Copy the returned namespace id into `wrangler.toml` under `[[kv_namespaces]].id`.

## 5) Configure `wrangler.toml`

Set:

- `ALLOWED_ORIGIN` — your production site origin, for example `https://www.sia-robotics-consulting.eu`
- `COUNTER_KEY` — storage key in KV
- `COUNTER_START` — initial counter value

## 6) Validate locally

```bash
npm run check
```

Optional local dev server:

```bash
npm run dev
```

## 7) Deploy

```bash
npm run deploy
```

Wrangler will print a URL like:

```text
https://robotics-counter-worker.<subdomain>.workers.dev
```

Use this in the frontend as:

```js
var counterApiEndpoint = "https://robotics-counter-worker.<subdomain>.workers.dev/api/counter";
```

## 8) Frontend wiring

In the project root `index.html`:

1. Set `counterApiEndpoint` to the deployed Worker URL.
2. Keep `ownerCounterToken` as your private owner-mode token.
3. Publish the updated static site to GitHub Pages.

## 9) Verify after deploy

Direct API checks:

```bash
curl "https://<your-worker>.workers.dev/api/counter?mode=get"
curl "https://<your-worker>.workers.dev/api/counter?mode=hit"
curl "https://<your-worker>.workers.dev/api/counter?mode=daily"
curl "https://<your-worker>.workers.dev/api/counter?mode=daily&date=2026-07-28"
```

Requests without an `Origin` header are allowed intentionally so that `curl` and manual smoke tests work.

Browser checks:

1. Open the site normally — counter should stay hidden.
2. Open the site with `?counter_access=<ownerCounterToken>` — counter should appear.
3. Refresh once as owner — value should persist and continue increasing only when a new browser without the local visit flag hits the page.

## Placeholder frontend behavior

If `index.html` still contains:

```js
var counterApiEndpoint = "https://replace-with-your-worker.workers.dev/api/counter";
```

then the site is not connected to the Worker yet. In that case owner mode will only show the fallback starting value from `assets/counter.json`.

