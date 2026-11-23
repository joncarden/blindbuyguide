// Checks every built page's JSON-LD: any Product must carry offers, review or aggregateRating
// (Google Search Console "Product snippets" requirement). Usage: node tools/seo/check-product-schema.mjs [siteDir]
// Exits 1 if any Product lacks all three, or an AggregateOffer lacks lowPrice/priceCurrency/offerCount.
import fs from 'fs'; import path from 'path';
const root = path.resolve(process.argv[2] || '.');
const skip = new Set(['node_modules', '.git', 'site', 'docs', 'tools']);
const files = [];
(function walk(d){ for (const e of fs.readdirSync(d, {withFileTypes: true})) {
  if (e.isDirectory()) { if (!skip.has(e.name) || d !== root) walk(path.join(d, e.name)); }
  else if (e.name.endsWith('.html')) files.push(path.join(d, e.name)); } })(root);
const flat = o => !o || typeof o !== 'object' ? [] : Array.isArray(o) ? o.flatMap(flat) : [o, ...flat(o['@graph'] || [])];
const isProduct = o => [].concat(o['@type'] || []).includes('Product');
let pages = 0, withProduct = 0, ok = 0, bad = [], badOffer = [], scentPages = 0, scentNoProduct = 0, parseErr = 0;
const avail = {};
for (const f of files) {
  pages++; const h = fs.readFileSync(f, 'utf8'); const rel = path.relative(root, f);
  const isScent = /^scents\/[^/]+\/index\.html$/.test(rel); if (isScent) scentPages++;
  const objs = [];
  for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try { objs.push(...flat(JSON.parse(m[1]))); } catch { parseErr++; } }
  const prods = objs.filter(isProduct);
  if (!prods.length) { if (isScent) scentNoProduct++; continue; }
  withProduct++;
  let good = true;
  for (const p of prods) {
    if (!p.offers && !p.review && !p.aggregateRating) { good = false; continue; }
    for (const o of [].concat(p.offers || [])) {
      if (o['@type'] === 'AggregateOffer' && !(o.lowPrice && o.priceCurrency && o.offerCount)) { good = false; badOffer.push(rel); }
      if (o.priceCurrency && o.priceCurrency !== 'USD') { good = false; badOffer.push(rel); }
      const a = String(o.availability || 'none').replace('https://schema.org/', ''); avail[a] = (avail[a] || 0) + 1;
    }
  }
  if (good) ok++; else bad.push(rel);
}
console.log(JSON.stringify({site: root, htmlPages: pages, scentPages, pagesWithProduct: withProduct,
  productWithOffers: ok, productMissingOffers: bad.length, scentPagesWithoutProduct: scentNoProduct,
  offerAvailability: avail, jsonLdParseErrors: parseErr, examplesMissing: bad.slice(0, 8), badAggregateOffer: [...new Set(badOffer)].slice(0, 8)}, null, 2));
process.exit(bad.length || parseErr ? 1 : 0);
