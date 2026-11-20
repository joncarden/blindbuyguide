// Render layer: one semantic slide plan -> HTML in 4 looks (+ a reference-matched look) -> PNG via Playwright.
import fs from 'fs';
import path from 'path';

export const FORMATS = {
  tiktok: { w: 1080, h: 1920, fs: 1, pad: '230px 130px 400px 90px', top: '120px' }, // keeps clear of TikTok's caption + side rail
  instagram: { w: 1080, h: 1350, fs: 0.84, pad: '150px 90px 120px 90px', top: '64px' },
};
export const LOOKS = {
  editorial: 'Cream and serif, the site look: centered Cormorant headlines, studio bottle, thin rules',
  cover: 'Magazine cover: bottle full-bleed, oversized italic serif headline top-left',
  ledger: 'Price receipt: paper card, monospace, dotted leaders; the data look',
  native: 'TikTok-native: bottle full-bleed, bold sans text in solid label boxes',
};

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const uri = f => 'file://' + f;

// ---------- photo inspection: name cards out, backdrop colours in ----------
export async function inspectPhotos(page, root, slugs) {
  const out = {};
  for (const slug of slugs) {
    const f = path.join(root, 'images/studio', slug + '.webp');
    if (!fs.existsSync(f)) { out[slug] = { ok: false, why: 'no studio photo' }; continue; }
    const data = 'data:image/webp;base64,' + fs.readFileSync(f).toString('base64');
    const r = await page.evaluate(async src => {
      const im = new Image(); im.src = src; await im.decode();
      const c = document.createElement('canvas'); c.width = 120; c.height = 150;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0, 120, 150);
      const d = x.getImageData(0, 0, 120, 150).data;
      const px = (i, j) => { const k = (j * 120 + i) * 4; return [d[k], d[k + 1], d[k + 2]]; };
      let lower = 0; // name cards (typographic placeholders) have nothing in the lower third; bottles stand there
      for (let j = 93; j < 138; j++) { const bg = px(2, j); for (let i = 10; i < 110; i++) { const p = px(i, j); if (Math.abs(p[0] - bg[0]) + Math.abs(p[1] - bg[1]) + Math.abs(p[2] - bg[2]) > 45) lower++; } }
      const avg = rows => { const s = [0, 0, 0]; let n = 0; for (const j of rows) for (let i = 0; i < 120; i += 4) { const p = px(i, j); s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; n++; } return `rgb(${s.map(v => Math.round(v / n)).join(',')})`; };
      return { lower, topColor: avg([1, 2, 3]), bottomColor: avg([146, 147, 148]) };
    }, data);
    out[slug] = { ok: r.lower > 0, why: r.lower > 0 ? '' : 'studio image is a name card, not a bottle photo', file: f, ...r };
  }
  return out;
}

// ---------- reference style: palette from the image, layout from hints ----------
export async function referenceStyle(page, ref) {
  const f = path.resolve(ref.image);
  const ext = path.extname(f).slice(1).replace('jpg', 'jpeg');
  const data = `data:image/${ext};base64,` + fs.readFileSync(f).toString('base64');
  const pal = await page.evaluate(async src => {
    const im = new Image(); im.src = src; await im.decode();
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0, 64, 64);
    const d = x.getImageData(0, 0, 64, 64).data; const bins = {};
    for (let k = 0; k < d.length; k += 4) {
      const key = [d[k], d[k + 1], d[k + 2]].map(v => Math.round(v / 20)).join(',');
      const b = bins[key] || (bins[key] = { n: 0, s: [0, 0, 0] }); b.n++; b.s[0] += d[k]; b.s[1] += d[k + 1]; b.s[2] += d[k + 2];
    }
    const cols = Object.values(bins).sort((a, b) => b.n - a.n).map(b => ({ c: b.s.map(v => Math.round(v / b.n)), n: b.n }));
    const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    const sat = c => Math.max(...c) - Math.min(...c);
    const bg = cols[0].c; const major = cols.filter(x => x.n >= 8);
    let ink = major.slice().sort((a, b) => Math.abs(lum(b.c) - lum(bg)) - Math.abs(lum(a.c) - lum(bg)))[0].c;
    if (Math.abs(lum(ink) - lum(bg)) < 110) ink = lum(bg) > 128 ? [23, 20, 15] : [250, 247, 240];
    const acc = major.filter(x => sat(x.c) > 40 && Math.abs(lum(x.c) - lum(bg)) > 50).sort((a, b) => b.n - a.n)[0]?.c || ink;
    const hex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    return { bg: hex(bg), ink: hex(ink), accent: hex(acc), dark: lum(bg) < 110 };
  }, data);
  return { font: 'serif', align: 'center', textPos: 'center', label: false, case: 'none', photo: 'framed', ...pal, ...Object.fromEntries(Object.entries(ref).filter(([k, v]) => v != null && k !== 'image')) };
}

