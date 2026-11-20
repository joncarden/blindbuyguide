#!/usr/bin/env node
// Blind Buy Guide slideshow builder: TikTok (1080x1920) + Instagram (1080x1350) decks from real site data.
// Usage:
//   node tools/slideshows/slideshow.mjs --slug delina-edp --angle verdict --audience gift --cta guide [--out DIR]
//   node tools/slideshows/slideshow.mjs --brief tools/slideshows/briefs/01-parfums-de-marly.json [--out DIR]
// Options: --looks editorial,cover,ledger,native  --formats tiktok,instagram  --hooks-only
//          --ref path/to/reference.png [--ref-font serif|sans|mono --ref-align left|center --ref-pos top|center|bottom --ref-label --ref-upper --ref-photo full|framed]
//          --lineup a,b,c (guess)  --rounds a:b,c:d (versus)  --season winter|holiday|fall|spring|summer  --hook "override"
// See .claude/skills/slideshow/SKILL.md for the workflow and rules.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadSite, facts, housemates, money, perMl } from './lib/data.mjs';
import { ANGLES, ANGLE_ALIASES, AUDIENCES, CTAS, SEASONS, hookCandidates, rankHooks, plan, captions, brandCheck, priceCheck, allowedMoney } from './lib/copy.mjs';
import { LOOKS, FORMATS, inspectPhotos, referenceStyle, renderDeck, contactSheet } from './lib/render.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

function args(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) continue;
    const key = k.slice(2), v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) a[key] = true; else { a[key] = v; i++; }
  }
  return a;
}

