// Renders 1000x1500 Pinterest pins from a pins.json batch file.
// Usage: node tools/pinterest/render.mjs docs/social/pinterest/batch-1/pins.json [pin-id]
// Bottle photos come from images/studio/<slug>.webp (real packshots on one cream backdrop).
// Typography: Cormorant Garamond (site serif, OFL, in ./fonts) + Inter. No AI imagery.
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const [, , pinsFile, only] = process.argv;
const batch = JSON.parse(fs.readFileSync(pinsFile, 'utf8'));
const outDir = path.dirname(path.resolve(pinsFile));
const font = f => 'file://' + path.join(here, 'fonts', f);
const photo = s => {
  const f = path.join(root, 'images/studio', s + '.webp');
  if (!fs.existsSync(f)) throw new Error('missing studio photo ' + f);
  return 'file://' + f;
};
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const css = `
@font-face{font-family:CG;src:url(${font('cormorant-garamond.woff2')}) format('woff2');font-weight:300 700;font-style:normal}
@font-face{font-family:CG;src:url(${font('cormorant-garamond-italic.woff2')}) format('woff2');font-weight:300 700;font-style:italic}
:root{--bg:#f6f2ea;--ink:#17140f;--accent:#7a5b2e;--muted:#6b6259;--line:#ddd4c4;--card:#fbf9f4}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:1000px;height:1500px}
body{background:var(--bg);color:var(--ink);font-family:Inter,'DejaVu Sans',sans-serif;position:relative;overflow:hidden}
.pin{position:absolute;inset:0;padding:78px 80px 0;display:flex;flex-direction:column}
.brand{font-family:CG;font-weight:600;font-size:30px;letter-spacing:.02em;text-align:center;color:var(--ink)}
.brand:after{content:'';display:block;width:56px;height:2px;background:var(--accent);margin:18px auto 0}
.k{font-size:24px;font-weight:600;letter-spacing:.2em;text-transform:uppercase;color:var(--accent);text-align:center;margin-top:34px}
.h{font-family:CG;font-weight:700;font-size:96px;line-height:.98;text-align:center;margin-top:16px;letter-spacing:-.01em}
.h.s{font-size:80px}
.house{font-family:CG;font-style:italic;font-size:38px;color:var(--muted);text-align:center;margin-top:10px}
.sub{font-family:CG;font-style:italic;font-size:40px;color:var(--muted);text-align:center;margin-top:14px;line-height:1.15}
.bottle{display:block;margin:0 auto;object-fit:contain;}
.stamp{display:inline-block;border:3px solid var(--ink);padding:14px 30px;font-size:30px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;background:var(--bg)}
.center{text-align:center}
.price{font-size:32px;font-weight:500;text-align:center;margin-top:22px}
.line{font-family:CG;font-style:italic;font-weight:600;font-size:42px;text-align:center;line-height:1.15;margin-top:28px}
.foot{position:absolute;left:0;right:0;bottom:44px;text-align:center;font-size:21px;color:var(--muted);letter-spacing:.02em}
.foot b{display:block;color:var(--ink);font-weight:600;letter-spacing:.16em;text-transform:uppercase;font-size:22px;margin-bottom:8px}
.tier{display:grid;grid-template-columns:150px 1fr;align-items:center;border-top:2px solid var(--line);padding:20px 0}
.tier:last-child{border-bottom:2px solid var(--line)}
.tier .l{font-size:22px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}
.tier .v{font-family:CG;font-weight:600;font-size:42px;line-height:1.1}
.row{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:baseline;border-top:2px solid var(--line);padding:16px 0}
.row:last-child{border-bottom:2px solid var(--line)}
.row .l{font-size:27px;color:var(--muted)}
.row .v{font-family:CG;font-weight:700;font-size:44px;text-align:right}
.item{display:grid;grid-template-columns:170px 1fr auto;gap:26px;align-items:center;border-top:2px solid var(--line);padding:10px 0}
.item:last-child{border-bottom:2px solid var(--line)}
.item img{width:170px;height:212px;object-fit:cover}
.item .n{font-family:CG;font-weight:700;font-size:46px;line-height:1}
.item .hs{font-size:21px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:8px}
.item .m{font-size:26px;color:var(--muted);margin-top:8px;line-height:1.3}
.item .p{font-family:CG;font-weight:700;font-size:54px;text-align:right;line-height:1}
.item .u{font-size:21px;color:var(--muted);text-align:right;margin-top:6px}
.step{display:grid;grid-template-columns:200px 1fr;gap:26px;align-items:center;border-top:2px solid var(--line);padding:38px 0}
.step:last-child{border-bottom:2px solid var(--line)}
.step .n{font-family:CG;font-weight:700;font-size:64px;color:var(--accent);line-height:1}
.step .t{font-family:CG;font-weight:600;font-size:54px;line-height:1.12}
.step .t small{display:block;font-family:Inter,sans-serif;font-weight:400;font-size:29px;color:var(--muted);margin-top:8px;line-height:1.35}
.vs{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:26px}
.vs .c{text-align:center}
.vs img{width:100%;height:640px;object-fit:cover}
.vs .n{font-family:CG;font-weight:700;font-size:48px;line-height:1;margin-top:6px}
.vs .d{font-size:28px;color:var(--muted);line-height:1.35;margin-top:12px;min-height:68px}
.vs .p{display:inline-block;margin-top:16px;border:2px solid var(--ink);padding:10px 22px;font-size:26px;font-weight:600}
.or{font-family:CG;font-style:italic;font-size:46px;color:var(--accent);text-align:center;position:absolute;left:0;right:0;top:640px}
.math{display:grid;grid-template-columns:1fr 1fr;border:2px solid var(--line);background:var(--card);margin-top:20px}
.math>div{padding:30px 20px;text-align:center}
.math>div+div{border-left:2px solid var(--line)}
.math .l{font-size:23px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
.math .big{font-family:CG;font-weight:700;font-size:96px;line-height:1;margin-top:10px}
.math .pm{font-size:28px;margin-top:8px}
.tbl{margin-top:44px}
.tr{border-top:2px solid var(--line);padding:40px 0;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center}
.tr:last-child{border-bottom:2px solid var(--line)}
.tr .n{font-family:CG;font-weight:700;font-size:52px;line-height:1.05}
.tr .m{font-size:29px;color:var(--muted);margin-top:10px}
.tr .v{font-size:22px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;border:2px solid var(--ink);padding:10px 16px;white-space:nowrap}
.tr .v.soft{border-color:var(--accent);color:var(--accent)}
.fl{border:2px solid var(--line);background:var(--card);padding:36px 32px;margin-top:26px;display:grid;grid-template-columns:1fr auto;gap:20px;align-items:center}
.fl .n{font-family:CG;font-weight:700;font-size:44px;line-height:1}
.fl .f{font-family:CG;font-style:italic;font-size:30px;color:var(--muted)}
.fl .s{font-size:26px;color:var(--muted);margin-top:10px;line-height:1.35}
.fl .p{font-family:CG;font-weight:700;font-size:58px}
.bars{margin-top:30px}
.bar{display:grid;grid-template-columns:300px 1fr 100px;gap:14px;align-items:center;height:66px}
.bar .l{font-size:27px;text-align:right;line-height:1.05}
.bar .t{height:34px;background:var(--line);position:relative}
.bar .t i{position:absolute;left:0;top:0;bottom:0;background:var(--accent)}
.bar .v{font-family:CG;font-weight:700;font-size:36px}
.qf{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:70px}
.qf div{border:2px solid var(--line);background:var(--card);padding:34px 16px;text-align:center}
.qf b{display:block;font-family:CG;font-weight:700;font-size:110px;line-height:1;color:var(--accent)}
.qf span{display:block;font-size:24px;line-height:1.3;margin-top:12px}
.cta{display:block;width:max-content;margin:70px auto 0;background:var(--ink);color:var(--bg);font-size:34px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;padding:28px 60px}
`;

