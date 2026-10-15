// Cloudflare Pages Function: GET /api/products
// Reads your live Printful products server-side (the token never reaches the browser) and caches for 2 minutes.
// Add ?debug=1 to see which source answered and the exact error if something is wrong.

const API = 'https://api.printful.com';
const TTL = 120;

async function pf(path, env) {
  const headers = { Authorization: 'Bearer ' + env.PRINTFUL_TOKEN };
  if (env.PRINTFUL_STORE_ID) headers['X-PF-Store-Id'] = env.PRINTFUL_STORE_ID;
  const r = await fetch(API + path, { headers });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Printful ' + r.status + ': ' + ((b.error && b.error.message) || b.result || 'request failed'));
  return b;
}

// Source 1: Printful's official Products API.
async function fromPrintful(env) {
  const list = await pf('/store/products?limit=100', env);
  const items = (list.result || []).filter(p => !p.is_ignored).slice(0, 60);
  return Promise.all(items.map(async p => {
    let price = null, currency = 'USD', image = p.thumbnail_url;
    try {
      const d = (await pf('/store/products/' + p.id, env)).result || {};
      const v = d.sync_variants || [];
      const prices = v.map(x => parseFloat(x.retail_price)).filter(n => n > 0);
      if (prices.length) price = Math.min(...prices);
      if (v[0] && v[0].currency) currency = v[0].currency;
      if (d.sync_product && d.sync_product.thumbnail_url) image = d.sync_product.thumbnail_url;
    } catch (e) { /* keep list data */ }
    return { id: p.id, name: p.name, image, price, currency };
  }));
}

// Source 2 (fallback): any JSON URL the storefront itself uses. Set SOURCE_JSON_URL; field names are guessed loosely.
async function fromJsonUrl(env) {
  const r = await fetch(env.SOURCE_JSON_URL, { headers: { accept: 'application/json' } });
  if (!r.ok) throw new Error('SOURCE_JSON_URL returned ' + r.status);
  const b = await r.json();
  const arr = Array.isArray(b) ? b : (b.products || b.items || b.result || b.data || []);
  return arr.map((p, i) => ({
    id: p.id || p.product_id || i,
    name: p.name || p.title,
    image: p.thumbnail_url || p.image || p.image_url || (p.images && (p.images[0].src || p.images[0])) || null,
    price: parseFloat(p.retail_price || p.price || (p.variants && p.variants[0] && p.variants[0].price)) || null,
    currency: p.currency || 'USD'
  })).filter(p => p.name);
}

const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function onRequestGet({ request, env, waitUntil }) {
  const url = new URL(request.url), debug = url.searchParams.has('debug');
  const cache = caches.default, key = new Request(url.origin + '/api/products');
  if (!debug) { const hit = await cache.match(key); if (hit) return hit; }

  const storeUrl = env.STORE_URL || 'https://antroa.printful.me/';
  const tpl = env.PRODUCT_URL_TEMPLATE; // e.g. https://antroa.printful.me/product/{slug}-{id}
  let source = null, products = [], error = null;
  try {
    if (env.PRINTFUL_TOKEN) { source = 'printful-api'; products = await fromPrintful(env); }
    else if (env.SOURCE_JSON_URL) { source = 'json-url'; products = await fromJsonUrl(env); }
    else throw new Error('No PRINTFUL_TOKEN or SOURCE_JSON_URL set in Cloudflare.');
  } catch (e) { error = e.message; }

  if (debug) return Response.json({ source, count: products.length, error, sample: products[0] || null }, { headers: { 'cache-control': 'no-store' } });
  if (error) return Response.json({ error: 'upstream' }, { status: 502, headers: { 'cache-control': 'no-store' } });

  products = products.map(p => ({ ...p, url: tpl ? tpl.replace('{id}', p.id).replace('{slug}', slug(p.name)) : storeUrl }));
  const res = Response.json({ products, storeUrl, updated: new Date().toISOString() }, { headers: { 'cache-control': 'public, max-age=' + TTL } });
  waitUntil(cache.put(key, res.clone()));
  return res;
}
