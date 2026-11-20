// Copy layer: hooks (12, scored and ranked), slide plans per angle, captions, and the brand checks.
import { money, perMl, ppm, ml, houseTag, checkedLabel } from './data.mjs';

// ---------- inputs ----------
export const ANGLES = {
  verdict: 'Blind-buy verdict for one scent',
  alternatives: 'Love X? Sample its housemates next (replaces "dupe")',
  sample: 'The smart way to sample X (replaces "cheapest sample")',
  seasonal: 'Sample X before a season or occasion',
  guess: 'Guess the price: 3 to 5 bottles, reveal, verdict',
  versus: 'Which costs more per ml? Rounds of pairs',
};
// Requests that break the upmarket rule get rerouted, never shipped as asked.
export const ANGLE_ALIASES = {
  dupe: 'alternatives', dupes: 'alternatives', clone: 'alternatives', 'smells-like': 'alternatives',
  'cheapest-sample': 'sample', cheapest: 'sample', 'cheap-sample': 'sample', budget: 'sample',
  'blind-buy': 'verdict', 'blind-buy-verdict': 'verdict', 'worth-it': 'verdict',
  'guess-the-price': 'guess', 'higher-or-lower': 'versus', 'per-ml': 'versus', season: 'seasonal', gift: 'seasonal',
};
export const AUDIENCES = {
  signature: { label: 'finding a signature scent', tag: '#signaturescent', hook: f => `Is ${f.name} your signature? Test first.`, line: 'Finding a signature is a shortlist, not a lottery ticket.' },
  gift: { label: 'buying a fragrance as a gift', tag: '#giftideas', hook: f => `Gifting ${f.name}? Read this first.`, line: 'Gifting a scent you have never smelled on them is a trust fall. Make it a small one first.' },
  'first-niche': { label: 'buying a first niche bottle', tag: '#nichefragrance', hook: f => `Your first ${f.house}? Start here.`, line: 'First niche bottle? Welcome. The tuition is a sample.' },
  collector: { label: 'collectors adding a bottle', tag: '#perfumecollection', hook: f => `${f.name}, priced per ml`, line: 'For the shelf that already has a waiting list.' },
};
export const CTAS = {
  guide: { slide: 'Full verdict and every price', caption: f => `Full verdict and every price: ${f.pageUrl.replace('https://www.', '')} (link in bio).` },
  'price-book': { slide: 'The free price book', caption: (f, site) => `Free price book, ${site.pricedCount} fragrances with dated prices, at blindbuyguide.com (link in bio).` },
  quiz: { slide: 'Find your signature, free quiz', caption: () => 'Free signature quiz at blindbuyguide.com/find (link in bio).' },
  comment: { slide: 'Which would you sample first?', caption: () => 'Which one would you sample first? Comments are open. Prices for all of them at blindbuyguide.com (link in bio).' },
  save: { slide: 'Save this for checkout day', caption: () => 'Save this for checkout day. Every price, dated, at blindbuyguide.com (link in bio).' },
};
export const SEASONS = {
  winter: { tag: '#winterfragrance', label: 'winter', words: ['vanilla', 'amber', 'tobacco', 'oud', 'incense', 'leather', 'cinnamon', 'tonka', 'benzoin', 'labdanum', 'myrrh', 'patchouli', 'smoke', 'rum', 'cognac', 'chestnut', 'cocoa', 'praline', 'saffron', 'sandalwood', 'resin'] },
  holiday: { tag: '#holidayfragrance', label: 'the holidays', words: ['vanilla', 'amber', 'cinnamon', 'clove', 'incense', 'fir', 'pine', 'tonka', 'praline', 'rum', 'cognac', 'chestnut', 'cocoa', 'myrrh', 'nutmeg', 'ginger', 'saffron'] },
  fall: { tag: '#fallfragrance', label: 'fall', words: ['leather', 'tobacco', 'fig', 'apple', 'cinnamon', 'iris', 'patchouli', 'vetiver', 'cedar', 'suede', 'plum', 'chestnut', 'saffron', 'oud', 'tea'] },
  spring: { tag: '#springfragrance', label: 'spring', words: ['rose', 'peony', 'iris', 'violet', 'magnolia', 'neroli', 'orange blossom', 'lily', 'jasmine', 'pear', 'freesia', 'muguet', 'lilac', 'tea', 'rhubarb', 'litchi'] },
  summer: { tag: '#summerfragrance', label: 'summer', words: ['bergamot', 'lemon', 'neroli', 'grapefruit', 'mandarin', 'citrus', 'sea', 'salt', 'marine', 'aquatic', 'mint', 'fig', 'coconut', 'orange', 'lime', 'vetiver', 'yuzu'] },
};

