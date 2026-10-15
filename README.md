# Vantage (vantage.antroa.com)

Static site + one Cloudflare Pages Function.

```
index.html  style.css  app.js
assets/vantage-logo.png
functions/api/products.js   <- live product sync (server side)
```

## Cloudflare setup
1. Push this folder to a GitHub repo.
2. Workers & Pages > Create > Pages > Connect to Git. Framework: None. Build command: (empty). Output directory: `/`.
3. Pages project > Settings > Environment variables (Production), add:
   - `PRINTFUL_TOKEN` (type Secret): token from developers.printful.com > Tokens, scope `sync_products` (read).
   - `PRINTFUL_STORE_ID`: your store ID (find it with `curl -H "Authorization: Bearer TOKEN" https://api.printful.com/stores`).
   - `STORE_URL`: `https://antroa.printful.me/`
   - Optional `PRODUCT_URL_TEMPLATE`: e.g. `https://antroa.printful.me/product/{slug}-{id}` (copy a real product link from your store to get the pattern right).
   - Optional `SOURCE_JSON_URL`: fallback if the Printful API doesn't list Quick Store products (see below).
4. Pages project > Custom domains > Set up a domain > `vantage.antroa.com`. Because antroa.com is on Cloudflare, it adds the DNS record for you.
5. Redeploy, then open `https://vantage.antroa.com/api/products?debug=1`. You want `"source":"printful-api"` and a count above 0.

## If `count` is 0 or there's an error
Quick Stores are Printful-hosted and the documented Products API targets "Manual order / API" stores.
Open antroa.printful.me, DevTools > Network > Fetch/XHR, reload, find the request that returns your products as JSON,
and set that URL as `SOURCE_JSON_URL` (and remove `PRINTFUL_TOKEN`). The function maps common field names automatically.

## Refresh timing
Products refresh every 12 hours. To update right now, set an env var `REFRESH_KEY` (any long random text) and open `/api/products?refresh=THAT_TEXT` once.
