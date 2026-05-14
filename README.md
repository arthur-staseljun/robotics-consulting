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