// ---------- brand checks ----------
const BANNED = ['dupe', 'dupes', 'clone', 'clones', 'cheap', 'cheaper', 'cheapest', 'budget', 'steal', 'bargain', 'smells like', 'smells expensive', 'luxurious', 'sensual', 'journey', 'intoxicating', 'elixir', 'must-have', 'must have', 'compliment monster', 'iconic', 'affordable', 'knockoff', 'inspired by'];
const FAKE_EXPERIENCE = [/\bI\s+(wore|smelled|tested|tried|sprayed|love|own)\b/i, /\bon my skin\b/i, /\bwe (wore|smelled|tested|tried|sprayed)\b/i, /\bmy (bottle|collection)\b/i];

export function brandCheck(texts, names) {
  const issues = [];
  for (const t of texts) {
    let x = ` ${t} `;
    for (const n of names) x = x.split(n).join(' ');
    for (const w of BANNED) if (new RegExp(`[^a-z]${w.replace(/[-]/g, '[- ]')}[^a-z]`, 'i').test(x)) issues.push(`banned word "${w}": ${t}`);
    for (const r of FAKE_EXPERIENCE) if (r.test(x)) issues.push(`sounds like we smelled it: ${t}`);
  }
  return issues;
}
// Every $ figure in the copy must be one of the prices the facts layer produced.
export function priceCheck(texts, allowed) {
  const ok = new Set(allowed);
  const bad = [];
  for (const t of texts) for (const m of t.match(/\$\d[\d,]*(\.\d+)?/g) || []) if (!ok.has(m.replace(/,/g, ''))) bad.push(`${m} is not a site price: ${t}`);
  return bad;
}
export const allowedMoney = fs_ => fs_.flatMap(f => [...f.bottles, ...f.samples, f.head].flatMap(o => [money(o.price), ppm(o)]));

