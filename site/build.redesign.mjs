// Zero-dependency static site generator. Usage: node build.mjs [--base /prefix]
import fs from 'fs'; import path from 'path';
import {loadWearers,wearersSection,wearersCss} from './src/wearers.mjs';
import {giftGuide,giftPromo} from './src/gift-guide.mjs';
const root = path.dirname(new URL(import.meta.url).pathname);
const cfg = JSON.parse(fs.readFileSync(path.join(root,'config.json'),'utf8'));
const out = process.env.OUT||'/tmp/site-dist';
const baseArg = process.argv.indexOf('--base'); const BASE = baseArg>0 ? process.argv[baseArg+1].replace(/\/$/,'') : '';
const libDir = process.env.LIB||'/mnt/project-files/library/scents';
const esc = s => String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const arr = x => Array.isArray(x)?x:[];
const affBase = url => { try{ const u=new URL(url); const r=(cfg.affiliate.rules||[]).find(r=>r.value&&u.hostname.includes(r.match)); if(r) u.searchParams.set(r.param,r.value); return u.toString(); }catch{ return url; } };
// CJ deep links: wrap links to enabled CJ advertisers as <linkHost>/links/<PID>/type/dlg/<url> (tested 2026-11-16: lands on the product with AID/PID).
const CJ = cfg.cj||{}; const CJ_ON = (CJ.advertisers||[]).filter(a=>a.enabled&&a.domain&&CJ.pid);
const cjAdv = url => { try{ const h=new URL(url).hostname; return CJ_ON.find(a=>h===a.domain||h.endsWith('.'+a.domain)); }catch{ return null; } };
// Rakuten deep links: wrap links to enabled Rakuten advertisers as click.linksynergy.com/link?id=<publisher id>&offerid=<offer id>&type=2&murl=<url>
// (tested 2026-11-18: lands on the MicroPerfumes product with nb_platform=rakuten), or /deeplink?id=&mid=&murl= when only a mid is known.
const RK = cfg.rakuten||{}; const RK_ON = (RK.advertisers||[]).filter(a=>a.enabled&&a.domain&&(a.offerid||a.mid)&&RK.id);
const rkAdv = url => { try{ const h=new URL(url).hostname; return RK_ON.find(a=>h===a.domain||h.endsWith('.'+a.domain)); }catch{ return null; } };
const aff = url => { const r=rkAdv(url); if(r) return r.offerid ? `${RK.linkHost||'https://click.linksynergy.com'}/link?id=${encodeURIComponent(RK.id)}&offerid=${encodeURIComponent(r.offerid)}&type=2&murl=${encodeURIComponent(url)}` : `${RK.linkHost||'https://click.linksynergy.com'}/deeplink?id=${encodeURIComponent(RK.id)}&mid=${encodeURIComponent(r.mid)}&murl=${encodeURIComponent(url)}`;
  return cjAdv(url) ? `${CJ.linkHost||'https://www.anrdoezrs.net'}/links/${CJ.pid}/type/dlg/${url}` : affBase(url); };
const cjOffers = (()=>{ try{ return JSON.parse(fs.readFileSync(path.join(root,CJ.offersFile||'partners/cj-offers.json'),'utf8')); }catch{ return {}; } })();
const fmtDay = d => { const x=new Date(d+'T12:00:00Z'); return isNaN(x)?d:x.toLocaleDateString('en-US',{month:'short',day:'numeric',timeZone:'UTC'}); };
const AMZ = cfg.amazon||{}; const amzAsins = (()=>{ try{ return JSON.parse(fs.readFileSync(path.join(root,AMZ.asinFile||'partners/amazon-asins.json'),'utf8')); }catch{ return {}; } })();
const amazonUrl = s => { const a=amzAsins[s.slug]; return a&&/^[A-Z0-9]{10}$/.test(a) ? `https://www.amazon.com/dp/${a}` : `https://www.amazon.com/s?k=${encodeURIComponent(((s.house||'').replace(/\s*\(.*?\)/g,'')+' '+s.name).trim())}&i=beauty`; };
const amazonLine = s => !AMZ.enabled ? '' : `<p class="muted alsoat">Also on Amazon: <a rel="sponsored nofollow noopener" href="${esc(aff(amazonUrl(s)))}">${amzAsins[s.slug]?esc(s.name):'see current listings'}</a>.</p>`;
const alsoAt = s => CJ_ON.map(a=>{ const o=(cjOffers[a.name]||{}), it=(o.items||{})[s.slug]; if(!it||!it.sizes||!it.sizes.length) return ''; return `<p class="muted alsoat">Also in stock at <a rel="sponsored nofollow noopener" href="${esc(aff(it.url))}">${esc(a.name)}</a>: ${it.sizes.map(z=>`${z.ml} ml, ${money(z.price)}`).join(' &middot; ')}.${o.checked?` Checked ${esc(fmtDay(o.checked))}.`:''}</p>`; }).join('');
const LABEL={buy:'Buy it.',sample_first:'Sample it first.',skip:'Skip it.'};
// Answer-first test: one plain sentence with the prices, for AI answers and snippets.
const AF = new Set(arr((cfg.answerFirst||{}).slugs));
const answerLine = (s,best) => { const c=s.cheapestSample; if(!c&&!best) return '';
  const parts=[]; if(c) parts.push(`A ${c.size_ml} ml sample of ${s.name} costs ${money(c.price)} at ${c.retailer} (${money(c.ppm)}/ml)`);
  if(best) parts.push(`${c?'a':'A'} full ${best.size_ml} ml bottle${c?'':' of '+s.name} is ${money(best.price)} at ${best.retailer} (${money(best.ppm)}/ml)`);
  const when=(c&&c.checked)||(best&&best.checked); return parts.join('; ')+(when?`, checked ${fmtDay(when)}`:'')+'.'; };
const urls=[];
const money = n => '$'+Number(n).toFixed(n%1?2:0);
// ---- bottle imagery: generic illustrated flacon (no real brand bottle is reproduced) + slots for real photos
const SHAPES=[[40,70,80,110,6,68,58,24,12,62,26,36,32,3],[30,80,100,100,38,70,64,20,16,64,34,32,30,15],[52,56,56,128,4,72,46,16,10,66,18,28,28,2],[34,90,92,90,14,66,72,28,18,58,40,44,32,6]];
function bottleSvg(shape,color){ const [bx,by,bw,bh,br,nx,ny,nw,nh,cx,cy,cw,ch,cr]=SHAPES[shape%4];
  const ly=by+Math.round(bh*0.34);
  return '<svg viewBox="0 0 160 200" role="img" aria-label="Illustrative perfume bottle" xmlns="http://www.w3.org/2000/svg">'
   +'<ellipse cx="80" cy="186" rx="'+(bw/2+6)+'" ry="5" fill="#000" opacity=".12"/>'
   +'<rect x="'+nx+'" y="'+ny+'" width="'+nw+'" height="'+(nh+4)+'" fill="#b9a98a" opacity=".55"/>'
   +'<rect x="'+bx+'" y="'+by+'" width="'+bw+'" height="'+bh+'" rx="'+br+'" fill="#fff" opacity=".45" stroke="#8d7a58" stroke-width="1.5"/>'
   +'<rect x="'+(bx+5)+'" y="'+ly+'" width="'+(bw-10)+'" height="'+(by+bh-5-ly)+'" rx="'+Math.max(2,br-4)+'" fill="'+color+'"/>'
   +'<rect x="'+(bx+10)+'" y="'+(by+8)+'" width="5" height="'+(bh-22)+'" rx="2.5" fill="#fff" opacity=".55"/>'
   +'<rect x="'+cx+'" y="'+cy+'" width="'+cw+'" height="'+ch+'" rx="'+cr+'" fill="#3a2f20"/>'
   +'<rect x="'+(cx+4)+'" y="'+(cy+4)+'" width="3" height="'+(ch-8)+'" rx="1.5" fill="#fff" opacity=".25"/></svg>'; }
const hash=str=>{let h=0;for(const c of String(str))h=(h*31+c.charCodeAt(0))>>>0;return h};
const MOODS=[['smoke',['oud','incense','leather','birch','smoke','tobacco'],'#5b3a24','Smoke, oud and leather'],['woods',['cedar','vetiver','sandalwood','oakmoss','woods','patchouli'],'#9a6b3a','Woods and vetiver'],['sweet',['vanilla','tonka','praline','cacao','honey','cognac','amber','caramel','saffron','sugar'],'#b8772f','Sweet and cozy'],['florals',['rose','jasmine','tuberose','iris','magnolia','orange blossom','floral','peony'],'#c4818a','Florals'],['fresh',['bergamot','lemon','grapefruit','mint','neroli','sea','citrus','marine','aquatic'],'#b9bf6e','Fresh and citrus']];
const mood = s => { const t=[...s.allNotes,...s.accords].join(' ').toLowerCase(); let best=null,bn=0; for(const m of MOODS){ const n=m[1].filter(k=>t.includes(k)).length; if(n>bn){bn=n;best=m} } return best?best[2]:'#b39a6a'; };
let IMGS={}; try{ IMGS=JSON.parse(fs.readFileSync(path.join(root,'images','images.json'),'utf8')); }catch{}
// download source photos once into images/cache (keeps the site self-hosted; delete a slug from images.json to drop its photo)
import {execFileSync} from 'child_process';
const cacheDir=path.join(root,'images','cache'); fs.mkdirSync(cacheDir,{recursive:true});
for(const [slug,im] of Object.entries(IMGS)){ if(!im.url||!process.env.DOWNLOAD) continue; const f=slug+'.jpg', fp=path.join(cacheDir,f);
  if(!fs.existsSync(fp)){ try{ execFileSync('curl',['-sSL','--max-time','20','-A','Mozilla/5.0','-o',fp,'-w','%{http_code}',im.url]); const b=fs.readFileSync(fp); const ok=b.length>3000&&(b[0]===0xff||b[0]===0x89||b.slice(0,4).toString()==='RIFF'); if(!ok) fs.rmSync(fp); }catch{ fs.rmSync(fp,{force:true}); } }
  if(fs.existsSync(fp)) im.file='cache/'+f; }