export async function build(brief, opts = {}) {
  const site = loadSite(root);
  const warnings = [];
  let angle = String(brief.angle || 'verdict').toLowerCase();
  if (ANGLE_ALIASES[angle]) {
    if (['alternatives', 'sample'].includes(ANGLE_ALIASES[angle]) && !['alternatives', 'sample'].includes(angle))
      warnings.push(`angle "${angle}" breaks the upmarket rule (no dupes, no cheap/cheapest); built "${ANGLE_ALIASES[angle]}" instead`);
    angle = ANGLE_ALIASES[angle];
  }
  if (!ANGLES[angle]) throw new Error(`unknown angle "${angle}". Angles: ${Object.keys(ANGLES).join(', ')}`);
  const aud = AUDIENCES[brief.audience] || (brief.audience ? { label: brief.audience, tag: null, hook: null, line: '' } : null);
  const cta = brief.cta || 'guide';
  const looks = brief.looks || Object.keys(LOOKS);
  const formats = brief.formats || Object.keys(FORMATS);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    // photos for everything we might show
    const lineupSlugs = brief.lineup || [];
    const roundSlugs = (brief.rounds || []).flat();
    const anchor = brief.slug || lineupSlugs[0] || roundSlugs[0];
    if (!anchor) throw new Error('need a slug (or a lineup / rounds)');
    const anchorHouse = site.bySlug[anchor]?.house;
    const { houseKey } = await import('./lib/data.mjs');
    const houseSlugs = site.scents.filter(s => houseKey(s.house) === houseKey(anchorHouse)).map(s => s.slug);
    const photos = await inspectPhotos(page, root, [...new Set([anchor, ...lineupSlugs, ...roundSlugs, ...houseSlugs])]);

    const ctx = { angle, aud, cta, site, ctaLine: brief.ctaLine, edition: brief.edition };
    const need = x => { const f = facts(site, x, photos); if (!photos[x]?.ok) warnings.push(`${x}: ${photos[x]?.why}; slides show text only for it`); return f; };
    if (angle === 'guess') {
      let L = lineupSlugs;
      if (!L.length) { const f0 = need(anchor); L = [anchor, ...housemates(site, f0, photos, 3).map(m => m.slug)]; }
      ctx.lineup = L.map(need); ctx.house = ctx.lineup[0].house; ctx.all = ctx.lineup;
      ctx.f = null;
    } else if (angle === 'versus') {
      if (!brief.rounds?.length) throw new Error('versus needs rounds: [[a,b],[c,d],...]');
      ctx.rounds = brief.rounds.map(r => r.map(need)); ctx.all = ctx.rounds.flat(); ctx.house = 'Price per ml';
    } else {
      ctx.f = need(anchor); ctx.house = ctx.f.house; ctx.all = [ctx.f];
      if (angle === 'alternatives') {
        ctx.mates = housemates(site, ctx.f, photos, 3);
        if (ctx.mates.length < 2) throw new Error(`${anchor}: fewer than 2 priced, photographed housemates on the site`);
        ctx.matesF = ctx.mates.map(m => ({ ...facts(site, m.slug, photos), shared: m.shared }));
        ctx.all = [ctx.f, ...ctx.matesF];
      }
      if (angle === 'seasonal') {
        ctx.season = SEASONS[brief.season || 'winter'] || { label: brief.season, words: [] };
        ctx.seasonNotes = ctx.f.flatNotes.filter(n => ctx.season.words.some(w => n.toLowerCase().includes(w)));
        if (!ctx.seasonNotes.length) throw new Error(`${anchor}: its listed notes don't support a ${ctx.season.label} claim; pick another scent or season`);
      }
    }

    ctx.landing = angle === 'guess' ? (ctx.lineup[0].houseGuideUrl || ctx.lineup[0].pageUrl) : ctx.f?.pageUrl;
    // hooks
    const ranked = rankHooks(hookCandidates(ctx), ctx.f || { name: ctx.house, house: ctx.house });
    const names = [...new Set(ctx.all.flatMap(x => [x.name, x.fullName, x.house]))];
    const okHooks = ranked.filter(h => !brandCheck([h.text], names).length);
    ctx.hook = brief.hook || okHooks[0].text;
    const slides = plan(ctx);
    const cap = captions(ctx, slides);

    // checks: banned words, fake experience, every $ is a site price
    const texts = [...slides.flatMap(s => [s.title, s.sub, s.body, s.line, s.price, s.meta, s.kicker, s.stamp, s.note, s.foot, ...(s.rows || []).flatMap(r => [r.name, r.sub, r.value, r.valueSub]), ...(s.items || []).flatMap(x => [x.name, x.value])]).filter(Boolean), cap.tiktok, cap.instagram, ctx.hook];
    const issues = [...brandCheck(texts, names), ...priceCheck(texts, allowedMoney(ctx.all))];

    const id = brief.id || `${anchor}-${angle}`;
    const out = path.resolve(opts.out || path.join(root, 'tools/slideshows/out'), id);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'hooks.md'), hooksMd(id, angle, aud, cta, ranked, ctx.hook));
    fs.writeFileSync(path.join(out, 'caption-tiktok.txt'), cap.tiktok + '\n');
    fs.writeFileSync(path.join(out, 'caption-instagram.txt'), cap.instagram + '\n');
    fs.writeFileSync(path.join(out, 'facts.json'), JSON.stringify({ brief, angle, hook: ctx.hook, warnings, issues, slides, sources: ctx.all.map(x => ({ slug: x.slug, page: x.pageUrl, headline: x.head, samples: x.samples.slice(0, 3), photo: photos[x.slug]?.ok ? `images/studio/${x.slug}.webp` : null })) }, null, 2));
    fs.writeFileSync(path.join(out, 'check.txt'), [`Checks for ${id}`, issues.length ? issues.map(i => 'FAIL ' + i).join('\n') : 'PASS banned words, fake-experience phrases, every $ figure matches a site price', ...warnings.map(w => 'NOTE ' + w), 'HUMAN read every slide on a phone; re-check prices on posting day.'].join('\n') + '\n');
    if (opts.hooksOnly) return { out, issues, warnings };
    if (issues.length && !opts.force) throw new Error(`copy checks failed (see ${path.join(out, 'check.txt')}):\n` + issues.join('\n'));

    const studio = Object.values(photos).find(p => p.ok) || { topColor: '#f6f2ea', bottomColor: '#ece6dc' };
    const ref = brief.ref ? await referenceStyle(page, brief.ref) : null;
    const allLooks = ref ? [...looks, 'ref'] : looks;
    const fontsDir = path.join(root, 'tools/pinterest/fonts');
    for (const format of formats) {
      const rows = [];
      for (const look of allLooks) {
        const files = await renderDeck(page, { slides, look, format, photos, studio, ref, outDir: path.join(out, format, look), fontsDir });
        rows.push({ label: look, files });
      }
      await contactSheet(page, rows, path.join(out, `contact-${format}.jpg`), `${id} · ${format} ${FORMATS[format].w}x${FORMATS[format].h} · hook: ${ctx.hook}`);
    }
    return { out, issues, warnings, slides: slides.length };
  } finally { await browser.close(); }
}