// ---------- hooks ----------
// Score = what the swipe file and playbook say travels in fragrance slideshows.
// Short (1-4 words reached 21x followers vs 6x for 20+ words), games and questions (guess-the-price is a
// top TikTok format), a real number (our data moat), a searched name (say it the way people search it),
// a list promise (34% of viral fragrance reels are lists), an open loop ("until", "before", "one of these").
export function scoreHook(h, f) {
  const words = h.text.replace(/[^\w$'.\s-]/g, ' ').split(/\s+/).filter(Boolean).length;
  const parts = [];
  const add = (pts, why) => { if (pts) parts.push([pts, why]); };
  add(words <= 4 ? 3 : words <= 7 ? 2 : words <= 10 ? 1 : 0, `${words} words`);
  add(/\?|^guess|^which|^rank|higher or lower/i.test(h.text) ? 2 : 0, 'game or question');
  add(/\$\d|\d+ ?ml|\d+%/.test(h.text) ? 2 : 0, 'real number');
  add(f && (h.text.includes(f.name) || h.text.includes(f.house)) ? 1 : 0, 'searched name');
  add(/^\d|\b\d+ (bottles|picks|samples|rounds)\b/i.test(h.text) ? 1 : 0, 'list promise');
  add(/don't|until|before|one of these|trap|isn't|read this/i.test(h.text) ? 1 : 0, 'open loop');
  return { ...h, score: parts.reduce((a, [p]) => a + p, 0), why: parts.map(([p, w]) => `+${p} ${w}`).join(', ') };
}

export function rankHooks(list, f) {
  const seen = new Set();
  const scored = list.filter(h => h.text && !seen.has(h.text) && seen.add(h.text)).map((h, i) => ({ ...scoreHook(h, f), i }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  // top 3 must come from 3 different hook families so the A/B test actually tests something
  const top = [], fam = new Set();
  for (const h of scored) if (top.length < 3 && !fam.has(h.family)) { top.push(h); fam.add(h.family); }
  for (const h of scored) if (top.length < 3 && !top.includes(h)) top.push(h);
  const rest = scored.filter(h => !top.includes(h));
  return [...top.map(h => ({ ...h, pick: true })), ...rest].slice(0, 12).map((h, i) => ({ ...h, rank: i + 1 }));
}

export function hookCandidates(ctx) {
  const { angle, f, aud, season, lineup, rounds } = ctx;
  const P = f && money(f.head.price), S = f?.samples[0] && money(f.samples[0].price);
  const audHook = aud?.hook && f ? { text: aud.hook(f), family: 'audience' } : null;
  const H = ctx.house;
  const list = {
    verdict: () => [
      { text: `Should you blind buy ${f.name}?`, family: 'question' },
      { text: `${f.name}: buy, sample or skip?`, family: 'tier' },
      { text: `Don't blind buy ${f.name} yet.`, family: 'warning' },
      { text: `${f.name} is ${P}. Sample first?`, family: 'price' },
      { text: `Is ${f.name} worth ${P}?`, family: 'question' },
      { text: `Before you spend ${P} on ${f.name}`, family: 'warning' },
      { text: `${P} for ${ml(f.head.size_ml)}. Here's the math.`, family: 'price' },
      { text: `The ${f.name} verdict, in 7 slides`, family: 'promise' },
      { text: `Blind buy or sample first: ${f.name}`, family: 'tier' },
      { text: `${f.name}, priced per ml`, family: 'data' },
      S && { text: `${S} before ${P}.`, family: 'data' },
      audHook,
    ],
    alternatives: () => [
      { text: `Love ${f.name}? Sample these next.`, family: 'promise' },
      { text: `${ctx.mates.length} ${H} bottles to sample after ${f.name}`, family: 'list' },
      { text: `If ${f.name} is your thing`, family: 'open' },
      { text: `${f.name} fans, meet the rest of ${H}`, family: 'open' },
      { text: `The ${H} shelf, priced per ml`, family: 'data' },
      { text: `Beyond ${f.name}: ${ctx.mates.length} ${H} picks`, family: 'list' },
      { text: `Which ${H} would you sample next?`, family: 'question' },
      { text: `${H}, but not ${f.name}`, family: 'open' },
      { text: `Already own ${f.name}? Read this.`, family: 'warning' },
      { text: `${f.name} and its housemates, priced`, family: 'data' },
      { text: `${ctx.mates.length + 1} ${H} bottles. Guess the priciest.`, family: 'game' },
      audHook,
    ],
    sample: () => [
      { text: `Don't buy ${f.name} until you see this.`, family: 'warning' },
      S && { text: `${S} before ${P}.`, family: 'data' },
      { text: `How to sample ${f.name} properly`, family: 'promise' },
      { text: `The ${f.name} sample math`, family: 'data' },
      { text: `Sample ${f.name} first. Here's why.`, family: 'promise' },
      S && { text: `Sampling ${f.name}: ${Math.max(1, Math.round(f.samples[0].price / f.head.price * 100))}% of the bottle`, family: 'data' },
      { text: `Every way to try ${f.name}, priced`, family: 'list' },
      { text: `Save this before you buy ${f.name}`, family: 'warning' },
      { text: `${f.name}: sample sizes, per ml`, family: 'data' },
      { text: `Which ${f.name} sample size?`, family: 'question' },
      { text: `${f.name}, test drive edition`, family: 'open' },
      audHook,
    ],
    seasonal: () => [
      { text: `Sample this before ${season.label}.`, family: 'warning' },
      { text: `Your ${season.label} bottle? Test it first.`, family: 'question' },
      { text: `${f.name} for ${season.label}?`, family: 'question' },
      { text: `The ${season.label} shortlist: ${f.name}`, family: 'list' },
      { text: `${f.name}: the notes, decoded`, family: 'data' },
      { text: `${P} for ${season.label}? Sample first.`, family: 'price' },
      { text: `Save this for ${season.label}`, family: 'warning' },
      { text: `What ${season.label} looks like on paper`, family: 'open' },
      { text: `${f.name}, before ${season.label}`, family: 'open' },
      { text: `Don't buy a ${season.label} bottle blind`, family: 'warning' },
      { text: `${f.name}: ${ctx.seasonNotes.slice(0, 2).join(', ').toLowerCase()} and ${P}`, family: 'data' },
      audHook,
    ],
    guess: () => {
      const ps = lineup.map(x => x.head.price);
      return [
        { text: 'Guess the price.', family: 'game' },
        { text: `One of these is ${money(Math.min(...ps))}.`, family: 'open' },
        { text: `Guess the price: ${H} edition`, family: 'game' },
        { text: `Which ${H} costs the most?`, family: 'question' },
        { text: 'Rank these by price.', family: 'game' },
        { text: `${lineup.length} bottles. One is ${money(Math.max(...ps))}.`, family: 'list' },
        { text: `Price these ${H} bottles`, family: 'game' },
        { text: `How well do you know ${H} prices?`, family: 'question' },
        { text: 'Most per ml? Guess.', family: 'data' },
        { text: `${H}, priced. Guess first.`, family: 'open' },
        { text: 'Guess the price, then the per ml', family: 'data' },
        ctx.aud && { text: ctx.aud === AUDIENCES.gift ? `Gifting ${H}? Guess the price.` : `${H} fans: guess the price.`, family: 'audience' },
      ];
    },
    versus: () => {
      const r1 = rounds[0];
      const pricier = r1[0].head.price > r1[1].head.price ? r1[0] : r1[1];
      const trap = perMl(pricier.head) < perMl((pricier === r1[0] ? r1[1] : r1[0]).head);
      const maxP = Math.max(...rounds.flat().map(x => x.head.price));
      const maxItem = rounds.flat().find(x => x.head.price === maxP);
      const maxRound = rounds.find(r => r.includes(maxItem));
      const maxIsntTop = perMl(maxItem.head) < Math.max(...maxRound.map(x => perMl(x.head)));
      return [
        { text: 'Which costs more per ml?', family: 'game' },
        { text: 'Higher or lower: price per ml', family: 'game' },
        maxIsntTop && { text: `The ${money(maxP)} bottle isn't the priciest per ml.`, family: 'open' },
        { text: 'Guess which costs more per ml', family: 'game' },
        { text: 'Price per ml, round by round', family: 'data' },
        { text: `${rounds.length} rounds. Price per ml.`, family: 'list' },
        { text: 'Bigger bottle, better math?', family: 'question' },
        { text: 'Which would you sample first?', family: 'question' },
        { text: 'Per ml, who wins?', family: 'question' },
        { text: "The price tag lies. Per ml doesn't.", family: 'open' },
        trap ? { text: 'Round 1 is a trap.', family: 'open' } : { text: 'Round 1: which costs more per ml?', family: 'game' },
        ctx.aud && { text: 'Collectors: which costs more per ml?', family: 'audience' },
      ];
    },
  }[angle]();
  return list.filter(Boolean);
}

const list = a => a.length < 3 ? a.join(' and ') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;

// ---------- slide plans ----------
// Slide kinds: hook, bottle, notes, rows, statement, verdict, pair, cta. 6 to 8 slides, site shows up as one tip.
export function plan(ctx) {
  const { angle, f, site } = ctx;
  const S = [];
  const hook = ctx.hook;
  const date = checkedLabel(ctx.all);
  const sampleRow = o => ({ slug: null, name: `${ml(o.size_ml)} sample`, sub: o.retailer, value: money(o.price), valueSub: `${ppm(o)}/ml` });
  const bottleRow = (x, o = x.head, label) => ({ slug: x.slug, name: label || x.name, sub: label ? o.retailer : `${ml(o.size_ml)} · ${o.retailer}`, value: money(o.price), valueSub: `${ppm(o)}/ml` });
  const bottle = (x, kicker, extra = {}) => ({ kind: 'bottle', kicker, title: x.name, sub: [x.house, x.year].filter(Boolean).join(', '), slug: x.slug, price: `${money(x.head.price)} · ${ml(x.head.size_ml)}`, meta: `${x.head.retailer}, in stock`, ...extra });
  const notesSlide = x => {
    const tiers = [['Top', x.notes.top], ['Heart', x.notes.heart], ['Base', x.notes.base]].filter(([, v]) => v.length);
    if (!tiers.length) return x.who ? { kind: 'statement', kicker: 'Who it suits, per our guide', title: x.name, body: x.who, slug: x.slug } : null;
    return { kind: 'notes', kicker: 'What the notes list says', title: x.name, tiers: tiers.map(([l, v]) => ({ label: l, items: v.slice(0, 5).join(', ') })), slug: x.slug };
  };
  const ladder = x => {
    const rows = x.bottles.slice(0, 3).map(o => bottleRow(x, o, ml(o.size_ml) + ' bottle'));
    const smp = [...new Map(x.samples.map(o => [o.size_ml, o])).values()].sort((a, b) => a.size_ml - b.size_ml).slice(0, 2);
    return { kind: 'rows', kicker: 'Price per ml', title: 'Size is a strategy', rows: [...rows, ...smp.map(sampleRow)], foot: `In stock, checked ${date}` };
  };
  const tip = x => ({ kind: 'statement', kicker: 'How we shop it', title: x.samples[0] ? `Sample from ${money(x.samples[0].price)}` : 'Price per ml first', body: `We track bottle and sample prices for ${site.pricedCount} fragrances at blindbuyguide.com, dated, so the math is done before checkout.` });
  const verdictSlide = (x, body) => ({ kind: 'verdict', kicker: 'The verdict', stamp: x.verdict, body: body ?? x.verdictLine, slug: x.slug });
  const cta = () => ({ kind: 'cta', kicker: 'Before you buy', title: ctx.ctaLine || CTAS[ctx.cta]?.slide || ctx.cta, url: 'blindbuyguide.com', body: 'Link in bio', disc: `Prices checked ${date}; they move. Some links on our site are affiliate links.` });

  if (angle === 'verdict') {
    if (!f.verdict) throw new Error(`${f.slug}: no published verdict on the site yet; pick another angle or scent`);
    S.push({ kind: 'hook', title: hook, sub: f.house, slug: f.slug }, bottle(f, 'The bottle'), notesSlide(f), ladder(f), tip(f), verdictSlide(f), cta());
  } else if (angle === 'alternatives') {
    S.push({ kind: 'hook', title: hook, sub: `${f.house} edition`, slug: f.slug }, bottle(f, 'You already like'));
    ctx.matesF.forEach((m, i) => S.push(bottle(m, `Sample next · ${i + 1} of ${ctx.matesF.length}`, { line: m.shared.length ? `Shares ${m.shared.slice(0, 3).join(', ').toLowerCase()} with ${f.name}, per the listed notes` : `Same house, ${money(m.head.price)} for ${ml(m.head.size_ml)}`, meta: m.samples[0] ? `Sample from ${money(m.samples[0].price)}` : `${m.head.retailer}, in stock` })));
    S.push({ kind: 'rows', kicker: 'All of them, per ml', title: `${f.house}, priced`, rows: [f, ...ctx.matesF].map(x => bottleRow(x)), foot: `In stock, checked ${date} · blindbuyguide.com` });
    S.push(cta());
  } else if (angle === 'sample') {
    if (!f.samples.length) throw new Error(`${f.slug}: no in-stock sample price on the site`);
    const s0 = f.samples[0];
    const smp = [...new Map(f.samples.map(o => [`${o.size_ml}|${o.retailer}`, o])).values()].sort((a, b) => a.size_ml - b.size_ml || a.price - b.price).slice(0, 5);
    S.push({ kind: 'hook', title: hook, sub: f.house, slug: f.slug }, bottle(f, 'The bottle'),
      { kind: 'rows', kicker: 'Every way to try it', title: 'Samples, priced', rows: smp.map(sampleRow), foot: `In stock, checked ${date}` },
      { kind: 'statement', kicker: 'The math', big: `${Math.max(1, Math.round(s0.price / f.head.price * 100))}%`, body: `A ${ml(s0.size_ml)} sample at ${money(s0.price)} is ${Math.max(1, Math.round(s0.price / f.head.price * 100))}% of the ${money(f.head.price)} bottle. The most considered ${money(s0.price)} you will spend this month.` },
      tip(f),
      { kind: 'statement', kicker: 'How to test it', title: 'Two days, three checks', body: 'Skin, not paper. Check at 10 minutes, 2 hours and 6 hours, on two different days. Still thinking about it on day three? That is your answer.' },
      cta());
  } else if (angle === 'seasonal') {
    S.push({ kind: 'hook', title: hook, sub: f.house, slug: f.slug }, bottle(f, `For ${ctx.season.label}`), notesSlide(f),
      { kind: 'statement', kicker: `Why it's on our ${ctx.season.label} list`, title: ctx.seasonNotes.slice(0, 3).join(' · '), body: `The listed notes include ${list(ctx.seasonNotes.slice(0, 3)).toLowerCase()}, which is ${ctx.season.label} material on paper. Skin gets the final vote, so sample first.` },
      ladder(f), verdictSlide(f), cta());
  } else if (angle === 'guess') {
    const L = ctx.lineup;
    S.push({ kind: 'hook', title: hook, sub: `${ctx.house} edition`, slug: L[0].slug, note: `Swipe. Answers on slide ${L.length + 2}.` });
    L.forEach((x, i) => S.push({ kind: 'bottle', kicker: `${i + 1} of ${L.length}`, title: x.name, sub: ml(x.head.size_ml), slug: x.slug, q: 'Guess the price' }));
    S.push({ kind: 'rows', kicker: 'The reveal', title: 'In stock, real prices', rows: L.map(x => bottleRow(x)), foot: `Checked ${date}` });
    const byPm = [...L].sort((a, b) => perMl(b.head) - perMl(a.head));
    const gap = Math.round((perMl(byPm[0].head) / perMl(byPm[byPm.length - 1].head) - 1) * 100);
    const smp = L.map(x => x.samples[0]).filter(Boolean).map(o => o.price);
    const withV = L.filter(x => x.verdict === 'Sample first');
    const vLine = withV.length === L.length ? 'Our verdict on all of them: sample first. ' : withV.length ? `Our published verdict on ${list(withV.map(x => x.name))}: sample first. ` : '';
    S.push(verdictSlide({ verdict: withV.length ? 'Sample first' : 'Do the math', slug: byPm[0].slug },
      `${vLine}${byPm[0].name} costs ${gap}% more per ml than ${byPm[byPm.length - 1].name}.${smp.length ? ` Samples run ${money(Math.min(...smp))} to ${money(Math.max(...smp))}.` : ''}`));
    S.push(cta());
  } else if (angle === 'versus') {
    S.push({ kind: 'hook', title: hook, sub: ctx.edition || 'Price per ml edition', slug: ctx.rounds[0][0].slug, note: `Swipe. Answers on slide ${ctx.rounds.length + 2}.` });
    ctx.rounds.forEach((r, i) => S.push({ kind: 'pair', kicker: `Round ${i + 1} of ${ctx.rounds.length}`, items: r.map(x => ({ slug: x.slug, name: x.name, house: x.house, value: money(x.head.price), meta: ml(x.head.size_ml) })), q: 'Which costs more per ml?' }));
    S.push({ kind: 'rows', kicker: 'The reveal', title: 'Shaded costs more per ml', compact: true, rows: ctx.rounds.flatMap((r, i) => { const m = Math.max(...r.map(x => perMl(x.head))); return r.map((x, j) => ({ ...bottleRow(x), hl: perMl(x.head) === m, gapBefore: i > 0 && j === 0 })); }), foot: `In stock, checked ${date}` });
    S.push(cta());
  }
  const out = S.filter(Boolean);
  if (out.length < 6 || out.length > 8) throw new Error(`deck has ${out.length} slides; the format is 6 to 8`);
  return out;
}

// ---------- captions ----------
export function captions(ctx, slides) {
  const { angle, f, site } = ctx;
  const date = checkedLabel(ctx.all);
  const L = ctx.lineup;
  const lead = {
    verdict: () => `${f.name} by ${f.house}: ${money(f.head.price)} for ${ml(f.head.size_ml)} at ${f.head.retailer}${f.samples[0] ? `, or a ${ml(f.samples[0].size_ml)} sample from ${money(f.samples[0].price)}` : ''}. Our verdict: ${f.verdict.toLowerCase()}. A sample tells you if it's your signature or just the store lighting.`,
    alternatives: () => `Already into ${f.name}? The rest of the ${f.house} shelf is worth a sample: ${ctx.matesF.map(m => `${m.name} (${money(m.head.price)}, ${ml(m.head.size_ml)})`).join(', ')}. Same house, different personalities, all priced per ml on the last slide.`,
    sample: () => `${f.name} is ${money(f.head.price)} for ${ml(f.head.size_ml)}. A ${ml(f.samples[0].size_ml)} sample is ${money(f.samples[0].price)} at ${f.samples[0].retailer}. Two days of wear beats two minutes on a paper strip, every time.`,
    seasonal: () => `${f.name} for ${ctx.season.label}: the listed notes include ${list(ctx.seasonNotes.slice(0, 3)).toLowerCase()}. The bottle is ${money(f.head.price)} for ${ml(f.head.size_ml)}${f.samples[0] ? `; a sample is ${money(f.samples[0].price)}` : ''}. Paper is a promise. Skin is the contract.`,
    guess: () => { const byPm = [...L].sort((a, b) => perMl(a.head) - perMl(b.head)); return `${L.length} ${ctx.house} bottles, ${L.length} real in-stock prices. Guess before you swipe. The twist is the per-ml column: ${byPm[0].name} works out to ${ppm(byPm[0].head)}/ml and ${byPm[byPm.length - 1].name} to ${ppm(byPm[byPm.length - 1].head)}/ml. ${(() => { const v = L.filter(x => x.verdict === 'Sample first'); return v.length === L.length ? 'Our verdict across the board: sample first.' : v.length ? `Our published verdict on ${list(v.map(x => x.name))}: sample first.` : ''; })()}`; },
    versus: () => `${ctx.rounds.length} rounds, one question: which costs more per ml? The biggest price tag is not always the worst math. That's not a reason to buy the big one. It's a reason to sample first and decide with your eyes open.`,
  }[angle]();
  const audLine = ctx.aud?.line ? ` ${ctx.aud.line}` : '';
  const first = f || L?.[0] || ctx.rounds?.[0]?.[0];
  const ctaLine = (CTAS[ctx.cta]?.caption || (() => `${ctx.cta} blindbuyguide.com (link in bio).`))({ ...first, pageUrl: ctx.landing || first.pageUrl }, site);
  const tail = ` Prices checked ${date}; they move. ${ctaLine} Affiliate links on the site; we may earn a commission.`;
  const anyF = f || L?.[0] || ctx.rounds[0][0];
  const houses = [...new Set((ctx.all || []).map(x => houseTag(x.house)))].slice(0, 2);
  const angleTag = { verdict: '#blindbuy', alternatives: '#perfumecollection', sample: '#perfumesamples', seasonal: ctx.season?.tag || '#seasonalfragrance', guess: '#guesstheprice', versus: '#fragrancetok' }[angle];
  const tt = [...new Set(['#fragrancetok', '#perfumetok', '#nicheperfume', ...houses, angleTag, ctx.aud?.tag].filter(Boolean))].slice(0, 6);
  const ig = [...new Set([...tt, '#luxuryfragrance', '#fragrancecommunity', '#perfumeaddict', '#signaturescent', '#perfumecollection'])].slice(0, 10);
  const body = `${ctx.hook} ${lead}${audLine}${tail}`;
  return { tiktok: `${body}\n\n${tt.join(' ')}`, instagram: `${body}\n\n${ig.join(' ')}`, anyF };
}
