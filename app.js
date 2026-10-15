// Pulls the live product list from /api/products (a Cloudflare Pages Function that reads your Printful store, refreshed every 12 hours).
(function () {
  var grid = document.getElementById('grid'), status = document.getElementById('status'), count = document.getElementById('count');
  var STORE = 'https://antroa.printful.me/';

  function money(n, cur) {
    try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur || 'USD' }).format(n); }
    catch (e) { return '$' + Number(n).toFixed(2); }
  }
  function safeUrl(u) { return /^https:\/\//i.test(u || '') ? u : STORE; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function card(p) {
    var a = el('a', 'card'); a.href = safeUrl(p.url); a.rel = 'noopener'; a.dataset.tone = String(Math.abs(parseInt(p.id, 10) || 0) % 8);
    a.appendChild(el('div', 'card-head', p.name));
    var ph = el('div', 'card-photo');
    if (p.image) { var i = el('img'); i.src = p.image; i.alt = p.name; i.loading = 'lazy'; ph.appendChild(i); }
    a.appendChild(ph);
    var f = el('div', 'card-foot'), pr = el('div', 'price');
    if (p.price != null) { pr.appendChild(el('small', null, 'From')); pr.appendChild(document.createTextNode(money(p.price, p.currency))); }
    f.appendChild(pr); f.appendChild(el('span', 'buy', 'Buy now')); a.appendChild(f);
    return a;
  }

  function showStoreLink(msg) {
    status.textContent = msg + ' ';
    var l = el('a', null, 'Shop the official store'); l.href = STORE; status.appendChild(l);
  }

  function load() {
    fetch('/api/products').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (d) {
        STORE = safeUrl(d.storeUrl);
        ['store-link', 'footer-store'].forEach(function (id) { document.getElementById(id).href = STORE; });
        var list = d.products || [];
        grid.replaceChildren.apply(grid, list.map(card));
        count.textContent = list.length ? list.length + (list.length === 1 ? ' piece' : ' pieces') : '';
        if (list.length) status.textContent = ''; else showStoreLink('Nothing is live yet. The first drop is on the way.');
      })
      .catch(function () { if (!grid.children.length) showStoreLink('The drop will not load right now.'); });
  }

  load();
})();