function hooksMd(id, angle, aud, cta, ranked, used) {
  return `# Hooks: ${id}

Angle: ${angle} (${ANGLES[angle]}) · Audience: ${aud?.label || 'general'} · CTA: ${CTAS[cta]?.slide || cta}
Deck uses: **${used}**

Top 3 (different hook families, so a 3-day A/B test actually tests something). Post the same slides with each hook, one a day; judge on saves and comments, not views.

| Rank | Hook | Score | Why |
|---|---|---|---|
${ranked.map(h => `| ${h.rank}${h.pick ? ' ★' : ''} | ${h.text.replace(/\|/g, '/')} | ${h.score} | ${h.why} (${h.family}) |`).join('\n')}

Scoring (from docs/social/swipe-file.md + tiktok-playbook.md): 1-4 words +3, 5-7 +2, 8-10 +1 (short hooks reached 21x followers vs 6x for 20+ words); game or question +2 (guess-the-price and per-ml games are top TikTok formats); a real number +2 (our price data is the moat); the scent or house name +1 (say it the way people search it); a list promise +1 (34% of viral fragrance reels are lists); an open loop +1.
`;
}

// ---------- CLI ----------
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = args(process.argv.slice(2));
  let brief = a.brief ? JSON.parse(fs.readFileSync(a.brief, 'utf8')) : {};
  const pick = (k, v) => { if (v !== undefined) brief[k] = v; };
  pick('slug', a.slug); pick('angle', a.angle); pick('audience', a.audience); pick('cta', a.cta); pick('season', a.season); pick('hook', a.hook); pick('id', a.id);
  if (a.lineup) brief.lineup = a.lineup.split(',');
  if (a.rounds) brief.rounds = a.rounds.split(',').map(r => r.split(':'));
  if (a.looks) brief.looks = a.looks.split(',');
  if (a.formats) brief.formats = a.formats.split(',');
  if (a.ref) brief.ref = { image: a.ref, font: a['ref-font'], align: a['ref-align'], textPos: a['ref-pos'], label: a['ref-label'] ? true : undefined, case: a['ref-upper'] ? 'upper' : undefined, photo: a['ref-photo'] };
  if (a.help || (!brief.slug && !brief.lineup && !brief.rounds)) {
    console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 10).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
    console.log('\nAngles:', Object.keys(ANGLES).join(', '), '\nAudiences:', Object.keys(AUDIENCES).join(', '), '(or free text)\nCTAs:', Object.keys(CTAS).join(', '), '\nLooks:', Object.keys(LOOKS).join(', '));
    process.exit(a.help ? 0 : 1);
  }
  build(brief, { out: a.out, hooksOnly: !!a['hooks-only'], force: !!a.force })
    .then(r => { console.log(`${r.out}${r.slides ? ` · ${r.slides} slides` : ''}`); r.warnings.forEach(w => console.log('note:', w)); r.issues.forEach(i => console.log('check:', i)); })
    .catch(e => { console.error('error:', e.message); process.exit(1); });
}