// ---------- CSS ----------
function css(look, fmt, studio, ref, fontsDir) {
  const F = n => `calc(${n}px * var(--fs))`;
  const base = `
@font-face{font-family:CG;src:url(${uri(path.join(fontsDir, 'cormorant-garamond.woff2'))}) format('woff2');font-weight:300 700}
@font-face{font-family:CG;src:url(${uri(path.join(fontsDir, 'cormorant-garamond-italic.woff2'))}) format('woff2');font-weight:300 700;font-style:italic}
:root{--fs:${fmt.fs};--bg:#f6f2ea;--ink:#17140f;--accent:#7a5b2e;--muted:#6b6259;--line:#ddd4c4;--paper:#fffdf8;--imgTop:${studio.topColor};--imgBot:${studio.bottomColor};
--serif:CG,'Cormorant Garamond',Georgia,serif;--sans:Inter,'DejaVu Sans',sans-serif;--mono:'JetBrains Mono','DejaVu Sans Mono',monospace}
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:${fmt.w}px;height:${fmt.h}px;overflow:hidden}
body{background:linear-gradient(var(--imgTop),var(--imgBot));color:var(--ink);font-family:var(--sans);position:relative}
.s{position:absolute;inset:0;padding:${fmt.pad};display:flex;flex-direction:column;justify-content:center}
.top{position:absolute;top:${fmt.top};left:90px;right:130px;display:flex;justify-content:space-between;font:600 ${F(24)} var(--sans);letter-spacing:.22em;text-transform:uppercase;color:var(--accent);z-index:3}
.card{display:flex;flex-direction:column;align-items:center;text-align:center;gap:${F(22)};position:relative;z-index:2}
.kick{font:600 ${F(28)} var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--accent)}
.t{font-family:var(--serif);font-weight:700;font-size:${F(112)};line-height:1;letter-spacing:-.01em}
.k-hook .t{font-size:${F(132)}}
.k-rows .t,.k-notes .t,.k-cta .t{font-size:${F(84)}}
.sub{font-family:var(--serif);font-style:italic;font-size:${F(48)};color:var(--muted)}
.note{font-size:${F(32)};color:var(--muted);margin-top:${F(20)}}
.ph img{display:block;object-fit:contain;mix-blend-mode:multiply;-webkit-mask-image:radial-gradient(ellipse 72% 72% at 50% 52%,#000 62%,transparent 100%)}
.k-hook .ph img{height:${fmt.h > 1500 ? '46vh' : '40vh'}}.k-bottle .ph img,.k-verdict .ph img{height:${fmt.h > 1500 ? '40vh' : '33vh'}}.k-notes .ph img,.k-statement .ph img{height:${fmt.h > 1500 ? '24vh' : '18vh'}}
.price{font:700 ${F(64)} var(--serif)}
.meta{font-size:${F(30)};color:var(--muted)}
.line{font:italic 600 ${F(40)} var(--serif);line-height:1.2;max-width:880px}
.q,.stamp{display:inline-block;border:3px solid var(--ink);padding:${F(20)} ${F(44)};font:700 ${F(40)} var(--sans);letter-spacing:.1em;text-transform:uppercase}
.stamp{font-size:${F(60)};border-width:5px}
.tiers{width:100%}
.tier{display:grid;grid-template-columns:${F(170)} 1fr;align-items:center;text-align:left;border-top:2px solid var(--line);padding:${F(28)} 0}
.tier:last-child{border-bottom:2px solid var(--line)}
.tier .l{font:700 ${F(24)} var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}
.tier .v{font:600 ${F(48)} var(--serif);line-height:1.12}
.rows{width:100%}
.row{display:grid;grid-template-columns:${F(150)} 1fr auto;gap:${F(24)};align-items:center;text-align:left;border-top:2px solid var(--line);padding:${F(14)} ${F(10)}}
.row:last-child{border-bottom:2px solid var(--line)}
.row.hl{background:rgba(122,91,46,.12)}.row.gap{margin-top:${F(22)}}
.row .im{height:${F(170)};display:flex;align-items:center;justify-content:center}
.row .im img{height:100%;mix-blend-mode:multiply;-webkit-mask-image:radial-gradient(ellipse 70% 70% at 50% 50%,#000 60%,transparent 100%)}
.compact .row .im{height:${F(118)}}
.row .n{font:700 ${F(46)} var(--serif);line-height:1.05}.row .n small{display:block;font:400 ${F(26)} var(--sans);color:var(--muted);margin-top:6px}
.row .p{text-align:right;font:700 ${F(56)} var(--serif)}.row .p small{display:block;font:500 ${F(28)} var(--sans);color:var(--accent)}
.big{font:700 ${F(260)} var(--serif);line-height:.9;color:var(--accent)}
.body{font:500 ${F(44)} var(--serif);line-height:1.28;max-width:880px}
.k-statement .body,.k-verdict .body{font-size:${F(50)}}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:${F(30)};width:100%}
.pair .c{display:flex;flex-direction:column;align-items:center;gap:${F(10)}}
.pair img{height:${fmt.h > 1500 ? '36vh' : '30vh'};mix-blend-mode:multiply;-webkit-mask-image:radial-gradient(ellipse 72% 72% at 50% 52%,#000 60%,transparent 100%)}
.pair b{font:700 ${F(48)} var(--serif);line-height:1.05}.pair .h{font-size:${F(24)};letter-spacing:.14em;text-transform:uppercase;color:var(--accent)}
.pair span{font:700 ${F(54)} var(--sans)}.pair i{font-size:${F(30)};color:var(--muted)}
.url{font:700 ${F(72)} var(--serif);border-bottom:4px solid var(--accent);padding-bottom:6px}
.disc{font-size:${F(26)};color:var(--muted);line-height:1.4;max-width:820px}
.k-cta .t{margin-top:${F(10)}}
`;
  const looks = {
    editorial: '',
    cover: `
.ph{position:fixed;left:0;right:0;bottom:0;height:70%;z-index:1}
.card{z-index:auto}.card>*:not(.ph){position:relative;z-index:2}
.ph img{width:100%;height:100%!important;object-fit:cover;object-position:50% 40%;mix-blend-mode:normal;-webkit-mask-image:linear-gradient(transparent,#000 14%)}
.has-ph .s{justify-content:flex-start}
.has-ph .card{align-items:flex-start;text-align:left;gap:${F(14)}}
.card{align-items:flex-start;text-align:left}
.t{font-style:italic;font-weight:600;font-size:${F(128)};line-height:.92}
.k-hook .t{font-size:${F(150)}}
.k-hook .card:before{content:'Blind Buy Guide';font:700 ${F(40)} var(--serif);letter-spacing:.32em;text-transform:uppercase;color:var(--ink);border-bottom:2px solid var(--ink);padding-bottom:${F(14)};margin-bottom:${F(24)};width:100%}
.k-hook .top span:first-child{visibility:hidden}
.has-ph .price,.has-ph .meta,.has-ph .q,.has-ph .stamp,.has-ph .line,.has-ph .body{position:relative}
.has-ph.k-bottle .q,.has-ph.k-verdict .stamp{position:fixed;right:130px;bottom:430px;background:var(--bg);z-index:3}
.k-verdict.has-ph .body{font-size:${F(42)};max-width:820px}
.kick{border-left:6px solid var(--accent);padding-left:16px}
.tier,.row{text-align:left}
.url{align-self:flex-start}`,
    ledger: `
body{background:#ece3d3}
.card{background:var(--paper);padding:${F(60)} ${F(56)};font-family:var(--mono);box-shadow:0 18px 50px rgba(60,40,10,.18);width:100%;
-webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/28px 100%}
.card:before{content:'BLIND BUY GUIDE · PRICE CHECK';font:700 ${F(24)} var(--mono);letter-spacing:.14em;color:var(--muted);border-bottom:2px dashed var(--line);padding-bottom:${F(18)};width:100%}
.t{font:800 ${F(78)} var(--mono);text-transform:uppercase;letter-spacing:-.02em;line-height:1.02}
.k-hook .t{font-size:${F(92)}}.k-rows .t,.k-notes .t,.k-cta .t{font-size:${F(56)}}
.sub,.line,.body,.tier .v,.row .n,.price,.url,.big,.pair b{font-family:var(--mono)!important;font-style:normal}
.sub{font-size:${F(34)}}.body{font-size:${F(36)}!important;line-height:1.4;font-weight:500}.line{font-size:${F(32)}}
.price{font-size:${F(60)};font-weight:800}
.tier .v{font-size:${F(34)}}.tier{border-top:2px dashed var(--line)}.tier:last-child{border-bottom:2px dashed var(--line)}
.row{grid-template-columns:1fr auto;border-top:2px dashed var(--line)}.row:last-child{border-bottom:2px dashed var(--line)}.row .im{display:none}
.row .n{font-size:${F(34)};font-weight:700}.row .p{font:800 ${F(48)} var(--mono)}
.big{font-size:${F(200)};font-weight:800}
.stamp{font-family:var(--mono);color:#8a3b2a;border:6px double #8a3b2a;transform:rotate(-4deg)}
.q{font-family:var(--mono);border-style:dashed}
.ph img{mix-blend-mode:multiply}
.k-hook .ph img{height:${fmt.h > 1500 ? '34vh' : '27vh'}}.k-bottle .ph img{height:${fmt.h > 1500 ? '32vh' : '24vh'}}.k-verdict .ph img{height:${fmt.h > 1500 ? '22vh' : '16vh'}}
.pair img{height:${fmt.h > 1500 ? '28vh' : '21vh'}}.pair b{font-size:${F(34)}}.pair span{font-family:var(--mono)}
.url{font-size:${F(54)};border-bottom:4px dashed var(--accent)}
.top{color:var(--muted)}`,
    native: `
.ph{position:fixed;left:0;right:0;bottom:0;height:72%;z-index:1}
.card{z-index:auto}.card>*:not(.ph){position:relative;z-index:2}
.ph img{width:100%;height:100%!important;object-fit:cover;object-position:50% 45%;mix-blend-mode:normal;-webkit-mask-image:linear-gradient(transparent,#000 10%)}
.has-ph .s{justify-content:flex-start}
.t,.sub,.kick,.line,.body,.meta,.price,.note{font-family:var(--sans)!important;font-style:normal!important}
.t{font-weight:800;font-size:${F(84)};line-height:1.42;letter-spacing:-.01em}
.k-hook .t{font-size:${F(96)}}.k-rows .t,.k-notes .t,.k-cta .t{font-size:${F(64)}}
.t span,.sub span,.body span,.line span,.price span{background:var(--ink);color:#fff;padding:.06em .3em;border-radius:14px;-webkit-box-decoration-break:clone;box-decoration-break:clone}
.sub span,.line span,.body span,.price span{background:#fff;color:var(--ink)}
.sub{font-size:${F(40)};font-weight:700;line-height:1.5}.line,.body{font-size:${F(40)}!important;font-weight:600;line-height:1.55}
.price{font-size:${F(52)};font-weight:800;line-height:1.5}
.meta{font-weight:600;color:var(--ink)}
.kick{color:var(--ink);letter-spacing:.12em}
.big{font-family:var(--sans);font-weight:900;color:var(--ink)}
.has-ph.k-bottle .q,.has-ph.k-verdict .stamp{position:fixed;left:50%;transform:translateX(-50%);bottom:440px;z-index:3;background:var(--ink);color:#fff;border-color:var(--ink);border-radius:14px}
.stamp,.q{border-radius:14px;font-family:var(--sans)}
.tier,.row{background:rgba(255,255,255,.72);border:0!important;border-radius:18px;margin-bottom:${F(12)}}
.tier{padding:${F(22)} ${F(26)}}.tier .v,.row .n,.row .p,.pair b,.url{font-family:var(--sans)!important;font-weight:800}
.tier .v{font-size:${F(38)}}.row .n{font-size:${F(36)}}.row .p{font-size:${F(46)}}.row.hl{background:#fff;outline:4px solid var(--ink)}
.pair b{font-size:${F(38)}}.url{font-size:${F(60)};border-bottom-color:var(--ink)}
.top{color:var(--ink)}`,
  };
  let lookCss = looks[look] ?? '';
  if (look === 'ref' && ref) {
    const fam = { serif: 'var(--serif)', sans: 'var(--sans)', mono: 'var(--mono)' }[ref.font] || 'var(--serif)';
    lookCss = (ref.photo === 'full' ? looks.cover.split('\n').filter(l => /^\.ph|^\.card\{z|^\.has-ph \.s/.test(l)).join('\n') : '') + (ref.label ? looks.native : '') + `
:root{--bg:${ref.bg};--ink:${ref.ink};--accent:${ref.accent};--muted:${ref.ink}cc;--line:${ref.ink}33}
body{background:var(--bg)}
.ph img{mix-blend-mode:${ref.dark ? 'normal' : 'multiply'}}
.t,.sub,.line,.body,.price,.url,.big,.tier .v,.row .n,.row .p,.pair b{font-family:${fam}!important}
.t{text-transform:${ref.case === 'upper' ? 'uppercase' : 'none'}}
.s{justify-content:${{ top: 'flex-start', center: 'center', bottom: 'flex-end' }[ref.textPos] || 'center'}}
.card{align-items:${ref.align === 'left' ? 'flex-start' : 'center'};text-align:${ref.align === 'left' ? 'left' : 'center'}}`;
  }
  return base + lookCss;
}

// ---------- markup ----------
function slideHtml(sl, i, n, look, photos) {
  const img = slug => (slug && photos[slug]?.ok ? `<img src="${uri(photos[slug].file)}">` : '');
  const box = s => (look === 'native' || look === 'ref') ? `<span>${esc(s)}</span>` : esc(s);
  const ph = sl.slug && photos[sl.slug]?.ok ? `<div class="ph">${img(sl.slug)}</div>` : '';
  const parts = [];
  const kick = sl.kicker ? `<div class="kick">${esc(sl.kicker)}</div>` : '';
  switch (sl.kind) {
    case 'hook': parts.push(`<div class="t">${box(sl.title)}</div>`, sl.sub && `<div class="sub">${box(sl.sub)}</div>`, sl.note && `<div class="note">${esc(sl.note)}</div>`, ph); break;
    case 'bottle': parts.push(kick, `<div class="t">${box(sl.title)}</div>`, sl.sub && `<div class="sub">${box(sl.sub)}</div>`, ph, sl.price && `<div class="price">${box(sl.price)}</div>`, sl.line && `<div class="line">${box(sl.line)}</div>`, sl.meta && `<div class="meta">${esc(sl.meta)}</div>`, sl.q && `<div class="q">${esc(sl.q)}</div>`); break;
    case 'notes': parts.push(kick, `<div class="t">${box(sl.title)}</div>`, `<div class="tiers">${sl.tiers.map(t => `<div class="tier"><div class="l">${esc(t.label)}</div><div class="v">${esc(t.items)}</div></div>`).join('')}</div>`, ph); break;
    case 'rows': parts.push(kick, sl.title && `<div class="t">${box(sl.title)}</div>`, `<div class="rows ${sl.compact ? 'compact' : ''}">${sl.rows.map(r => `<div class="row ${r.hl ? 'hl' : ''} ${r.gapBefore ? 'gap' : ''}"><div class="im">${img(r.slug)}</div><div class="n">${esc(r.name)}<small>${esc(r.sub)}</small></div><div class="p">${esc(r.value)}<small>${esc(r.valueSub)}</small></div></div>`).join('')}</div>`, sl.foot && `<div class="meta">${esc(sl.foot)}</div>`); break;
    case 'statement': parts.push(kick, sl.big && `<div class="big">${esc(sl.big)}</div>`, sl.title && `<div class="t">${box(sl.title)}</div>`, sl.body && `<div class="body">${box(sl.body)}</div>`); break;
    case 'verdict': parts.push(kick, sl.stamp && `<div class="stamp">${esc(sl.stamp)}</div>`, sl.body && `<div class="body">${box(sl.body)}</div>`, ph); break;
    case 'pair': parts.push(kick, `<div class="pair">${sl.items.map(x => `<div class="c">${img(x.slug)}<div class="h">${esc(x.house)}</div><b>${esc(x.name)}</b><span>${esc(x.value)}</span><i>${esc(x.meta)}</i></div>`).join('')}</div>`, `<div class="q">${esc(sl.q)}</div>`); break;
    case 'cta': parts.push(kick, `<div class="t">${box(sl.title)}</div>`, `<div class="url">${esc(sl.url)}</div>`, `<div class="note">${esc(sl.body)}</div>`, `<div class="disc">${esc(sl.disc)}</div>`); break;
  }
  const hasPh = ph && ['cover', 'native'].includes(look) || (look === 'ref' && ph);
  return `<body class="k-${sl.kind} ${hasPh ? 'has-ph' : ''}"><div class="s"><div class="top"><span>@blindbuyguide</span><span>${i + 1}/${n}</span></div><div class="card">${parts.filter(Boolean).join('')}</div></div></body>`;
}

export async function renderDeck(page, { slides, look, format, photos, studio, ref, outDir, fontsDir }) {
  const fmt = FORMATS[format];
  await page.setViewportSize({ width: fmt.w, height: fmt.h });
  fs.mkdirSync(outDir, { recursive: true });
  const style = css(look, fmt, studio, ref, fontsDir);
  const files = [];
  for (let i = 0; i < slides.length; i++) {
    const hf = path.join(outDir, `_slide.html`);
    fs.writeFileSync(hf, `<!doctype html><html><head><meta charset="utf-8"><style>${style}</style></head>${slideHtml(slides[i], i, slides.length, look, photos)}</html>`);
    await page.goto(uri(hf));
    await page.evaluate(() => document.fonts.ready);
    await page.evaluate(() => Promise.all([...document.images].map(im => im.decode().catch(() => {}))));
    // shrink-to-fit: never let copy run into the platform's UI zones
    await page.evaluate(() => {
      const s = document.querySelector('.s'), c = document.querySelector('.card');
      const room = s.clientHeight - parseFloat(getComputedStyle(s).paddingTop) - parseFloat(getComputedStyle(s).paddingBottom);
      const base = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--fs'));
      let k = 1; while (c.scrollHeight > room && k > 0.6) { k -= 0.05; document.documentElement.style.setProperty('--fs', String(base * k)); }
    });
    const out = path.join(outDir, `slide-${String(i + 1).padStart(2, '0')}.png`);
    await page.screenshot({ path: out });
    files.push(out);
  }
  fs.rmSync(path.join(outDir, '_slide.html'), { force: true });
  return files;
}

export async function contactSheet(page, rows, out, title) {
  // rows: [{label, files}] -> one review image
  const W = 1500;
  const cols = Math.max(...rows.map(r => r.files.length));
  const tw = Math.floor((W - 200 - cols * 10) / cols);
  const html = `<!doctype html><html><body style="margin:0;background:#e9e3d8;font:600 20px Inter,sans-serif;color:#17140f;width:${W}px;padding:20px">
<div style="font-size:26px;margin-bottom:14px">${esc(title)}</div>
${rows.map(r => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px"><div style="width:170px">${esc(r.label)}</div>${r.files.map(f => `<img src="${uri(f)}" style="width:${tw}px;box-shadow:0 2px 6px rgba(0,0,0,.15)">`).join('')}</div>`).join('')}</body></html>`;
  const hf = out + '.html';
  fs.writeFileSync(hf, html);
  await page.setViewportSize({ width: W + 40, height: 800 });
  await page.goto(uri(hf));
  await page.evaluate(() => Promise.all([...document.images].map(im => im.decode().catch(() => {}))));
  await page.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 82 });
  fs.rmSync(hf);
}