let STUDIO_SRC={}; try{ for(const [k,v] of Object.entries(JSON.parse(fs.readFileSync(path.join(root,'images','studio','cutouts.json'),'utf8')))) if(v.cutout) STUDIO_SRC[k]=v; }catch{}
const STUDIO=new Set(fs.existsSync(path.join(root,'images','studio'))?fs.readdirSync(path.join(root,'images','studio')).filter(f=>f.endsWith('-sm.webp')).map(f=>f.replace('-sm.webp','')):[]);
const bottle = (s,cls='') => { const col=mood(s);
  if(STUDIO.has(s.slug)) return `<div class="bottle studio ${cls}"><img src="${BASE}/images/studio/${s.slug}${cls==='lg'?'':'-sm'}.webp" alt="${esc(s.name)}" loading="lazy"></div>`;
  const im=IMGS[s.slug]; const src=im&&(im.file?`${BASE}/images/${esc(im.file)}`:im.url);
  return `<div class="bottle ${cls}" style="--c:${col}">${bottleSvg(hash(s.slug)%4,col)}${src?`<img src="${esc(src)}" alt="${esc(s.name)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`:''}</div>`; };

// ---- load data (library first, sample fallback), tolerate bad/missing fields
function load(dir){ if(!fs.existsSync(dir)) return []; return fs.readdirSync(dir).filter(f=>f.endsWith('.json')).flatMap(f=>{
  try{ const d=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')); d.slug ||= f.replace(/\.json$/,''); return [d]; }catch(e){ console.warn('skip',f,e.message); return []; } }); }
let scents = load(libDir); let usingSample = false;
// Rakuten sample partners (MicroPerfumes): once an advertiser is enabled with its mid, its in-stock sample sizes
// (partners/microperfumes-offers.json, built by partners/build_microperfumes.py) join each scent's sample offers.
for(const a of RK_ON){ if(!a.offersFile) continue; let o={}; try{ o=JSON.parse(fs.readFileSync(path.join(root,a.offersFile),'utf8')); }catch{ continue; }
  for(const s of scents){ const it=(o.items||{})[s.slug]; if(!it||!Array.isArray(it.sizes)) continue;
    const own=arr(s.sample_offers).filter(x=>!(x&&x.retailer===a.name));
    s.sample_offers=[...own,...it.sizes.filter(z=>z.ml>0&&z.price>0).map(z=>({retailer:a.name,size_ml:z.ml,price:z.price,currency:'USD',price_per_ml:+(z.price/z.ml).toFixed(2),in_stock:true,url:z.url,date_checked:it.checked||o.checked||null,format:z.format}))]; } }
// Prices are shown in US dollars only. A listing in pounds, euros etc. (or with no currency recorded) stays in the
// library and the history but is never displayed as a dollar price. Same rule as the Price Book.
const isUSD = o => String(o&&o.currency||'').toUpperCase()==='USD';
// Price history: record every observation (append-only, library/history/prices.csv) on each build, then read it back.
import {snapshot as histSnapshot, loadHistory, priceMoves} from '/mnt/project-files/content/tools/price_history.mjs';
let HIST=[]; try{ if(scents.length&&!process.env.NOHISTORY) histSnapshot(scents); HIST=loadHistory(); }catch(e){ console.warn('price history skipped:',e.message); }
const histSince = Object.create(null); for(const r of HIST) if(!histSince[r.slug]||r.date_checked<histSince[r.slug]) histSince[r.slug]=r.date_checked;
const histMoves = Object.create(null); for(const m of priceMoves(HIST)) if(isUSD(m)) (histMoves[m.slug] ||= []).push(m);
if(!scents.length){ scents = load(path.join(root,'sample-data')); usingSample = true; }
const bySlug = Object.fromEntries(scents.map(s=>[s.slug,s]));
for(const s of scents){
  s.name ||= s.slug; s.notes ||= {};
  let v = (s.verdict && typeof s.verdict==='object') ? s.verdict : {summary:s.verdict||''};
  try{ const ed=JSON.parse(fs.readFileSync((process.env.CONTENT||'/mnt/project-files/content/')+'verdicts/'+s.slug+'.json','utf8')); const ev=ed.verdict||ed;
    v={...v,...Object.fromEntries(Object.entries(ev).filter(([,x])=>x!=null&&x!==''))}; }catch{}
  s.verdictLine = v.summary || ''; s.who = v.who_it_suits || ''; s.advice = v.buy_or_sample_first || null;
  s.similar = arr(s.similar_scents||s.similar); s.summary = s.verdictLine;
  s.prices = arr(s.full_bottle_offers||s.prices).map(p=>({...p,checked:p.date_checked||p.checked})).filter(p=>p.in_stock!==false&&isUSD(p));
  s.samples = arr(s.sample_offers||s.samples).map(p=>({...p,checked:p.date_checked||p.checked})).filter(p=>p.in_stock!==false&&isUSD(p));
  s.accords = arr(s.accords).map(a=>String(a).split(':')[0]); s.prices = s.prices.filter(p=>p&&p.price>0&&p.size_ml>0); s.samples = s.samples.filter(p=>p&&p.price>0&&p.size_ml>0);
  s.prices.forEach(p=>p.ppm=p.price/p.size_ml); s.samples.forEach(p=>p.ppm=p.price/p.size_ml);
  s.bestPpm = s.prices.length ? Math.min(...s.prices.map(p=>p.ppm)) : null;
  s.cheapestSample = s.samples.length ? s.samples.reduce((a,b)=>a.price<=b.price?a:b) : null;
  s.allNotes = ['top','heart','base'].flatMap(k=>arr(s.notes[k]));
}

// ---- dataset stats: computed from the library on every build, so every number on the site stays true
const HOUSE_NORM={'BYREDO':'Byredo','By Kilian':'Kilian','Kilian Paris':'Kilian','Tom Ford (Private Blend)':'Tom Ford','Initio Parfums':'Initio Parfums Privés','Initio Parfums Prives':'Initio Parfums Privés','Initio':'Initio Parfums Privés','Editions de Parfums Frédéric Malle':'Frederic Malle'};
const houseKey=h=>HOUSE_NORM[String(h||'').trim()]||String(h||'').trim();
const retailerName=r=>String(r||'').replace(/\(.*?\)/g,' ').replace(/\s(US|UK)\b.*$/,'').replace(/brand site/ig,'').replace(/\s+/g,' ').trim();
const retailerKey=r=>{ const k=retailerName(r).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]/g,''); return ({libertylondon:'liberty',initioparfumsprives:'initioparfums'})[k]||k; };
const fmtDate=d=>{ if(!d) return ''; const [y,m,dd]=d.split('-').map(Number); return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]+' '+dd+', '+y; };
const median=a=>{ if(!a.length) return null; const b=[...a].sort((x,y)=>x-y), m=b.length>>1; return b.length%2?b[m]:(b[m-1]+b[m])/2; };
const DATA=(()=>{ const all=[],rs=new Map(),srs=new Set(),dates=[];
  for(const s of scents) for(const [kind,list] of [['bottle',arr(s.full_bottle_offers)],['sample',arr(s.sample_offers)]]) for(const o of list){ if(!o||!(o.price>0)||!o.retailer) continue;
    all.push({kind,o}); const k=retailerKey(o.retailer); if(!rs.has(k)) rs.set(k,{name:retailerName(o.retailer),n:0}); rs.get(k).n++; if(kind==='sample') srs.add(k); if(o.date_checked) dates.push(o.date_checked); }
  dates.sort(); const usd=o=>!o.currency||o.currency==='USD';
  const samp=scents.map(s=>s.samples.filter(usd)).filter(l=>l.length).map(l=>l.reduce((a,b)=>a.price<=b.price?a:b));
  const pct=scents.map(s=>{ const c=s.samples.filter(usd).sort((a,b)=>a.price-b.price)[0], b=s.prices.filter(usd).sort((a,b)=>a.price-b.price)[0]; return c&&b&&c.price<b.price?c.price/b.price*100:null; }).filter(x=>x!=null);
  const houses=new Map(); for(const s of scents){ const h=houseKey(s.house); if(h) houses.set(h,(houses.get(h)||0)+1); }
  return { scents:scents.length, houses:houses.size, houseList:[...houses].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])),
    retailers:rs.size, sampleRetailers:srs.size, retailerList:[...rs.values()].sort((a,b)=>b.n-a.n||a.name.localeCompare(b.name)),
    pricePoints:all.length, bottlePoints:all.filter(x=>x.kind==='bottle').length, samplePoints:all.filter(x=>x.kind==='sample').length,
    withSample:scents.filter(s=>s.cheapestSample).length, withBottle:scents.filter(s=>s.prices.length).length, withNotes:scents.filter(s=>s.allNotes.length).length,
    firstChecked:dates[0]||null, lastChecked:dates[dates.length-1]||null,
    medianSample:median(samp.map(o=>o.price)), medianSampleMl:median(samp.map(o=>o.size_ml)), medianSamplePct:pct.length?Math.round(median(pct)):null, pctBase:pct.length };
})();
const checkedRange=()=>DATA.firstChecked===DATA.lastChecked?fmtDate(DATA.lastChecked):(DATA.firstChecked.slice(0,7)===DATA.lastChecked.slice(0,7)?fmtDate(DATA.firstChecked).replace(/, \d+$/,'')+'–'+fmtDate(DATA.lastChecked).replace(/^\w+ /,''):fmtDate(DATA.firstChecked)+' to '+fmtDate(DATA.lastChecked));
const n0=n=>Number(n).toLocaleString('en-US');
// price moves from the history: only shown once a listing's price has actually changed between checks
const movesBlock=s=>{ const m=(histMoves[s.slug]||[]).slice(0,6); if(!m.length) return '';
  const row=x=>{ const a=x.points[0], b=x.points[x.points.length-1], d=b.price-a.price;
    return `<tr><td>${esc(retailerName(x.retailer))}</td><td>${x.size_ml} ml${x.kind==='sample'?' sample':''}</td><td>${money(a.price)} <span class="muted">${esc(fmtDate(a.date))}</span></td><td>${money(b.price)} <span class="muted">${esc(fmtDate(b.date))}</span></td><td class="${d<0?'down':'up'}">${d<0?'&minus;':'+'}${money(Math.abs(d))}</td></tr>`; };
  return `<div class="moves"><p class="eyebrow" style="margin:1.4em 0 .4em">Price history</p><table><thead><tr><th>Retailer</th><th>Size</th><th>Was</th><th>Now</th><th>Change</th></tr></thead><tbody>${m.map(row).join('')}</tbody></table><p class="muted" style="font-size:14px">From our dated checks of the same listing. <a href="${BASE}/methodology/">How we track prices</a></p></div>`; };
// per-scent provenance line, shown where people decide
const stamp=s=>{ const l=[...s.prices,...s.samples]; if(!l.length) return ''; const r=new Set(l.map(o=>retailerKey(o.retailer))).size; const d=l.map(o=>o.checked).filter(Boolean).sort().pop();
  return `<p class="dstamp"><span>${l.length} ${l.length===1?'price':'prices'} from ${r} ${r===1?'retailer':'retailers'}</span>${d?`<span>Last checked ${esc(fmtDate(d))}</span>`:''}${histSince[s.slug]?`<span>Price history since ${esc(fmtDate(histSince[s.slug]))}</span>`:''}<a href="${BASE}/methodology/">How we track prices</a></p>`; };
// the dataset, shown as a ledger (homepage, Price Book, scents index)
const ledger=(compact=false,cap='')=>`<section class="ledger${compact?' compact':''}">${cap?`<p class="lcap">${cap}</p>`:''}${compact?'':`<div class="ledger-h"><p class="eyebrow" style="margin:0">The data</p><h2>We did the math on ${n0(DATA.scents)} bottles. Every price is dated.</h2><p class="muted">Each figure below comes from a retailer page we read and link, with the date we read it. Nothing is estimated, nothing is from memory, and no brand paid for a verdict.</p></div>`}
<dl class="lstats"><div><dt>Fragrances tracked</dt><dd>${n0(DATA.scents)}</dd></div><div><dt>Luxury houses</dt><dd>${n0(DATA.houses)}</dd></div><div><dt>Retailers and boutiques</dt><dd>${n0(DATA.retailers)}</dd></div><div><dt>Dated prices on file</dt><dd>${n0(DATA.pricePoints)}</dd></div></dl>
${compact?'':`<div class="lfind">${DATA.medianSample!=null?`<p><b>${money(Math.round(DATA.medianSample*100)/100)}</b><span>The median price of the smartest way in: a ${DATA.medianSampleMl} ml sample, across ${n0(DATA.withSample)} fragrances. Median, so no outlier does the talking.</span></p>`:''}${DATA.medianSamplePct!=null?`<p><b>${DATA.medianSamplePct}%</b><span>What that sample costs next to the bottle, at the median across ${n0(DATA.pctBase)} fragrances. A small price for a very expensive opinion.</span></p>`:''}</div>`}
<p class="lfoot">Prices checked ${esc(checkedRange())} · <a href="${BASE}/methodology/">How we track prices</a> · <a href="${BASE}/data/price-index.csv">Download the data (CSV)</a></p></section>`;

