# Counter Worker (Cloudflare)

This Worker provides a tiny backend for the site footer counter.

## API

`GET /api/counter`

- `?mode=get` — returns current value without incrementing
- `?mode=hit` — increments the counter and returns the new value

Example response:

```json
{
  "value": 32
}
```

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

