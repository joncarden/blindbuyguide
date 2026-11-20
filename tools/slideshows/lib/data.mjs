// Facts layer: everything a slideshow says comes from data/scents.json and images/studio.
// Nothing here invents a number. If the site has no in-stock USD price, the build stops.
import fs from 'fs';
import path from 'path';

export const SITE = 'https://www.blindbuyguide.com';

export function loadSite(root) {
  const scents = JSON.parse(fs.readFileSync(path.join(root, 'data/scents.json'), 'utf8'));
  const bySlug = Object.fromEntries(scents.map(s => [s.slug, s]));
  const priced = scents.filter(s => bottleOffers(s).length);
  return { root, scents, bySlug, pricedCount: priced.length };
}

const usd = o => o && o.in_stock !== false && o.currency === 'USD' && Number(o.price) > 0 && Number(o.size_ml) > 0;
export const bottleOffers = s => (s.prices || []).filter(usd);
export const sampleOffers = s => (s.samples || []).filter(usd).sort((a, b) => a.price - b.price || a.size_ml - b.size_ml);

export const money = n => '$' + (Number.isInteger(+n) ? String(+n) : (+n).toFixed(2));
export const perMl = o => o.price / o.size_ml;
export const ppm = o => '$' + perMl(o).toFixed(2);
export const ml = n => (Number.isInteger(+n) ? String(+n) : String(+(+n).toFixed(2))) + ' ml';

// "Bond No.9" / "Bond No. 9", "By Kilian" / "Kilian Paris", "Initio Parfums Privés" ... -> one key
export function houseKey(h) {
  return String(h || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\(private blend\)/, '').replace(/^editions de parfums /, '').replace(/^by /, '')
    .replace(/ paris$/, '').replace(/ (parfums prives|parfums|prives)$/, '')
    .replace(/no\.?\s*9/, 'no9').replace(/[^a-z0-9]+/g, ' ').trim();
}
const HOUSE_DISPLAY = { 'maison francis kurkdjian': 'MFK', byredo: 'Byredo', kilian: 'Kilian', initio: 'Initio', roja: 'Roja', 'frederic malle': 'Frederic Malle', 'tom ford': 'Tom Ford', 'bond no9': 'Bond No. 9' };
export const houseName = h => HOUSE_DISPLAY[houseKey(h)] || h;
export const houseTag = h => '#' + houseKey(h).replace(/\s+/g, '');

const CONC = /\s+(eau de parfum intense|eau de parfum|extrait de parfum|eau de toilette|eau de cologne|parfum|extrait|cologne|edp|edt)$/i;
export function shortName(s) {
  let n = s.name.trim();
  for (const h of [s.house, houseName(s.house), 'Tom Ford', 'Maison Margiela', 'Parfums de Marly', 'Le Labo', 'Kilian', 'By Kilian', 'Creed', 'Byredo', 'Initio']) {
    if (h && n.toLowerCase().startsWith(h.toLowerCase() + ' ') && n.length > h.length + 3) { n = n.slice(h.length + 1); break; }
  }
  for (let i = 0; i < 2; i++) n = n.replace(CONC, '');
  return n.trim();
}

// Headline bottle: an in-stock USD offer at a familiar size (closest to 100 ml within 70-125, else the largest),
// lowest price at that size.
export function headlineOffer(s) {
  const offers = bottleOffers(s);
  if (!offers.length) return null;
  const mid = offers.filter(o => o.size_ml >= 70 && o.size_ml <= 125);
  const pool = mid.length ? mid : offers;
  const target = mid.length ? 100 : Math.max(...pool.map(o => o.size_ml));
  const best = Math.min(...pool.map(o => Math.abs(o.size_ml - target)));
  return pool.filter(o => Math.abs(o.size_ml - target) === best).sort((a, b) => a.price - b.price)[0];
}

const VERDICT = { sample_first: 'Sample first', buy: 'Safe to blind buy', skip: 'Skip it' };

export function facts(site, slug, photoInfo) {
  const s = site.bySlug[slug];
  if (!s) throw new Error(`unknown slug "${slug}" (not in data/scents.json)`);
  const head = headlineOffer(s);
  if (!head) throw new Error(`${slug}: no in-stock USD bottle price on the site, so no slideshow (we never invent prices)`);
  const bottles = bottleOffers(s).sort((a, b) => perMl(a) - perMl(b));
  const samples = sampleOffers(s);
  const notes = { top: s.notes?.top || [], heart: s.notes?.heart || [], base: s.notes?.base || [] };
  const guide = `guides/is-${slug}-worth-it`;
  const hk = houseKey(s.house);
  const houseGuide = `guides/how-to-find-your-${{ 'parfums de marly': 'parfums-de-marly', 'tom ford': 'tom-ford', 'le labo': 'le-labo', 'maison francis kurkdjian': 'mfk' }[hk] || hk.replace(/\s+/g, '-')}`;
  const used = [head, ...bottles, ...samples.slice(0, 5)];
  const checked = used.map(o => o.checked || o.date_checked).filter(Boolean).sort();
  return {
    slug, raw: s,
    name: shortName(s), fullName: s.name, house: houseName(s.house), houseKey: hk,
    year: s.year || null, concentration: s.concentration || null, perfumer: s.perfumer || null,
    head, bottles, samples, notes,
    flatNotes: [...notes.top, ...notes.heart, ...notes.base],
    advice: s.advice || null, verdict: VERDICT[s.advice] || null,
    verdictLine: s.verdictLine || s.summary || '', who: s.who || '',
    pageUrl: fs.existsSync(path.join(site.root, guide, 'index.html')) ? `${SITE}/${guide}/` : `${SITE}/scents/${slug}/`,
    houseGuideUrl: fs.existsSync(path.join(site.root, houseGuide, 'index.html')) ? `${SITE}/${houseGuide}/` : null,
    photo: photoInfo?.[slug] || null,
    checkedFrom: checked[0] || null, checkedTo: checked[checked.length - 1] || null,
  };
}

export function housemates(site, f, photos, n = 3) {
  const mine = new Set(f.flatNotes.map(x => x.toLowerCase()));
  return site.scents
    .filter(s => s.slug !== f.slug && shortName(s) !== f.name && houseKey(s.house) === f.houseKey && headlineOffer(s) && photos[s.slug]?.ok)
    .map(s => {
      const shared = [...new Set([...(s.notes?.top || []), ...(s.notes?.heart || []), ...(s.notes?.base || [])])].filter(x => mine.has(x.toLowerCase()));
      return { slug: s.slug, shared, gap: Math.abs(headlineOffer(s).price - f.head.price) };
    })
    .sort((a, b) => b.shared.length - a.shared.length || a.gap - b.gap)
    .slice(0, n);
}

export const checkedLabel = f => {
  const fs_ = [].concat(f).filter(Boolean);
  const ds = fs_.flatMap(x => [x.checkedFrom, x.checkedTo]).filter(Boolean).sort();
  if (!ds.length) return '';
  const fmt = d => { const [y, m, dd] = d.split('-'); return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1]} ${+dd}, ${y}`; };
  return ds[0] === ds[ds.length - 1] ? fmt(ds[0]) : `${fmt(ds[0]).replace(/, \d+$/, '')} to ${fmt(ds[ds.length - 1])}`;
};