// ---- layout
const css = `:root{--bg:${cfg.colors.bg};--ink:${cfg.colors.ink};--muted:${cfg.colors.muted};--accent:${cfg.colors.accent};--card:${cfg.colors.card};--line:${cfg.colors.line};--serif:'Cormorant Garamond','Playfair Display',Georgia,serif;--sans:system-ui,-apple-system,'Helvetica Neue',sans-serif}
:root{color-scheme:light}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:18px/1.65 Georgia,'Times New Roman',serif}
a{color:var(--accent)}main,header .in,footer .in{max-width:1040px;margin:0 auto;padding:0 20px}
.prose{max-width:720px}
header{border-bottom:1px solid var(--line)}header .in{display:flex;gap:22px;align-items:center;flex-wrap:wrap;padding-top:16px;padding-bottom:16px}
header .brand{font:600 1.7em var(--serif);letter-spacing:.01em;text-decoration:none;color:var(--ink);margin-right:auto}header a{font:12px var(--sans);letter-spacing:.16em;text-transform:uppercase;text-decoration:none;color:var(--ink)}header a:hover{color:var(--accent)}
h1,h2,h3{font-family:var(--serif);line-height:1.1;font-weight:500;letter-spacing:-.01em}h1{font-size:clamp(2.4em,5vw,3.6em);margin:1em 0 .3em}h2{margin:2.2em 0 .6em;font-size:2em;padding-top:.5em;border-top:1px solid var(--line)}h3{font-size:1.4em}
.eyebrow{font:12px var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--accent);margin:2.2em 0 0}
.muted{color:var(--muted)}.card{background:var(--card);border:1px solid var(--line);border-radius:2px;padding:16px 18px;margin:12px 0}.card a{color:var(--ink);text-decoration:none}.card a:hover{color:var(--accent)}
table{width:100%;border-collapse:collapse;font:15px var(--sans)}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid var(--line)}th{font:11px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.tag{display:inline-block;background:var(--card);border:1px solid var(--line);border-radius:999px;padding:2px 12px;margin:2px;font:13px var(--sans)}
.verdict{border-left:3px solid var(--accent);padding:6px 16px;background:var(--card)}
.answer{font-size:1.05em;margin:.4em 0 .8em}
form.nl{display:flex;gap:8px;flex-wrap:wrap}input,button{font:16px var(--sans);padding:12px 16px;border-radius:2px;border:1px solid var(--line)}input{flex:1;min-width:200px;background:var(--card);color:var(--ink)}
button,.btn{letter-spacing:.12em;text-transform:uppercase;font:13px var(--sans);background:var(--ink);color:var(--bg);border:1px solid var(--ink);cursor:pointer;padding:13px 20px;text-decoration:none;display:inline-block}
.sample{background:#fde68a;color:#451a03;text-align:center;font:13px system-ui;padding:4px}
footer{border-top:1px solid var(--line);margin-top:4em;padding:24px 0;font:14px var(--sans);color:var(--muted)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:18px}.grid .card{margin:0}
/* bottle imagery */
.bottle{position:relative;background:color-mix(in srgb,var(--c,#b39a6a) 16%,var(--card));display:flex;align-items:flex-end;justify-content:center;overflow:hidden}.bottle svg{display:block;width:100%;height:100%}.bottle img{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain;background:#fff}.bottle.xs img{object-fit:contain}.bottle.studio{background:#efe8dc}.bottle.studio img{object-fit:cover;background:none}.bottle.sm,.trio .bottle,.bottle.lg{aspect-ratio:4/5}
.bottle.sm{aspect-ratio:4/5}.bottle.sm svg{width:62%;margin:0 auto;height:auto}.bottle.xs{width:44px;height:54px;flex:none}.bottle.xs svg{height:100%;width:auto}
.bottle.lg{aspect-ratio:4/5;border:1px solid var(--line)}.bottle.lg svg{width:70%;height:auto;margin:0 auto 6%}
figure{margin:0}figcaption{font:11px var(--sans);letter-spacing:.06em;color:var(--muted);margin-top:6px}
.pcard{padding:0;overflow:hidden;display:flex;flex-direction:column}.pcard .bottle{border-bottom:1px solid var(--line)}.pcard .t{padding:12px 14px 14px}.pcard strong{font:500 1.25em var(--serif);line-height:1.2}
.v{display:inline-block;font:11px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}
/* home */
.hero{display:grid;grid-template-columns:1.05fr 1fr;gap:40px;align-items:center;padding:34px 0 10px}.hero h1{margin-top:.2em}.hero p.lede{font-size:1.2em;max-width:30em}
.trio{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-items:end}.trio figure:nth-child(2){transform:translateY(-18px)}.trio .bottle{aspect-ratio:3/4;border:1px solid var(--line)}.trio .bottle svg{width:78%;height:auto}
.moods{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px}.moods a{display:block;padding:22px 18px 18px;background:color-mix(in srgb,var(--c) 22%,var(--card));border:1px solid var(--line);text-decoration:none;color:var(--ink);font:500 1.3em var(--serif);line-height:1.15;min-height:120px;display:flex;align-items:flex-end}
.band{background:var(--ink);color:var(--bg);padding:38px 32px;margin:3em 0 0;display:grid;grid-template-columns:1.3fr 1fr;gap:30px;align-items:center}.band h2{border:0;margin:0 0 .3em;padding:0;color:var(--bg)}.band .btn{background:var(--bg);color:var(--ink);border-color:var(--bg)}.band p{opacity:.85}
.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;text-align:center}.stats b{display:block;font:500 2.6em var(--serif);line-height:1}.stats span{font:11px var(--sans);letter-spacing:.14em;text-transform:uppercase;opacity:.75}
/* scent page */
.shero{display:grid;grid-template-columns:minmax(0,360px) 1fr;gap:44px;align-items:start;padding-top:20px}.shero h1{margin-top:.1em}
.pyr{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.pyr.flat{grid-template-columns:1fr}.pyr div{background:var(--card);border:1px solid var(--line);padding:14px 16px}.pyr b{display:block;font:11px var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:6px;font-weight:500}
/* conversion */
header a.navpb{color:var(--accent);border:1px solid var(--accent);padding:6px 10px}
.buy{display:flex;flex-direction:column;gap:10px;margin:14px 0}.buy .btn{text-align:center}.btn.ghost{background:transparent;color:var(--ink)}
.samplebox{border:1px solid var(--line);background:var(--card);padding:14px 16px;margin:16px 0}.samplebox p{margin:.2em 0}.samplebox .row{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;padding:8px 0;border-top:1px solid var(--line)}.samplebox .row:first-of-type{border-top:0}
.pcard .go{display:block;padding:0 14px 14px;font:12px var(--sans);letter-spacing:.1em;text-transform:uppercase}
.sticky{display:none}
.nlframe{width:100%;height:64px;border:0;background:transparent;display:block}
@media(max-width:760px){.sticky{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:9;background:var(--ink);color:var(--bg);padding:10px 16px calc(10px + env(safe-area-inset-bottom));justify-content:space-between;align-items:center;gap:10px;font:14px var(--sans)}.sticky a{color:var(--bg);font-weight:600;white-space:nowrap}body.hasSticky footer{padding-bottom:80px}header a.navpb{padding:4px 8px}.pbhero .pbimg{max-width:150px;order:2}.pbhero>div{order:1}.pbhero{gap:18px;padding-top:8px}}
/* subscribers: no signup boxes */
.bbg-sub .watch,.bbg-sub .cta,.bbg-sub .pop,.bbg-sub .nlwrap{display:none!important}
.nlwrap{min-height:52px}
.subdl{display:none}.bbg-sub .subdl{display:block}
/* price watch */
.watch{border:1px solid var(--line);border-left:3px solid var(--accent);background:var(--card);padding:16px 18px;margin:18px 0}.watch-h{font:500 1.45em/1.15 var(--serif);margin:.2em 0}
.anchor{font:14px var(--sans);color:var(--muted);margin:2px 0 0}
${wearersCss}
/* pop-up */
.pop{position:fixed;right:24px;bottom:24px;z-index:20;width:min(560px,calc(100vw - 32px));background:var(--bg);border:1px solid var(--line);box-shadow:0 18px 50px rgba(23,20,15,.18);padding:22px 24px 16px;opacity:0;transform:translateY(16px);transition:opacity .25s,transform .25s}
.pop.on{opacity:1;transform:none}.pop-in{display:grid;grid-template-columns:110px 1fr;gap:20px;align-items:start}.pop-cover{width:110px;height:auto;border:1px solid var(--line)}
.pop-h{font:500 1.7em/1.1 var(--serif);margin:.2em 0 .3em}.pop-p{font-size:15px;margin:0 0 12px;color:var(--muted)}.pop-fine{font:12px var(--sans);color:var(--muted);margin:8px 0 0}
.pop-x{position:absolute;top:6px;right:8px;background:transparent;color:var(--ink);border:0;font:26px/1 var(--sans);padding:6px 10px;letter-spacing:0}
@media(max-width:760px){.pop{left:0;right:0;bottom:0;width:auto;border-width:1px 0 0;padding:18px 16px calc(14px + env(safe-area-inset-bottom));max-height:48vh;overflow:auto}.pop-in{grid-template-columns:1fr}.pop-cover{display:none}.pop-h{font-size:1.45em;padding-right:28px}body.popon .sticky{display:none}}
/* price book */
.pbhero{display:grid;grid-template-columns:minmax(0,300px) 1fr;gap:44px;align-items:center;padding:24px 0}.cover{aspect-ratio:3/4;background:var(--ink);color:var(--bg);padding:26px 22px;display:flex;flex-direction:column;justify-content:space-between;box-shadow:10px 12px 0 color-mix(in srgb,var(--accent) 35%,transparent)}.cover b{font:500 2.3em var(--serif);line-height:1}.pbimg{width:100%;max-width:240px;height:auto;display:block;border:1px solid var(--line);box-shadow:10px 12px 0 color-mix(in srgb,var(--accent) 25%,transparent)}.cover span{font:11px var(--sans);letter-spacing:.2em;text-transform:uppercase;opacity:.8}.cover .bottle{position:relative;background:transparent;height:92px;justify-content:flex-start}.cover .bottle svg{width:auto;height:100%}
.pbrow{display:flex;gap:12px;align-items:center}
/* dataset ledger + provenance stamps */
.ledger{border-top:1px solid var(--ink);border-bottom:1px solid var(--line);margin:3.2em 0 0;padding:26px 0 18px}.ledger-h{display:grid;grid-template-columns:1fr 1.1fr;gap:10px 44px;align-items:end}.ledger-h .eyebrow{grid-column:1/-1}.ledger-h h2{border:0;padding:0;margin:.2em 0 0;font-size:2.1em}.ledger-h p.muted{margin:0;font-size:16px}
.lstats{display:grid;grid-template-columns:repeat(4,1fr);margin:26px 0 0;border-top:1px solid var(--line)}.lstats div{padding:16px 18px 14px;border-left:1px solid var(--line)}.lstats div:first-child{border-left:0;padding-left:0}.lstats dt{font:11px var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}.lstats dd{margin:6px 0 0;font:500 3.1em/1 var(--serif);font-variant-numeric:lining-nums}
.lfind{display:grid;grid-template-columns:1fr 1fr;gap:0 44px;border-top:1px solid var(--line)}.lfind p{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:baseline;margin:0;padding:16px 0}.lfind b{font:500 2.2em/1 var(--serif);color:var(--accent);font-variant-numeric:lining-nums}.lfind span{font:15px/1.5 var(--sans);color:var(--muted)}
.lfoot{font:13px var(--sans);color:var(--muted);margin:10px 0 0;border-top:1px solid var(--line);padding-top:12px}.lfoot a{white-space:nowrap}
.ledger.compact{margin:1.2em 0 1.6em;padding:0;border-top:1px solid var(--line)}.ledger.compact .lstats{margin:0;border-top:0}.ledger.compact .lstats dd{font-size:2.3em}.ledger.compact .lfoot{margin-top:0}
.moves td.down{color:#2f6b3a}.moves td.up{color:var(--muted)}.lcap{font:12px var(--sans);letter-spacing:.06em;color:var(--muted);margin:10px 0 0}.dstamp{display:flex;flex-wrap:wrap;gap:4px 14px;font:13px var(--sans);color:var(--muted);margin:10px 0 0}.dstamp span+span:before,.dstamp a:before{content:"·";margin-right:14px;color:var(--line)}.dstamp a:before{display:inline-block;color:var(--line)}
@media(max-width:760px){.ledger{margin-top:2.4em;padding-top:20px}.ledger-h{grid-template-columns:1fr}.ledger-h h2{font-size:1.6em}.lstats{grid-template-columns:1fr 1fr;margin-top:18px}.lstats div{padding:12px 0 12px 14px}.lstats div:nth-child(odd){border-left:0;padding-left:0}.lstats div:nth-child(n+3){border-top:1px solid var(--line)}.lstats dd{font-size:2.3em}.ledger.compact .lstats dd{font-size:1.9em}.lfind{grid-template-columns:1fr}.lfind p+p{border-top:1px solid var(--line)}.lfind p{grid-template-columns:5.2rem 1fr;gap:10px}.lfind b{font-size:1.8em}.lfind span{font-size:14px}.dstamp{font-size:12px;flex-direction:column;gap:2px}.dstamp span+span:before,.dstamp a:before{display:none}}
/* quiz */
.opt{background:var(--card);color:var(--ink);border:1px solid var(--line);margin:4px 6px 4px 0;text-transform:none;letter-spacing:0;font:16px var(--sans)}.opt.on{background:var(--ink);color:var(--bg)}fieldset.q{border:0;padding:0;margin:1.8em 0}legend{font:500 1.5em var(--serif);padding:0;margin-bottom:8px}
@media(max-width:760px){body{font-size:16.5px}main,header .in,footer .in{padding:0 16px}header .in{gap:8px 16px;padding-top:12px;padding-bottom:12px}header .brand{flex-basis:100%;font-size:1.5em}header a{font-size:11px;letter-spacing:.12em}
.grid{grid-template-columns:1fr 1fr;gap:12px}.pcard strong{font-size:1.05em}.pcard .t{padding:10px 11px 12px;font-size:14px}.bottle.sm:not(.studio){aspect-ratio:1/1}.bottle.sm svg{width:52%}
h1{font-size:2.3em;margin:.6em 0 .3em}h2{font-size:1.6em;margin:1.8em 0 .5em}.hero{padding-top:14px;gap:22px}.hero p.lede{font-size:1.05em}.trio{gap:8px}.trio figure:nth-child(2){transform:none}.trio .bottle{aspect-ratio:1/1}figcaption{font-size:10px}
.moods{grid-template-columns:1fr 1fr}.moods a{min-height:84px;padding:14px;font-size:1.15em}.band{padding:26px 20px;margin:2.5em -16px 0}.stats b{font-size:2em}
.shero .bottle.lg:not(.studio){aspect-ratio:4/3}.shero .bottle.lg.studio{max-width:340px;margin:0 auto}.shero .bottle.lg svg{width:auto;height:92%}.hero .btn+a,.hero p a{white-space:nowrap}.cover{aspect-ratio:auto;min-height:260px;box-shadow:6px 8px 0 color-mix(in srgb,var(--accent) 35%,transparent)}.pbhero{gap:28px}
table{font-size:14px}th,td{padding:9px 5px}table th:nth-child(5),table td:nth-child(5){display:none}.pyr{gap:8px}
.btn,button{padding:12px 16px;font-size:12px}form.nl input{min-width:0}.eyebrow{margin-top:1.4em}.hero,.shero,.pbhero,.band{grid-template-columns:1fr}.trio figure:nth-child(2){transform:none}.pyr{grid-template-columns:1fr}.shero{gap:18px}}`;
const cta = (h=true) => `<div class="card cta">${h?'<h2 style="border:0;margin:0 0 .3em;padding:0">What luxury fragrance actually costs. Before you blind buy.</h2>':''}<p class="muted">The free Price Book: ${scents.length}+ fragrances, the lowest sample price, and the best in-stock bottle price per ml. Plus your 5 sample picks and a weekly email with opinions.</p>${nlForm('Send me the Price Book')}<p class="muted" style="font-size:14px;margin-bottom:0">Free forever. One email a week. Unsubscribe in one click, no hard feelings.</p></div>`;
// Email capture. Set cfg.beehiivFormId (data-beehiiv-form from the published beehiiv form's embed code) to go live.
// Until then the form never pretends to subscribe anyone: it hands over the Price Book and says signups open soon.
const LIVE_FORM = !!cfg.beehiivFormId;
const BHV_LOADER = 'https://subscribe-forms.beehiiv.com/v3/loader.js';
// Mounts the beehiiv loader into empty .nlwrap slots (also called by the quiz and the pop-up), and hides signup
// boxes for people who already subscribed (beehiiv sets a bhv_<pub>_subscribed cookie on submit).
const BHV_JS = !LIVE_FORM ? '' : `<script>(function(){var sub=/(^|; )bhv_[^=]*_subscribed=/.test(document.cookie);try{if(localStorage.getItem('bbg_sub'))sub=true}catch(e){}
if(sub)document.documentElement.classList.add('bbg-sub');
window.bbgMount=function(root){if(sub)return;(root||document).querySelectorAll('.nlwrap:empty').forEach(function(w){if(!root&&w.closest('[data-lazy]'))return;var s=document.createElement('script');s.async=true;s.src=${JSON.stringify(BHV_LOADER)};s.setAttribute('data-beehiiv-form',w.getAttribute('data-form')||${JSON.stringify(cfg.beehiivFormId||'')});w.appendChild(s)})};
document.addEventListener('DOMContentLoaded',function(){bbgMount()})})()</script>`;
const nlForm = (label='Get the weekly letter', fid='') => LIVE_FORM
  ? `<div class="nlwrap"${fid?` data-form="${esc(fid)}"`:''}></div>`
  : `<form class="nl" data-pending="1"><input type="email" name="email" required placeholder="you@email.com" aria-label="Email"><button>${label}</button></form>`;