const foot = (asof) => `<div class="foot"><b>blindbuyguide.com</b>${esc(asof || 'Sample first. Then buy the bottle.')}</div>`;
const head = (im, cls = '') => `<div class="brand">Blind Buy Guide</div><div class="k">${esc(im.kicker)}</div>`;

const T = {
  pyramid: im => `${head(im)}
    <div class="h s">${esc(im.name)}</div><div class="house">${esc(im.house)}</div>
    <div style="display:grid;grid-template-columns:330px 1fr;gap:20px;align-items:center;margin-top:24px">
      <img class="bottle" style="width:360px;height:560px;object-fit:cover" src="${photo(im.photo)}">
      <div>${im.tiers.map(([l, v]) => `<div class="tier" style="grid-template-columns:1fr;padding:26px 0"><div class="l">${esc(l)}</div><div class="v" style="margin-top:6px;font-size:44px">${esc(v)}</div></div>`).join('')}</div>
    </div>
    ${im.gloss ? `<div class="line" style="font-size:36px;margin-top:18px">${esc(im.gloss)}</div>` : ''}
    <div class="center" style="margin-top:${im.gloss ? 22 : 34}px"><span class="stamp">${esc(im.stamp)}</span></div>
    <div class="price">${esc(im.price)}</div>${foot(im.asof)}`,

  verdict: im => `${head(im)}
    <div class="h">${esc(im.headline)}</div><div class="house">${esc(im.house)}</div>
    <img class="bottle" style="width:560px;height:500px;margin-top:14px;object-fit:cover" src="${photo(im.photo)}">
    <div class="center" style="margin-top:6px"><span class="stamp" style="font-size:40px">${esc(im.answer)}</span></div>
    <div style="margin-top:28px">${im.facts.map(([l, v]) => `<div class="row"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
    <div class="line" style="font-size:36px">${esc(im.line)}</div>${foot(im.asof)}`,

  still: im => `${head(im)}
    <div class="h s">${esc(im.headline)}</div>
    <div style="position:relative;margin-top:6px">
      <img class="bottle" style="width:600px;height:700px;object-fit:cover" src="${photo(im.photo)}">
      <span class="stamp" style="position:absolute;right:20px;top:40px;transform:rotate(-6deg);font-size:24px">${esc(im.stamp)}</span>
    </div>
    <div>${im.rows.map(([l, v]) => `<div class="row"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
    <div class="line" style="font-size:38px">${esc(im.line)}</div>${foot(im.asof)}`,

  glance: im => `${head(im)}
    <div class="h s">${esc(im.name)}</div><div class="house">${esc(im.house)}</div>
    <img class="bottle" style="width:440px;height:520px;margin-top:10px;object-fit:cover" src="${photo(im.photo)}">
    <div style="margin-top:10px">${im.rows.map(([l, v]) => `<div class="row" style="grid-template-columns:300px 1fr;padding:13px 0"><div class="l" style="font-size:24px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)">${esc(l)}</div><div class="v" style="font-size:${v.length > 30 ? 31 : 38}px;line-height:1.1">${esc(v)}</div></div>`).join('')}</div>${foot(im.asof)}`,

  math: im => `${head(im)}
    <div class="h s">${esc(im.name)}</div><div class="house">${esc(im.house)}</div>
    <img class="bottle" style="width:520px;height:600px;margin-top:10px;object-fit:cover" src="${photo(im.photo)}">
    <div class="math">${[im.left, im.right].map(([l, b, pm]) => `<div><div class="l">${esc(l)}</div><div class="big">${esc(b)}</div><div class="pm">${esc(pm)}</div></div>`).join('')}</div>
    <div class="line">${esc(im.line)}</div>${foot(im.asof)}`,

  rules: im => `${head(im)}
    <div class="h" style="margin-top:${im.steps.length > 4 ? 30 : 70}px;font-size:${im.steps.length > 4 ? 100 : 120}px">${esc(im.headline)}</div><div class="sub">${esc(im.sub)}</div>
    <div style="margin-top:${im.steps.length > 4 ? 30 : 60}px">${im.steps.map(([n, t]) => `<div class="step" style="grid-template-columns:150px 1fr${im.steps.length > 4 ? ';padding:22px 0' : ''}"><div class="n">${esc(n)}</div><div class="t">${esc(t)}</div></div>`).join('')}</div>
    <div class="line" style="margin-top:44px">${esc(im.line)}</div>${foot(im.asof)}`,

  timeline: im => `${head(im)}
    <div class="h" style="margin-top:60px;font-size:108px">${esc(im.headline)}</div>
    <div style="margin-top:60px">${im.steps.map(([n, t, s]) => `<div class="step"><div class="n" style="font-size:56px">${esc(n)}</div><div class="t">${esc(t)}<small>${esc(s)}</small></div></div>`).join('')}</div>
    <div class="line" style="margin-top:44px">${esc(im.line)}</div>${foot(im.asof)}`,

  list: im => `${head(im)}
    <div class="h s">${esc(im.headline)}</div>${im.sub ? `<div class="sub">${esc(im.sub)}</div>` : ''}
    <div style="margin-top:30px">${im.items.map(it => `<div class="item"${im.items.length > 3 ? ' style="padding:8px 0;grid-template-columns:140px 1fr auto"' : ' style="padding:18px 0"'}>
      <img src="${photo(it.photo)}"${im.items.length > 3 ? ' style="height:150px;width:140px"' : ''}>
      <div><div class="hs">${esc(it.house)}</div><div class="n">${esc(it.name)}</div><div class="m">${esc(it.meta)}</div></div>
      <div><div class="p">${esc(it.value)}</div><div class="u">${esc(it.unit || 'per ml')}</div></div></div>`).join('')}</div>
    <div class="line" style="font-size:38px">${esc(im.line)}</div>${foot(im.asof)}`,

  versus: im => `${head(im)}
    <div class="h s">${esc(im.headline)}</div>
    <div class="vs">${[im.a, im.b].map(x => `<div class="c"><img src="${photo(x.photo)}"><div class="n">${esc(x.name)}</div><div class="d">${esc(x.desc)}</div><div class="p">${esc(x.price)}</div></div>`).join('')}</div>
    <div class="line">${esc(im.line)}</div>${foot(im.asof)}`,

  table: im => `${head(im)}
    <div class="h s" style="margin-top:30px">${esc(im.headline)}</div><div class="sub">${esc(im.sub)}</div>
    <div class="tbl"${im.compact ? ' style="margin-top:26px"' : ''}>${im.table.map(r => `<div class="tr"${im.compact ? ' style="padding:20px 0"' : ''}><div><div class="n">${esc(r.name)}</div><div class="m">${esc(r.meta)}</div></div><div class="v${/buy/i.test(r.verdict) ? '' : ' soft'}">${esc(r.verdict)}</div></div>`).join('')}</div>
    <div class="line" style="font-size:38px;margin-top:40px">${esc(im.line)}</div>${foot(im.asof)}`,

  flights: im => `${head(im)}
    <div class="h s">${esc(im.headline)}</div><div class="sub">${esc(im.sub)}</div>
    <div style="margin-top:26px">${im.flights.map(f => `<div class="fl"><div><div class="n">${esc(f.name)}</div><div class="f">${esc(f.for)}</div><div class="s">${esc(f.scents)}</div></div><div class="p">${esc(f.price)}</div></div>`).join('')}</div>
    <div class="line" style="font-size:36px">${esc(im.line)}</div>${foot(im.asof)}`,

  chart: im => {
    const max = Math.max(...im.bars.map(b => b[1]));
    return `${head(im)}
    <div class="h s">${esc(im.headline)}</div><div class="sub">${esc(im.sub)}</div>
    <div class="bars">${im.bars.map(([l, v]) => `<div class="bar"><div class="l">${esc(l)}</div><div class="t"><i style="width:${(v / max * 100).toFixed(1)}%"></i></div><div class="v">$${v.toFixed(2)}</div></div>`).join('')}</div>
    <div class="line" style="font-size:38px">${esc(im.line)}</div>${foot(im.asof)}`;
  },

  quiz: im => `${head(im)}
    <div class="h" style="margin-top:80px;font-size:112px">${esc(im.headline)}</div><div class="sub" style="font-size:46px">${esc(im.sub)}</div>
    <div class="qf">${im.facts.map(([b, s]) => `<div><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('')}</div>
    <span class="cta">${esc(im.cta)}</span>
    <div class="line" style="margin-top:56px">${esc(im.line)}</div>${foot(im.asof)}`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 1500 } });
for (const p of batch.pins) {
  if (only && p.id !== only) continue;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="pin">${T[p.template](p.image)}</div></body></html>`;
  const tmp = path.join(outDir, `.tmp-${p.id}.html`);
  fs.writeFileSync(tmp, html);
  await page.goto('file://' + tmp);
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.evaluate(() => {
    const pin = document.querySelector('.pin'); const foot = document.querySelector('.foot');
    const last = [...pin.children].filter(e => !e.classList.contains('foot')).pop();
    return Math.round(last.getBoundingClientRect().bottom - foot.getBoundingClientRect().top);
  });
  const file = path.join(outDir, `${p.id}-${p.slug}.png`);
  await page.screenshot({ path: file });
  fs.unlinkSync(tmp);
  console.log(file, overflow > -10 ? `WARN content reaches footer (${overflow}px)` : 'ok');
}
await browser.close();