// Price Book pop-up: live only with the beehiiv form. Engagement-triggered (50% scroll or 40 s; exit intent on desktop),
// once per visitor, 30 days quiet after a close, never for subscribers, never on the Price Book, thank-you, quiz or policy pages.
const POP_OFF = /^\/(price-book|find|editorial-policy|affiliate-disclosure|how-we-use-ai|methodology|404)/;
const POP = (hook) => !LIVE_FORM ? '' : `<div id="pbpop" data-lazy class="pop" role="dialog" aria-modal="false" aria-labelledby="pbpop-h" hidden><button type="button" class="pop-x" aria-label="Close">&times;</button><div class="pop-in"><img class="pop-cover" src="${BASE}/price-book/cover.jpg" alt="" width="120" height="155" loading="lazy"><div><p class="eyebrow" style="margin:0">The free Price Book</p><p id="pbpop-h" class="pop-h">${hook?esc(hook.h):'What luxury fragrance actually costs.'}</p><p class="pop-p">${hook?esc(hook.p):`Lowest sample price and best in-stock bottle per ml for ${scents.length}+ fragrances, updated monthly. Plus your 5 sample picks.`}</p>${nlForm('Send me the Price Book')}<p class="pop-fine">One email a week. Unsubscribe in one click.</p></div></div></div>
<script>(function(){var K='bbg_pop',S='bbg_sub',now=Date.now(),ls;try{ls=localStorage}catch(e){return}
try{if(ls.getItem(S)||/utm_medium=email|utm_source=beehiiv/.test(location.search))return;var t=+ls.getItem(K)||0;if(now-t<30*864e5)return}catch(e){return}
var el=document.getElementById('pbpop'),shown=false,start=now;
function inline(){var f=document.querySelectorAll('main form.nl,main .nlwrap');for(var i=0;i<f.length;i++){var r=f[i].getBoundingClientRect();if(r.top<innerHeight&&r.bottom>0)return true}return false}
function show(){if(shown||document.documentElement.classList.contains('bbg-sub'))return;if(inline()){setTimeout(show,6000);return}shown=true;try{ls.setItem(K,String(Date.now()))}catch(e){}el.hidden=false;window.bbgMount&&bbgMount(el);requestAnimationFrame(function(){el.classList.add('on')});document.body.classList.add('popon')}
function close(){el.classList.remove('on');document.body.classList.remove('popon');setTimeout(function(){el.hidden=true},250)}
el.querySelector('.pop-x').onclick=close;document.addEventListener('keydown',function(e){if(e.key==='Escape'&&shown)close()});
setTimeout(show,40000);
addEventListener('scroll',function f(){var h=document.documentElement;if((h.scrollTop+innerHeight)/h.scrollHeight>.5&&Date.now()-start>8000){removeEventListener('scroll',f);show()}},{passive:true});
if(matchMedia('(pointer:fine)').matches)document.addEventListener('mouseout',function(e){if(!e.relatedTarget&&e.clientY<=0&&Date.now()-start>8000)show()});
})()</script>`;
const WAIT = LIVE_FORM && !!cfg.waitlistFormId;
const waitForm = () => nlForm('Join the waitlist', cfg.waitlistFormId);
const watchBox = x => WAIT ? `<div class="watch"><p class="eyebrow" style="margin:0">Price alerts &middot; waitlist open</p><p class="watch-h">Want an alert when ${esc(x.name)} drops in price?</p><p class="muted" style="margin:.2em 0 10px;font-size:15px">We're building price alerts for the bottles you're circling: an email when a real in-stock price drops, or a sold-out size comes back. Join the waitlist from this page and we'll start with this one. You'll also get the free Price Book.</p>${waitForm()}<p class="muted" style="font:12px var(--sans);margin:8px 0 0"><a href="${BASE}/price-alerts/">How price alerts will work</a></p></div>` : !LIVE_FORM ? '' : `<div class="watch"><p class="eyebrow" style="margin:0">Not ready yet?</p><p class="watch-h">Watch the price of ${esc(x.name)}.</p><p class="muted" style="margin:.2em 0 10px;font-size:15px">We check retailers every month. Get an email when an in-stock bottle drops in price, plus the full Price Book. Free, one email a week.</p>${nlForm('Watch this price')}</div>`;
const scentHook = x => { const b=x.prices&&x.prices.length?[...x.prices].sort((a,c)=>a.price-c.price)[0]:null;
  return {h: b?`Before you spend ${money(b.price)} on ${x.name}.`:`Before you blind buy ${x.name}.`, p:`Get the free Price Book: the lowest sample and best in-stock bottle price for ${scents.length}+ fragrances, rechecked monthly. Plus a free price watch on this one.`}; };
// honest anchor: what the sample costs next to the bottle
const anchor = x => { const c=x.cheapestSample, b=x.prices&&x.prices.length?[...x.prices].sort((a,d)=>a.price-d.price)[0]:null;
  if(!c||!b||c.price>=b.price) return ''; const pct=Math.max(1,Math.round(c.price/b.price*100));
  return `${money(c.price)} to find out, before ${money(b.price)} on the bottle. That's ${pct}% of the price.`; };
const NL_JS = LIVE_FORM ? '' : `<script>document.addEventListener('submit',e=>{const f=e.target;if(!f.matches('form.nl[data-pending]'))return;e.preventDefault();f.outerHTML='<div class="card" style="margin:0">Thank you. Email signups open in the next few days. Until then the whole Price Book is yours, no email needed: <a href="${BASE}/price-book/blind-buy-guide-price-book.pdf"><strong>download the PDF</strong></a>.</div>'});</script>`;
const policiesNav=[['editorial-policy','Editorial policy'],['affiliate-disclosure','Affiliate disclosure'],['how-we-use-ai','How we use AI']].map(([s,l])=>`<a href="${BASE}/${s}/">${l}</a>`).join(' · ');
function page({title,desc,path:p,body,ld=[],hook=null}){
  const url = cfg.domain+BASE+p;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="color-scheme" content="light"><meta name="viewport" content="width=device-width,initial-scale=1">${cfg.headMeta||''}${p==='/'?(cfg.homeHeadMeta||''):''}
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(url)}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><meta property="og:url" content="${esc(url)}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet"><style>${css}</style>${ld.map(o=>`<script type="application/ld+json">${JSON.stringify(o).replace(/</g,'\\u003c')}</script>`).join('')}${cfg.analyticsSnippet||''}${BHV_JS}</head><body>
${usingSample?'<div class="sample">Placeholder data: library is empty, showing sample records.</div>':''}
<header><div class="in"><a class="brand" href="${BASE}/">${esc(cfg.brand)}</a><a href="${BASE}/scents/">Scents</a><a href="${BASE}/guides/">Guides</a><a href="${BASE}/find/">Find your signature</a><a class="navpb" href="${BASE}/price-book/">Free Price Book</a></div></header>
<main>${body}</main><footer><div class="in"><p>${esc(cfg.disclosure)}</p><p><a href="${BASE}/price-book/">Price Book</a> · ${WAIT?`<a href="${BASE}/price-alerts/">Price alerts</a> · `:''}<a href="${BASE}/newsletter/">Newsletter</a> · ${policiesNav}</p>${cfg.insiderLink?`<p>Free stays free. <a href="${esc(cfg.insiderLink)}">${esc(cfg.brand)} Insider</a> adds unlimited price watches.</p>`:''}<p>&copy; ${esc(cfg.brand)}</p></div></footer>${body.includes('form class="nl"')?NL_JS:''}${LIVE_FORM&&!POP_OFF.test(p)?POP(hook):''}${p==='/price-book/thanks/'?`<script>try{localStorage.setItem('bbg_sub','1')}catch(e){}</script>`:''}</body></html>`;
}
const write=(p,c)=>{const f=path.join(out,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,c);};
fs.rmSync(out,{recursive:true,force:true});

// ---- scent pages
const tags = a => arr(a).map(x=>`<span class="tag">${esc(x)}</span>`).join('');
const sorted = [...scents].sort((a,b)=>a.name.localeCompare(b.name));
for(const s of scents){
  const pref=(cfg.preferredRetailers||[]).map(x=>x.toLowerCase()); const isPref=r=>pref.includes(String(r.retailer).toLowerCase()); const rows = [...s.prices].sort((a,b)=>(isPref(b)-isPref(a))||a.ppm-b.ppm);
  const cheapest = [...s.prices].sort((a,b)=>a.ppm-b.ppm)[0];
  const sim = arr(s.similar).map(x=>bySlug[x]).filter(Boolean);
  const faqs = [];
  if(s.cheapestSample) faqs.push([`What is the smartest way to try ${s.name}?`,`The lowest sample price we track is ${money(s.cheapestSample.price)} for ${s.cheapestSample.size_ml} ml at ${s.cheapestSample.retailer} (${money(s.cheapestSample.ppm)}/ml), checked ${s.cheapestSample.checked||'recently'}.`]);
  if(s.bestPpm!=null) faqs.push([`What is the best price per ml for ${s.name}?`,`${money(cheapest.price)} for ${cheapest.size_ml} ml at ${cheapest.retailer}, which is ${money(cheapest.ppm)} per ml.`]);
  if(sim.length) faqs.push([`What smells similar to ${s.name}?`,sim.map(x=>x.name).join(', ')+'.']);
  const product = {"@context":"https://schema.org","@type":"Product",name:s.name,brand:{"@type":"Brand",name:s.house},description:s.summary||`${s.name} by ${s.house||''}`};
  if(rows.length) product.offers={"@type":"AggregateOffer",priceCurrency:"USD",lowPrice:Math.min(...rows.map(r=>r.price)).toFixed(2),highPrice:Math.max(...rows.map(r=>r.price)).toFixed(2),offerCount:rows.length};
  const ld=[product,{"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Scents",item:cfg.domain+BASE+'/scents/'},{"@type":"ListItem",position:2,name:s.name}]}];
  if(faqs.length) ld.push({"@context":"https://schema.org","@type":"FAQPage",mainEntity:faqs.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))});
  const tbl = (list,hdr)=>list.length?`<table><thead><tr><th>Retailer</th><th>Size</th><th>Price</th><th>Per ml</th><th>Checked</th></tr></thead><tbody>${list.map(p=>`<tr><td>${p.url&&p.url!=='#'?`<a rel="sponsored nofollow noopener" href="${esc(aff(p.url))}">${esc(p.retailer)}</a>`:esc(p.retailer)}</td><td>${p.size_ml} ml</td><td>${money(p.price)}</td><td>${money(p.ppm)}</td><td>${esc(p.checked||'')}</td></tr>`).join('')}</tbody></table>`:`<p class="muted">We have not found any ${hdr} yet. Suspicious, but we're looking.</p>`;
  const body = `<div class="shero"><figure>${bottle(s,'lg')}</figure><div><p class="eyebrow" style="margin-top:0">${esc(s.house||'')}${s.year?' · '+esc(s.year):''}${s.concentration?' · '+esc(s.concentration):''}</p><h1>${esc(s.name)}<br><em style="font-size:.55em;font-weight:500;color:var(--muted)">How to sample it first</em></h1>
${AF.has(s.slug)&&answerLine(s,rows[0])?`<p class="answer">${esc(answerLine(s,rows[0]))}${s.advice?` Our verdict: ${esc((LABEL[s.advice]||'').replace(/\.$/,'').toLowerCase())}.`:''}</p>`:''}
${s.advice||s.verdictLine?`<p class="verdict"><strong>The verdict: ${esc(LABEL[s.advice]||'')}</strong>${s.advice?' ':''}${esc(s.verdictLine)}</p>`:''}
${s.who?`<p>Suits: ${esc(s.who)}</p>`:''}
${s.cheapestSample||cheapest?`<div class="buy">${s.cheapestSample?(s.cheapestSample.url&&s.cheapestSample.url!=='#'?`<a class="btn" rel="sponsored nofollow noopener" href="${esc(aff(s.cheapestSample.url))}">Sample it: ${money(s.cheapestSample.price)} for ${s.cheapestSample.size_ml} ml at ${esc(s.cheapestSample.retailer)}</a>`:`<div class="card"><strong>Smartest way to sample:</strong> ${money(s.cheapestSample.price)} for ${s.cheapestSample.size_ml} ml at ${esc(s.cheapestSample.retailer)}</div>`):''}${rows[0]&&rows[0].url&&rows[0].url!=='#'?`<a class="btn ghost" rel="sponsored nofollow noopener" href="${esc(aff(rows[0].url))}">Already sure? ${money(rows[0].price)} for ${rows[0].size_ml} ml at ${esc(rows[0].retailer)}</a>`:''}${anchor(s)?`<p class="anchor">${esc(anchor(s))}${s.cheapestSample&&s.cheapestSample.checked?` Prices checked ${esc(s.cheapestSample.checked)}.`:''}</p>`:''}</div>`:''}${stamp(s)}</div></div>
<h2>What's in it</h2>${s.notes_flat&&arr(s.notes.top).length?`<div class="pyr flat"><div><b>Notes</b>${tags(s.notes.top)}</div></div><p class="muted">${esc(s.notes_flat_caption||'The shop lists these notes without top, heart and base tiers.')}</p>`:['top','heart','base'].some(k=>arr(s.notes[k]).length)?`<div class="pyr">${['top','heart','base'].map(k=>`<div><b>${k[0].toUpperCase()+k.slice(1)}</b>${tags(s.notes[k])||'<span class="muted">&ndash;</span>'}</div>`).join('')}</div>`:''}${arr(s.accords).length?`<p><strong>Accords:</strong> ${tags(s.accords)}</p>`:''}
${wearersSection(loadWearers(s.slug))}
<h2>Sample before you commit</h2>${tbl([...s.samples].sort((a,b)=>a.size_ml-b.size_ml||a.price-b.price),'sample prices')}
<h2>The full-bottle math</h2>${tbl(rows,'full-size prices')}${alsoAt(s)}${amazonLine(s)}${movesBlock(s)}${pref.length?'<p class="muted">Authorized retailers are listed first.</p>':''}${watchBox(s)}
${sim.length?`<h2>If you like this, try</h2><div class="grid">${sim.map(x=>`<div class="card"><a href="${BASE}/scents/${x.slug}/">${esc(x.name)}</a><br><span class="muted">${esc(x.house||'')}</span></div>`).join('')}</div>`:''}
${faqs.length?`<h2>FAQ</h2>${faqs.map(([q,a])=>`<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}`:''}
${cta()}${s.cheapestSample&&s.cheapestSample.url&&s.cheapestSample.url!=='#'?`<div class="sticky"><span>Sample from ${money(s.cheapestSample.price)}</span><a rel="sponsored nofollow noopener" href="${esc(aff(s.cheapestSample.url))}">Get the sample &rarr;</a></div><script>document.body.classList.add('hasSticky')</script>`:''}`;
  write(`scents/${s.slug}/index.html`,page({title:`${s.name} sample: how to try it before you buy | ${cfg.brand}`,desc:AF.has(s.slug)&&answerLine(s,rows[0])?answerLine(s,rows[0]):(s.samples.length?`${s.name} samples from ${money(Math.min(...s.samples.map(x=>x.price)))} to ${money(Math.max(...s.samples.map(x=>x.price)))}. `:'')+(s.verdictLine||`Notes, similar scents, price per ml and how to try ${s.name} before you buy.`),path:`/scents/${s.slug}/`,body,ld,hook:scentHook(s)}));
}
// ---- index pages
const cardFor = x=>`<div class="card pcard"><a href="${BASE}/scents/${x.slug}/">${bottle(x,'sm')}<div class="t"><strong>${esc(x.name)}</strong><br><span class="muted">${esc(x.house||'')}</span>${x.bestPpm!=null?`<br><span class="muted">from ${money(x.bestPpm)}/ml</span>`:''}${x.cheapestSample?`<br><span class="muted">sample ${money(x.cheapestSample.price)}</span>`:''}</div></a></div>`;
const letterOf = s => (s.name[0]||'#').toUpperCase().replace(/[^A-Z]/,'#');
const letters = [...new Set(sorted.map(letterOf))].sort();
const nav = cur => `<p>${letters.map(l=>`<a href="${BASE}/scents/letter/${l==='#'?'0':l.toLowerCase()}/"${l===cur?' style="font-weight:700"':''}>${l}</a>`).join(' · ')}</p>`;
for(const l of letters){ const lp = `/scents/letter/${l==='#'?'0':l.toLowerCase()}/`;
  write(lp.slice(1)+'index.html',page({title:`Scents starting with ${l} | ${cfg.brand}`,desc:`Fragrances starting with ${l}: price per ml and sample prices.`,path:lp,body:`<h1>Scents: ${l}</h1>${nav(l)}<div class="grid">${sorted.filter(s=>letterOf(s)===l).map(cardFor).join('')}</div>`})); }
const cheapestSamples = [...scents].filter(s=>s.cheapestSample).sort((a,b)=>a.cheapestSample.price-b.cheapestSample.price).slice(0,24);
write('scents/index.html',page({title:`All scents | ${cfg.brand}`,desc:'Every scent we cover, with price per ml and sample prices.',path:'/scents/',body:`<h1>All scents (${scents.length})</h1>${ledger(true)}${nav('')}<h2>Start sampling here</h2><div class="grid">${cheapestSamples.map(cardFor).join('')}</div>`}));
const hasV=s=>s.advice&&s.prices.length&&s.cheapestSample; const FEAT=['baccarat-rouge-540-edp','tom-ford-oud-wood','creed-aventus','delina-edp','tom-ford-tobacco-vanille-edp','santal-33-edp'];
const verdictPicks=[...FEAT.map(x=>bySlug[x]).filter(x=>x&&hasV(x)),...scents.filter(hasV)].filter((x,i,a)=>a.indexOf(x)===i).slice(0,8);
const featured=[verdictPicks[1],verdictPicks[0],verdictPicks[2]].filter(Boolean);
write('index.html',page({title:`${cfg.brand}: ${cfg.tagline}`,desc:cfg.tagline+' Price per ml and sample prices for niche fragrances.',path:'/',
  ld:[{"@context":"https://schema.org","@type":"WebSite",name:cfg.brand,url:cfg.domain+BASE+'/'}],
  body:`<section class="hero"><div><p class="eyebrow" style="margin-top:0">Luxury fragrance, sampled first</p><h1>${esc(cfg.tagline)}</h1><p class="lede">${n0(DATA.pricePoints)} dated prices from ${DATA.retailers} retailers, boiled down to one answer per bottle: buy it, or sample it first, and where. Then one email a week on what is worth it, and what is not.</p><p style="display:flex;gap:18px;flex-wrap:wrap;align-items:center"><a class="btn" href="${BASE}/find/">Find your signature</a><a href="${BASE}/price-book/" style="white-space:nowrap">Read the Price Book &rarr;</a></p></div>
<div class="trio">${featured.map(x=>`<figure>${bottle(x,'')}<figcaption>${esc(x.name)}</figcaption></figure>`).join('')}</div></section>
${giftPromo({bySlug,bottle,BASE,esc,contentDir:process.env.CONTENT||'/mnt/project-files/content/'})}
${ledger()}

<h2>The verdicts</h2><div class="grid">${verdictPicks.map(cardFor).join('')}</div><p><a href="${BASE}/scents/">All ${scents.length} fragrances &rarr;</a></p>
<h2>Start with a mood</h2><div class="moods">${MOODS.map(m=>`<a href="${BASE}/find/?v=${m[0]}" style="--c:${m[2]}">${m[3]}</a>`).join('')}</div>
<section class="band"><div><p class="eyebrow" style="margin-top:0;color:var(--bg);opacity:.7">The free Price Book</p><h2>What luxury fragrance actually costs.</h2><p>${scents.length}+ fragrances: the lowest sample price and the best in-stock bottle price per ml, in one place. Free, and it comes with your 5 sample picks.</p><a class="btn" href="${BASE}/price-book/">Get the free Price Book</a></div><div class="stats"><div><b>${scents.length}</b><span>Fragrances</span></div><div><b>${scents.filter(x=>x.cheapestSample).length}</b><span>With samples</span></div><div><b>1</b><span>Email a week</span></div></div></section>
${cta()}`}));
write('newsletter/index.html',page({title:`${cfg.newsletterName} | ${cfg.brand}`,desc:'A weekly email: what to buy, what to skip, and how to sample first.',path:'/newsletter/',body:`<h1>${esc(cfg.newsletterName)}</h1><p>One email a week: what is worth buying, what to sample first, and where to buy it.</p>${cta()}`}));
// ---- finder tool (client-side, data inlined)
write('data/finder.json',JSON.stringify(scents.map(s=>{ const sm=[...s.samples].sort((a,b)=>a.size_ml-b.size_ml||a.price-b.price)[0]; const ch=s.cheapestSample;
  return [s.slug,s.name,s.house||'',s.allNotes.map(x=>x.toLowerCase()),ch?ch.price:null,ch?ch.size_ml:null,sm?sm.price:null,sm?sm.size_ml:null,(s.concentration||'').toLowerCase(),mood(s),hash(s.slug)%4,ch&&ch.url&&ch.url!=='#'?aff(ch.url):null,STUDIO.has(s.slug)?1:0,ch?ch.retailer:null]; })));
const Q=(id,label,opts,multi)=>`<fieldset class="q" data-q="${id}" data-multi="${multi?1:0}"><legend>${label}</legend>${opts.map(([v,t])=>`<button type="button" class="opt" data-v="${v}">${t}</button>`).join('')}</fieldset>`;
write('find/index.html',page({title:`Find your next signature | ${cfg.brand}`,desc:'Four questions. Five samples. Zero $300 regrets.',path:'/find/',body:`<div class="prose"><p class="eyebrow">Four questions</p><h1 style="margin-top:.2em">Find your next signature</h1><p class="muted">Four questions. Five samples. Zero $300 regrets.</p>

${Q('v','1. What are you in the mood for? (pick any)',[['fresh','Fresh and citrus'],['woods','Woods and vetiver'],['sweet','Sweet and cozy'],['florals','Florals'],['smoke','Smoke, oud and leather']],true)}
${Q('w','2. When do you wear it?',[['day','Every day and the office'],['eve','Evenings out'],['special','Special occasions']])}
${Q('l','3. How loud?',[['skin','Close to the skin'],['room','Fills the room']])}
<fieldset class="q"><legend>4. A scent you already love (optional)</legend><input id="q" placeholder="Search scents" autocomplete="off"><div id="opts"></div><p id="chosen"></p></fieldset>
<div id="out"></div></div>
<script>${bottleSvg.toString()};const SHAPES=${JSON.stringify(SHAPES)};const B=${JSON.stringify(BASE)};
const K={fresh:['bergamot','lemon','grapefruit','mint','neroli','sea'],woods:['cedar','vetiver','sandalwood','oakmoss'],sweet:['vanilla','tonka','praline','cacao','honey','tobacco','cognac'],florals:['rose','jasmine','tuberose','iris','magnolia','orange blossom'],smoke:['oud','incense','leather','birch','saffron']};
const URLQ=new URLSearchParams(location.search);let D=[],A={v:(URLQ.get('v')||'').split(',').filter(Boolean),w:URLQ.get('w')||'',l:URLQ.get('l')||'',s:URLQ.get('s')||''};
const $=id=>document.getElementById(id),money=n=>'$'+(n%1?n.toFixed(2):n);
function sync(){document.querySelectorAll('fieldset.q[data-q]').forEach(f=>{const k=f.dataset.q;f.querySelectorAll('.opt').forEach(b=>b.classList.toggle('on',k==='v'?A.v.includes(b.dataset.v):A[k]===b.dataset.v))});
 const u=new URLSearchParams();if(A.v.length)u.set('v',A.v.join(','));if(A.w)u.set('w',A.w);if(A.l)u.set('l',A.l);if(A.s)u.set('s',A.s);history.replaceState(null,'',u.toString()?'?'+u:location.pathname)}
document.querySelectorAll('fieldset.q[data-q]').forEach(f=>f.onclick=e=>{const b=e.target.closest('.opt');if(!b)return;const k=f.dataset.q,v=b.dataset.v;
 if(k==='v')A.v=A.v.includes(v)?A.v.filter(x=>x!==v):A.v.concat(v);else A[k]=A[k]===v?'':v;go()});
const q=$('q'),opts=$('opts'),chosen=$('chosen');
q.oninput=()=>{const t=q.value.toLowerCase().trim();opts.innerHTML=t?D.filter(d=>d[1].toLowerCase().includes(t)&&d[0]!==A.s).slice(0,8).map(d=>'<button type="button" data-s="'+d[0]+'" class="tag">+ '+d[1]+'</button>').join(''):''};
opts.onclick=e=>{const s=e.target.dataset.s;if(s){A.s=s;q.value='';opts.innerHTML='';go()}};
chosen.onclick=e=>{if(e.target.dataset.x){A.s='';go()}};
function go(){sync();const loved=D.find(d=>d[0]===A.s);chosen.innerHTML=loved?'<button type="button" data-x="1" class="tag">'+loved[1]+' ×</button>':'';
 if(!A.v.length&&!loved){$('out').innerHTML='<p class="muted">Pick at least one mood, or a scent you love, and we will do the rest.</p>';return}
 const want=new Set(A.v.flatMap(v=>K[v]||[])),lov=new Set(loved?loved[3]:[]);
 const sc=d=>{let s=0;for(const n of d[3]){if([...want].some(k=>n.includes(k)))s+=3;if(lov.has(n))s+=2}
  const c=d[8];const heavy=/extrait|parfum$|parfum/.test(c)&&!/toilette|cologne/.test(c),light=/toilette|cologne/.test(c);
  if(A.l==='room'&&heavy)s+=1;if(A.l==='skin'&&light)s+=1;if(A.w==='special'&&heavy)s+=1;if(A.w==='day'&&light)s+=1;return s};
 const r=D.filter(d=>d[4]!=null&&d!==loved).map(d=>({d,s:sc(d)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||a.d[4]-b.d[4]);
 const pick=[],h={};for(const x of r){if((h[x.d[2]]||0)>=2)continue;h[x.d[2]]=(h[x.d[2]]||0)+1;pick.push(x.d);if(pick.length===5)break}
 if(!pick.length){$('out').innerHTML='<p class="muted">Nothing in the library matches that yet. Try another mood.</p>';return}
 const tot=pick.reduce((a,d)=>a+(d[6]||0),0),all1=pick.every(d=>d[7]!=null&&d[7]<=1.5);
 $('out').innerHTML='<h2>Your '+pick.length+' samples</h2><div class="grid">'+pick.map(d=>'<div class="card pcard"><a href="'+B+'/scents/'+d[0]+'/">'+(d[12]?'<div class="bottle studio sm"><img src="'+B+'/images/studio/'+d[0]+'-sm.webp" alt="" loading="lazy"></div>':'<div class="bottle sm" style="--c:'+d[9]+'">'+bottleSvg(d[10],d[9])+'</div>')+'<div class="t"><strong>'+d[1]+'</strong><br><span class="muted">'+d[2]+'</span><br><span class="muted">Sample '+money(d[4])+' ('+d[5]+' ml)'+(d[13]?' at '+d[13]:'')+'</span></div></a>'+(d[11]?'<a class="go" rel="sponsored nofollow noopener" href="'+d[11]+'">Get the sample &rarr;</a>':'')+'</div>').join('')+'</div><p>'+(all1?'A 1 ml set of these is about ':'A smallest-size set of these is about ')+'<strong>'+money(Math.round(tot*100)/100)+'</strong>. Prices checked on the dates shown on each page.</p><h2>Your two-week testing plan</h2><ol><li>Wear two samples at a time, one on each arm, and never more.</li><li>Wear each for a full day, not a quick sniff at the counter.</li><li>Recheck at hour 4. That is when the drydown tells you what you actually bought.</li><li>Take notes, then run the next two. Two weeks covers all five with room to retest a favorite.</li></ol><h2>Keep the list</h2><p>Bookmark this page: the link keeps your answers. Or get your picks and the full Price Book by email, plus one free price watch.</p>${nlForm('Email me my 5 and the Price Book').replace(/'/g,"\\'")}';window.bbgMount&&bbgMount()}
fetch(B+'/data/finder.json').then(r=>r.json()).then(d=>{D=d;go()});sync();</script>`}));
// ---- price book
{ const pb=path.join('/mnt/project-files/content/price-book'); let rows=[]; try{ rows=JSON.parse(fs.readFileSync(path.join(pb,'data.json'),'utf8')); }catch{}
  const hasPdf=fs.existsSync(path.join(pb,'blind-buy-guide-price-book.pdf'));
  if(hasPdf) write('price-book/blind-buy-guide-price-book.pdf',fs.readFileSync(path.join(pb,'blind-buy-guide-price-book.pdf')));
  const hasCover=fs.existsSync(path.join(pb,'cover.jpg')); if(hasCover) write('price-book/cover.jpg',fs.readFileSync(path.join(pb,'cover.jpg')));
  rows=[...rows].sort((a,b)=>(a.house||'').localeCompare(b.house||'')||(a.name||'').localeCompare(b.name||''));
  const tr=r=>`<tr data-s="${esc((r.name+' '+r.house).toLowerCase())}"><td><div class="pbrow">${bottle(bySlug[r.slug]||{slug:r.slug,allNotes:[],accords:[]},'xs')}<div><a href="${BASE}/scents/${r.slug}/">${esc(r.name)}</a><br><span class="muted">${esc(r.house||'')}</span></div></div></td><td>${r.sample?money(r.sample.price)+' / '+r.sample.size_ml+' ml':'&ndash;'}</td><td>${r.bottle?money(r.bottle.ppm)+'/ml<br><span class="muted">'+money(r.bottle.price)+' for '+r.bottle.size_ml+' ml, '+esc(r.bottle.retailer||'')+(r.bottle.status?' ('+esc(r.bottle.status)+')':'')+'</span>':'&ndash;'}</td></tr>`;
  write('price-book/index.html',page({title:`The Price Book: what luxury fragrance actually costs | ${cfg.brand}`,desc:`${rows.length} fragrances with the lowest sample price and the best bottle price per ml, with stock status.`,path:'/price-book/',
   body:`<section class="pbhero">${hasCover?`<img class="pbimg" src="${BASE}/price-book/cover.jpg" alt="Cover of the Price Book PDF" width="600" height="776">`:`<div class="cover"><span>${esc(cfg.brand)}</span><div class="bottle">${bottleSvg(0,'#b8772f')}${bottleSvg(2,'#5b3a24')}${bottleSvg(1,'#c4818a')}</div><b>The<br>Price<br>Book</b></div>`}<div><p class="eyebrow" style="margin-top:0">${LIVE_FORM?'Free with the newsletter':'Free, no strings'}</p><h1 style="margin-top:.2em">What luxury fragrance actually costs</h1><p>The lowest sample price and the best bottle price per ml for ${rows.length} fragrances, with stock status where retailers show it. Updated each library refresh.</p>${hasPdf?(LIVE_FORM?`<p><strong>Get the PDF by email</strong>, plus each new monthly edition and one free price watch. The full table below stays open to everyone.</p>${nlForm('Email me the Price Book')}<p class="subdl"><a class="btn" href="${BASE}/price-book/blind-buy-guide-price-book.pdf">Download the PDF</a></p>`:`<p><a class="btn" href="${BASE}/price-book/blind-buy-guide-price-book.pdf">Download the PDF</a></p><p class="muted" style="font-size:14px">Want each new monthly edition? Leave your email at the bottom of the page.</p>`):''}</div></section>${ledger(true,rows.length&&rows.length<DATA.scents?`The library behind it, as of today. This edition of the Price Book covers ${rows.length}; the next edition picks up the rest.`:'The library behind it, as of today.')}<input id="pbq" placeholder="Filter by scent or house" style="width:100%;margin:8px 0"><table><thead><tr><th>Scent</th><th>Lowest sample</th><th>Best bottle</th></tr></thead><tbody id="pbt">${rows.map(tr).join('')}</tbody></table>${cta()}<script>const q=document.getElementById('pbq');q.oninput=()=>{const t=q.value.toLowerCase();document.querySelectorAll('#pbt tr').forEach(r=>r.hidden=t&&!r.dataset.s.includes(t))}</script>`}));
  write('price-book/thanks/index.html',page({title:`You're in | ${cfg.brand}`,desc:'Your Price Book.',path:'/price-book/thanks/',body:`<div class="prose"><p class="eyebrow">You're in</p><h1 style="margin-top:.2em">Your Price Book is ready</h1><p>It is also on its way to your inbox, along with a welcome email worth opening.</p>${hasPdf?`<p><a class="btn" href="${BASE}/price-book/blind-buy-guide-price-book.pdf">Download the PDF</a></p>`:''}<h2>Next: your five samples</h2><p>Four questions, five sample picks and a two-week testing plan. <a href="${BASE}/find/">Find your signature &rarr;</a></p><h2>Your free price watch</h2><p>Reply to the welcome email with one fragrance you are circling. We will tell you when it is back in stock or a real in-stock price drops.</p></div>`}).replace('<head>','<head><meta name="robots" content="noindex">'));
  if(WAIT){ write('price-alerts/index.html',page({title:`Price alerts for luxury fragrance | ${cfg.brand}`,desc:'Get an email when a fragrance you are watching drops in price or comes back in stock. Join the waitlist.',path:'/price-alerts/',body:`<div class="prose"><p class="eyebrow">Waitlist open</p><h1 style="margin-top:.2em">Price alerts, for the bottles you're circling</h1><p class="lede" style="font-size:1.15em">We already recheck sample and full-bottle prices across ${scents.length}+ fragrances and dozens of retailers. Price alerts turn that into an email the moment it matters to you.</p><div class="watch"><p class="watch-h">Join the waitlist</p><p class="muted" style="margin:.2em 0 10px;font-size:15px">Free to join. You'll also get the Price Book and one email a week.</p>${waitForm()}</div><h2>What you'll get</h2><ul><li><strong>Price drops.</strong> An email when a real, in-stock bottle of a scent you watch gets cheaper. Sold-out listings never count as deals.</li><li><strong>Restocks.</strong> An email when a sold-out size comes back.</li><li><strong>Several scents at once.</strong> Watch the short list you're deciding between, not just one.</li></ul><h2>Already a subscriber?</h2><p>You get one free price watch now: reply to any of our emails with the fragrance you're circling. The waitlist is for the fuller version.</p><p><a href="${BASE}/price-book/">Browse the Price Book &rarr;</a></p></div>`})); urls.push('/price-alerts/'); }
  urls.push('/price-book/'); }
for(const sl of STUDIO) for(const suf of ['','-sm']) write(`images/studio/${sl}${suf}.webp`,fs.readFileSync(path.join(root,'images','studio',sl+suf+'.webp')));
for(const im of Object.values(IMGS)) if(im.file) write('images/'+im.file,fs.readFileSync(path.join(root,'images',im.file)));
write('404.html',page({title:`Not found | ${cfg.brand}`,desc:'Page not found.',path:'/404.html',body:'<h1>That page does not exist</h1><p><a href="/">Home</a></p>'}));
// ---- policy pages (markdown in content/, placeholders from config)
const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,(m,t,u)=>`<a href="${u.startsWith('/')?BASE+u:u}">${t}</a>`);
function md(src,shift){ const out=[]; let ul=false, tb=null; const flush=()=>{ if(ul){out.push('</ul>');ul=false} if(tb){ const rows=tb.filter(r=>!/^\s*\|?[\s:|-]+\|?\s*$/.test(r)).map(r=>r.replace(/^\||\|$/g,'').split('|').map(c=>inline(c.trim()))); out.push('<table><thead><tr>'+rows[0].map(c=>'<th>'+c+'</th>').join('')+'</tr></thead><tbody>'+rows.slice(1).map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</tbody></table>'); tb=null } };
  for(const raw of src.split('\n')){ const l=raw.trimEnd();
    if(l.trim().startsWith('|')){ if(ul){out.push('</ul>');ul=false} (tb||=[]).push(l); continue }
    if(tb) flush();
    if(/^[-*] /.test(l)){ if(!ul){out.push('<ul>');ul=true} out.push('<li>'+inline(l.slice(2))+'</li>'); continue }
    if(ul){out.push('</ul>');ul=false}
    const h=l.match(/^(#{1,4}) (.*)/); if(h){ const n=Math.max(1,h[1].length-(shift&&h[1].length>=2?1:0)); out.push(`<h${n}>${inline(h[2])}</h${n}>`) } else if(l.trim()) out.push('<p>'+inline(l)+'</p>'); }
  flush(); return out.join('\n'); }
function front(src){ const m=src.match(/^---\n([\s\S]*?)\n---\n/); const fm={}; if(m){ let cur=null; for(const l of m[1].split('\n')){
    const li=l.match(/^\s+-\s+q:\s*(.*)$/); if(li&&cur==='faq'){ fm.faq.push({q:li[1].replace(/^["']|["']$/g,''),a:''}); continue }
    const la=l.match(/^\s+a:\s*(.*)$/); if(la&&cur==='faq'&&fm.faq.length){ fm.faq[fm.faq.length-1].a=la[1].replace(/^["']|["']$/g,''); continue }
    const k=l.match(/^(\w+):\s*(.*)$/); if(!k) continue; cur=k[1]; let v=k[2].replace(/\s+#.*$/,'');
    if(k[1]==='faq'){ fm.faq=[]; continue }
    if(/^\[.*\]$/.test(v)) fm[k[1]]=v.slice(1,-1).split(',').map(x=>x.trim().replace(/^["']|["']$/g,'')).filter(Boolean); else fm[k[1]]=v.replace(/^["']|["']$/g,''); }
  src=src.slice(m[0].length);} return [fm,src]; }
const policies=[['editorial-policy','Editorial policy'],['affiliate-disclosure','Affiliate disclosure'],['how-we-use-ai','How we use AI']];
for(const [slug,label] of policies){ const f=path.join(root,'content',slug+'.md'); if(!fs.existsSync(f)) continue;
  let src=fs.readFileSync(f,'utf8').replace(/\{\{BRAND\}\}/g,cfg.brand).replace(/\{\{DOMAIN\}\}/g,cfg.domain);
  src = cfg.contactEmail ? src.replace(/\{\{CONTACT_EMAIL\}\}/g,cfg.contactEmail) : src.replace(/email \{\{CONTACT_EMAIL\}\}/g,'reply to any newsletter email');
  write(`${slug}/index.html`,page({title:`${label} | ${cfg.brand}`,desc:`${label} for ${cfg.brand}.`,path:`/${slug}/`,body:'<div class="prose">'+md(src,true)+'</div>'})); urls.push(`/${slug}/`); }
function section(kind,label,dir){ const d=(process.env.CONTENT||'/mnt/project-files/content/')+dir; const items=[];
  if(fs.existsSync(d)) for(const f of fs.readdirSync(d).filter(f=>f.endsWith('.md'))){ try{
    let [fm,body]=front(fs.readFileSync(path.join(d,f),'utf8')); const slug=fm.slug||f.replace(/\.md$/,'');
    body=body.replace(/\{\{BRAND\}\}/g,cfg.brand).replace(/\{\{DOMAIN\}\}/g,cfg.domain).replace(/\{\{NEWSLETTER\}\}/g,cfg.newsletterName);
    const title=fm.title||(body.match(/^#+ (.*)/)||[])[1]||slug; const html=md(body.replace(/^# .*\n/,'')); const desc=fm.description||fm.answer||body.replace(/[#*|\[\]\n]+/g,' ').trim().slice(0,155);
    const faqs=arr(fm.faq).filter(x=>x.q&&x.a);
    const ld=[{"@context":"https://schema.org","@type":"Article",headline:title,description:desc,datePublished:fm.published||undefined,dateModified:fm.prices_as_of||fm.published||undefined}];
    if(faqs.length) ld.push({"@context":"https://schema.org","@type":"FAQPage",mainEntity:faqs.map(x=>({"@type":"Question",name:x.q,acceptedAnswer:{"@type":"Answer",text:x.a}}))});
    const rel=arr(fm.scents).map(x=>bySlug[x]).filter(Boolean);
    const box=rel.filter(x=>x.cheapestSample).length?`<div class="samplebox"><p class="eyebrow" style="margin:0 0 4px">Where to sample${rel.length>1?' them':' it'}</p>${rel.filter(x=>x.cheapestSample).map(x=>{const c=x.cheapestSample,ok=c.url&&c.url!=='#';return `<div class="row"><span><a href="${BASE}/scents/${x.slug}/">${esc(x.name)}</a><br><span class="muted" style="font:13px var(--sans)">${money(c.price)} for ${c.size_ml} ml at ${esc(c.retailer)}${anchor(x)?'<br>'+esc(anchor(x).split('. ')[1]||''):''}</span></span>${ok?`<a class="btn" rel="sponsored nofollow noopener" href="${esc(aff(c.url))}">Get the sample</a>`:''}</div>`}).join('')}</div>`:'';
    write(`${kind}/${slug}/index.html`,page({title:`${title} | ${cfg.brand}`,desc,path:`/${kind}/${slug}/`,ld,hook:rel[0]?scentHook(rel[0]):null,body:`<div class="prose"><h1>${esc(title)}</h1>${fm.answer?`<p class="verdict"><strong>Short answer:</strong> ${inline(fm.answer)}</p>`:''}${box}${html}${rel[0]?watchBox(rel[0]):''}${rel.length?`<h2>Scents mentioned</h2><div class="grid">${rel.map(cardFor).join('')}</div>`:''}${fm.prices_as_of?`<p class="muted">Prices as of ${esc(fm.prices_as_of)}.</p>`:''}</div>${cta()}`}));
    urls.push(`/${kind}/${slug}/`); items.push({slug,title,desc,scents:arr(fm.scents)}); }catch(e){ console.warn('skip',f,e.message) } }
  items.sort((a,b)=>a.title.localeCompare(b.title));
  write(`${kind}/index.html`,page({title:`${label} | ${cfg.brand}`,desc:`${label} from ${cfg.brand}.`,path:`/${kind}/`,body:`<h1>${label}</h1>${items.length?`<div class="grid">${items.map(i=>`<div class="card"><a href="${BASE}/${kind}/${i.slug}/"><strong>${esc(i.title)}</strong></a><br><span class="muted">${esc(i.desc)}</span></div>`).join('')}</div>`:'<p class="muted">Coming soon. We are still reading the fine print.</p>'}`}));
  urls.push(`/${kind}/`); SECTION_ITEMS[kind]=items; return items.length; }
const SECTION_ITEMS={};
const nG=section('guides','Guides','guides'), nC=section('compare','Comparisons','comparisons');
guidesIndex(); // curated guides front page (src/guides-index.mjs)
giftGuide({bySlug,bottle,page,write,esc,aff,money,fmtDate,BASE,cfg,urls,nlForm,retailerName,contentDir:process.env.CONTENT||'/mnt/project-files/content/'}); // holiday gift guide (src/gift-guide.mjs)
// ---- guides front page: a curated start, then worth-it verdicts grouped by house with search (every guide URL unchanged)
function guidesIndex(){
  const G=SECTION_ITEMS.guides||[], C=SECTION_ITEMS.compare||[]; const by=Object.fromEntries(G.map(g=>[g.slug,g]));
  const HOUSE={'BYREDO':'Byredo','By Kilian':'Kilian','Kilian Paris':'Kilian','Tom Ford (Private Blend)':'Tom Ford','Initio Parfums':'Initio Parfums Privés','Initio':'Initio Parfums Privés'};
  const houseOf=x=>{const h=String(x&&x.house||'').trim(); return HOUSE[h]||h||'More houses';};
  const CONC=/\s+(Eau de Parfum|Eau de Toilette|Extrait de Parfum|Extrait|Parfum|Cologne|EDP|EDT)$/i;
  const shortName=(x,fallback,keepConc)=>{ let n=String(x?x.name:fallback).trim(); const h=houseOf(x);
    for(const pre of [x&&x.house,h,'Maison Francis Kurkdjian','Tom Ford','Parfums de Marly','Initio','Kilian','By Kilian','BYREDO','Byredo','Maison Margiela Replica','Maison Margiela'].filter(Boolean)) if(n.toLowerCase().startsWith(pre.toLowerCase()+' ')){ n=n.slice(pre.length+1); break; }
    n=n.replace(/^(Replica|Private Blend)\s+/i,''); const full=n.replace(/[\s\-–]+$/,''); for(let i=0;i<2;i++) n=n.replace(CONC,''); n=n.replace(/[\s\-–]+$/,'').trim(); return keepConc?full:(n||full); };
  const q=(...a)=>esc(a.join(' ').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase());
  const link=slug=>`${BASE}/guides/${slug}/`;
  // 1. start here (the method), 2. good to know (reference reads)
  const START=[['how-to-test-a-fragrance','The method'],['which-sample-size-to-buy','The math'],['should-you-blind-buy-niche-fragrance','The big question']].filter(([s])=>by[s]);
  const KNOW=['safe-blind-buy-perfumes','perfume-layering-combinations','blind-buy-guide-price-index-november-2026','are-perfume-decants-legit','sprays-in-a-2ml-sample','price-per-ml-niche-fragrance','same-perfume-different-price','is-a-bigger-bottle-cheaper'].filter(s=>by[s]);
  const worth=G.filter(g=>/^is-.*-worth-it$/.test(g.slug)&&!KNOW.includes(g.slug));
  const houseGuides=G.filter(g=>g.slug.startsWith('how-to-find-your-'));
  const used=new Set([...START.map(x=>x[0]),...KNOW,...worth.map(g=>g.slug),...houseGuides.map(g=>g.slug)]);
  const extra=G.filter(g=>!used.has(g.slug)); // anything new and uncategorised still gets listed
  // group verdicts by house
  const groups={};
  for(const g of worth){ const s=bySlug[g.scents[0]]; const h=houseOf(s); (groups[h]||=[]).push({g,s,name:shortName(s,g.title.replace(/^Is\s+/i,'').replace(/\s+worth it\?$/i,''))}); }
  const hg={}; for(const g of houseGuides){ const s=bySlug[g.scents[0]]; if(s) hg[houseOf(s)]=g; }
  for(const list of Object.values(groups)){ const c={}; list.forEach(e=>c[e.name]=(c[e.name]||0)+1); list.forEach(e=>{ if(c[e.name]>1&&e.s) e.name=shortName(e.s,'',true); }); }
  let names=Object.keys(groups).sort((a,b)=>a.localeCompare(b));
  const small=names.filter(h=>groups[h].length<3&&!hg[h]); if(small.length>1){ groups['More houses']=small.flatMap(h=>groups[h]); names=names.filter(h=>!small.includes(h)).concat('More houses'); }
  const id=h=>'h-'+h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const tile=({g,s,name})=>`<a class="gt" href="${link(g.slug)}" data-q="${q(name,s&&s.name,s&&s.house,houseOf(s))}">${s?bottle(s,'sm'):''}<span>${esc(name)}</span></a>`;
  const houses=names.map(h=>{ const list=groups[h].sort((a,b)=>a.name.localeCompare(b.name)); const guide=hg[h];
    return `<section class="gh" id="${id(h)}" data-group><div class="ghh"><h3>${esc(h)}</h3>${guide?`<a href="${link(guide.slug)}" data-q="${q(h,guide.title)}">The ${esc(h==='Maison Francis Kurkdjian'?'MFK':h)} buying guide <span aria-hidden="true">→</span></a>`:''}</div><div class="gts">${list.map(tile).join('')}</div></section>`; }).join('');
  const nV=worth.length, nH=names.length;
  const cmp=C.map(c=>{ const [a,b]=c.scents.map(x=>bySlug[x]); if(!a||!b) return ''; const sub=(c.title.split(':').slice(1).join(':')||'').trim();
    return `<a class="gc" href="${BASE}/compare/${c.slug}/" data-q="${q(a.name,b.name,a.house,b.house)}"><div class="gcb">${bottle(a,'sm')}${bottle(b,'sm')}</div><span class="gcn">${esc(shortName(a))} <i>vs</i> ${esc(shortName(b))}</span>${sub?`<span class="gcs">${esc(sub)}</span>`:''}</a>`; }).join('');
  const css=`<style>
.gx-hero{padding:8px 0 6px;max-width:760px}.gx-hero h1{margin:.25em 0 .2em}.gx-hero .lede{font-size:1.15em;color:var(--muted);max-width:34em;margin:0}
.gx-search{position:relative;margin:26px 0 0;max-width:560px}.gx-search input{width:100%;padding:14px 16px 14px 44px;font:16px var(--sans);background:var(--card);border:1px solid var(--line);border-radius:2px;color:var(--ink)}.gx-search input:focus{outline:none;border-color:var(--accent)}.gx-search svg{position:absolute;left:15px;top:50%;transform:translateY(-50%);width:18px;height:18px;stroke:var(--muted)}
.gx h2{display:flex;align-items:baseline;justify-content:space-between;gap:16px;flex-wrap:wrap}.gx h2 small{font:12px var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.gx-start{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.gx-start a{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);padding:22px 22px 24px;text-decoration:none;color:var(--ink);transition:border-color .2s}.gx-start a:hover{border-color:var(--accent)}
.gx-start .num{font:400 3.2em/1 var(--serif);color:var(--accent)}.gx-start .k{font:11px var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--muted);margin:22px 0 6px}.gx-start strong{font:500 1.5em/1.15 var(--serif)}
.gx-know{display:grid;grid-template-columns:1fr 1fr;gap:0 40px;margin:0;padding:0;list-style:none}.gx-know li{border-top:1px solid var(--line)}.gx-know a{display:block;padding:14px 0 15px;text-decoration:none;color:var(--ink)}.gx-know a:hover strong{color:var(--accent)}.gx-know strong{font:500 1.2em/1.25 var(--serif);display:block}.gx-know span{font:14px/1.5 var(--sans);color:var(--muted);display:block;margin-top:3px}.gx-know .data strong:before{content:"Monthly data";display:block;font:11px var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--accent);margin-bottom:4px}
.gx-chips{display:flex;flex-wrap:wrap;gap:6px 8px;margin:0 0 8px}.gx-chips a{font:12px var(--sans);letter-spacing:.08em;text-decoration:none;color:var(--ink);border:1px solid var(--line);padding:6px 12px;border-radius:999px;background:var(--card);white-space:nowrap}.gx-chips a:hover{border-color:var(--accent);color:var(--accent)}
.gh{padding:26px 0 8px;scroll-margin-top:12px}.ghh{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}.ghh h3{margin:0;font-size:1.65em}.ghh a{font:12px var(--sans);letter-spacing:.1em;text-transform:uppercase;text-decoration:none}
.gts{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}.gt{text-decoration:none;color:var(--ink);display:block}.gt .bottle{border:1px solid var(--line);transition:border-color .2s}.gt:hover .bottle{border-color:var(--accent)}.gt span{display:block;font:500 1.08em/1.2 var(--serif);margin-top:8px}.gt:hover span{color:var(--accent)}
.gx-cmp{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}.gc{display:block;text-decoration:none;color:var(--ink);background:var(--card);border:1px solid var(--line)}.gc:hover{border-color:var(--accent)}.gcb{display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--line)}.gcb .bottle+.bottle{border-left:1px solid var(--line)}.gcn{display:block;font:500 1.3em/1.2 var(--serif);padding:12px 14px 0}.gcn i{font-style:italic;color:var(--accent)}.gcs{display:block;font:14px/1.45 var(--sans);color:var(--muted);padding:4px 14px 14px}
.gx-none{display:none;padding:20px 0;color:var(--muted)}.gx.searching .gx-hide{display:none}.gx [hidden]{display:none!important}
@media(max-width:900px){.gts{grid-template-columns:repeat(4,1fr)}.gx-cmp{grid-template-columns:1fr 1fr}}
@media(max-width:760px){.gx-start{grid-template-columns:1fr;gap:10px}.gx-start a{min-height:0;padding:16px 18px 18px;display:grid;grid-template-columns:auto 1fr;gap:0 16px;align-items:start}.gx-start .num{font-size:2.2em;grid-row:span 2;margin:0}.gx-start .k{margin:2px 0 4px}.gx-start strong{font-size:1.25em}
.gx-know{grid-template-columns:1fr}.gx-chips{flex-wrap:nowrap;overflow-x:auto;margin:0 -16px 4px;padding:0 16px 6px;scrollbar-width:none}.gx-chips::-webkit-scrollbar{display:none}
.gx-know span{display:none}.gx-know a{padding:12px 0}.gts{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:16px;margin:0 -16px;padding:0 16px 6px;scrollbar-width:none}.gts::-webkit-scrollbar{display:none}.gt{flex:0 0 36%;scroll-snap-align:start}.gt span{font-size:.98em}.gx.searching .gts{display:grid;grid-template-columns:repeat(3,1fr);overflow:visible;margin:0;padding:0}.ghh h3{font-size:1.45em}.gh{padding-top:20px}.gx-cmp{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-padding-inline:16px;margin:0 -16px;padding:0 16px 6px;scrollbar-width:none}.gx-cmp::-webkit-scrollbar{display:none}.gc{flex:0 0 72%;scroll-snap-align:start}.gx.searching .gx-cmp{display:grid;grid-template-columns:1fr;margin:0;padding:0}.gx h2 small{display:none}}
</style>`;
  const js=`<script>(function(){var i=document.getElementById('gx-q'),r=document.querySelector('.gx'),n=document.querySelector('.gx-none');if(!i)return;
function f(){var v=i.value.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').toLowerCase().trim(),t=v.split(/\\s+/);r.classList.toggle('searching',!!v);var any=0;
r.querySelectorAll('[data-q]').forEach(function(e){var ok=!v||t.every(function(w){return e.getAttribute('data-q').indexOf(w)>-1});e.hidden=!ok;});
r.querySelectorAll('[data-group]').forEach(function(g){var vis=!v||g.querySelector('.gt:not([hidden]),.gc:not([hidden])');if(v&&!vis){var h=g.querySelector('.ghh a[data-q]');vis=h&&!h.hidden;if(vis)g.querySelectorAll('.gt').forEach(function(e){e.hidden=false})}g.hidden=!vis;if(vis)any++;});
n.style.display=v&&!any?'block':'none';}
i.addEventListener('input',f);if(i.value)f();})();</script>`;
  const body=`${css}<div class="gx">
<div class="gx-hero"><p class="eyebrow">The guides</p><h1>Read this before you spray.</h1><p class="lede">Short, opinionated answers on what deserves a full bottle and how to sample it first. Start with the basics, or find the bottle you keep circling.</p>
<label class="gx-search"><svg viewBox="0 0 24 24" fill="none" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><span class="sr" style="position:absolute;left:-9999px">Search the guides</span><input id="gx-q" type="search" placeholder="Search a scent or a house" autocomplete="off"></label></div>
<div class="gx-hide"><h2>Start here</h2><div class="gx-start">${START.map(([s,k],i)=>`<a href="${link(s)}"><span class="num">0${i+1}</span><span class="k">${esc(k)}</span><strong>${esc(by[s].title)}</strong></a>`).join('')}</div>
<h2>Good to know</h2><ul class="gx-know">${[...KNOW,...extra.map(g=>g.slug)].map(s=>`<li${s.includes('price-index')?' class="data"':''}><a href="${link(s)}"><strong>${esc(by[s].title)}</strong><span>${esc(by[s].desc)}</span></a></li>`).join('')}</ul></div>
<h2 id="verdicts">Is it worth it? <small>${nV} bottles, ${nH} houses</small></h2>
<nav class="gx-chips gx-hide" aria-label="Jump to a house">${names.map(h=>`<a href="#${id(h)}">${esc(h)}</a>`).join('')}</nav>
${houses}
${cmp?`<section data-group><h2>Head to head</h2><div class="gx-cmp">${cmp}</div></section>`:''}
<p class="gx-none">Nothing by that name yet. Try the house, or browse <a href="${BASE}/scents/">all scents</a>.</p>
</div>${js}`;
  write('guides/index.html',page({title:`Fragrance guides: is it worth it, and how to sample first | ${cfg.brand}`,desc:`${nV} worth-it verdicts across ${nH} luxury houses, plus how to test a fragrance, which sample size to buy and what it really costs per ml.`,path:'/guides/',body}));
}
// ---- machine-readable
urls.unshift('/','/scents/','/find/','/newsletter/',...letters.map(l=>`/scents/letter/${l==='#'?'0':l.toLowerCase()}/`),...scents.map(s=>`/scents/${s.slug}/`));
write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`<url><loc>${cfg.domain+BASE+u}</loc></url>`).join('')}</urlset>`);
write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${cfg.domain+BASE}/sitemap.xml\n`);
write('llms.txt',`# ${cfg.brand}\n> ${cfg.tagline}\n\n## Scents\n${sorted.map(s=>`- [${s.name}](${cfg.domain+BASE}/scents/${s.slug}/): ${s.verdictLine||s.house||''}`).join('\n')}\n`);
write('data/stats.json',JSON.stringify({title:`${cfg.brand} fragrance price dataset: summary`,url:cfg.domain+BASE+'/methodology/',fragrances:DATA.scents,houses:DATA.houses,retailers_and_brand_sites:DATA.retailers,sample_retailers:DATA.sampleRetailers,dated_prices:DATA.pricePoints,full_bottle_prices:DATA.bottlePoints,sample_prices:DATA.samplePoints,fragrances_with_sample_price:DATA.withSample,fragrances_with_bottle_price:DATA.withBottle,fragrances_with_notes:DATA.withNotes,median_lowest_sample_usd:DATA.medianSample,median_lowest_sample_ml:DATA.medianSampleMl,median_sample_pct_of_bottle:DATA.medianSamplePct,first_checked:DATA.firstChecked,price_history_rows:HIST.length,price_history_since:HIST.length?HIST.map(r=>r.date_checked).sort()[0]:null,listings_with_price_change:Object.values(histMoves).reduce((a,l)=>a+l.length,0),display_currency:'USD',non_usd_prices_hidden:scents.reduce((a,s)=>a+[...arr(s.full_bottle_offers),...arr(s.sample_offers)].filter(o=>o&&o.price>0&&!isUSD(o)).length,0),last_checked:DATA.lastChecked,house_counts:Object.fromEntries(DATA.houseList),retailer_counts:Object.fromEntries(DATA.retailerList.map(r=>[r.name,r.n]))},null,1));
try{ write('data/price-history.csv',fs.readFileSync(process.env.HISTORY||'/mnt/project-files/library/history/prices.csv')); }catch{}
write('data/scents.json',JSON.stringify(scents.map(({allNotes,...r})=>r)));
console.log(`built ${scents.length} scents${usingSample?' (sample data)':''} -> ${out}`);
// ---- AEO layer (schema, og tags, llms.txt, robots, sitemap lastmod, methodology page, price-index data)
execFileSync('python3', [new URL('./aeo/apply_aeo.py', import.meta.url).pathname, out], { stdio: 'inherit' });
