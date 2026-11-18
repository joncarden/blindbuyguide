// Holiday fragrance gift guide: /gift-guide/ (+ /gift-guide/thanks/). Editorial copy lives in
// <CONTENT>/gift-guide/<year>.json; every price, size, retailer and date comes from the library on each build.
import fs from 'fs';

const nm=n=>String(n||'').replace(/^(Tom Ford|Creed|Penhaligon's|Parfums de Marly)\s+/,'').replace(/\s+(Eau de (Parfum|Toilette)|Extrait de Parfum)$/,'');
const houseName=h=>h==='BYREDO'?'Byredo':String(h||'').replace(/\s*\(.*?\)/g,'');
export function giftGuide(x){
  const {bySlug,bottle,page,write,esc,aff,money,fmtDate,BASE,cfg,urls,nlForm,retailerName,contentDir}=x;
  const dir=contentDir+'gift-guide/'; if(!fs.existsSync(dir)) return 0;
  const files=fs.readdirSync(dir).filter(f=>/^\d{4}\.json$/.test(f)).sort(); if(!files.length) return 0;
  const G=JSON.parse(fs.readFileSync(dir+files[files.length-1],'utf8'));
  const P='/gift-guide/', pdf=`${BASE}/gift-guide/blind-buy-guide-gift-guide-${G.year}.pdf`;
  const S=slug=>{ const s=bySlug[slug]; if(!s) console.warn('gift guide: missing scent',slug); return s; };
  const bottles=s=>[...s.prices].sort((a,b)=>a.size_ml-b.size_ml||a.price-b.price).filter((o,i,l)=>i===l.findIndex(p=>p.size_ml===o.size_ml));
  const main=s=>{ const b=bottles(s); return b.find(o=>o.size_ml>=45&&o.size_ml<=80)||b[0]; };
  const sizeTxt=ml=>`${Math.round(ml*10)/10} ml`;
  const dates=[]; const seen=s=>{ for(const o of [...s.prices,...s.samples]) if(o.checked) dates.push(o.checked); };
  let n=0; const all=[];
  const pick=([slug,blurb])=>{ const s=S(slug); if(!s) return ''; n++; seen(s); const b=bottles(s), m=main(s), sm=s.cheapestSample; all.push({s,m,n});
    const num=String(n).padStart(2,'0');
    return `<article class="gg-pick" id="${esc(slug)}"><a class="gg-img" href="${BASE}/scents/${esc(slug)}/" aria-label="${esc(s.name)}">${bottle(s,'')}<span class="gg-n">${num}</span></a>
<div class="gg-t"><p class="gg-house">${esc(houseName(s.house))}</p><h3><a href="${BASE}/scents/${esc(slug)}/">${esc(nm(s.name))}</a></h3>
<p class="gg-blurb">${esc(blurb)}</p>
${m?`<p class="gg-price"><b>${b.map(o=>`${money(o.price)}</b> <span>${sizeTxt(o.size_ml)}</span>`).join(' · <b>')} <span class="muted">at ${esc(retailerName(m.retailer))}</span></p>
<p class="gg-acts"><a class="btn" rel="sponsored nofollow noopener" href="${esc(aff(m.url))}">Shop at ${esc(retailerName(m.retailer))}</a>${sm?`<a class="btn ghost" rel="sponsored nofollow noopener" href="${esc(aff(sm.url))}">Sample: ${money(sm.price)} / ${sm.size_ml} ml</a>`:''}</p>`:''}
</div></article>`; };

  const personas=G.personas.map(p=>`<section class="gg-sec" id="${esc(p.id)}"><p class="eyebrow">${esc(p.kicker)}</p><h2>${esc(p.title)}</h2><p class="gg-intro">${esc(p.intro)}</p><div class="gg-picks">${p.picks.map(pick).join('')}</div></section>`).join('');

  const flights=G.flights.map(f=>{ const items=f.slugs.map(S).filter(s=>s&&s.cheapestSample); const one=items.map(s=>s.samples.filter(o=>o.size_ml<=1.1).sort((a,b)=>a.price-b.price)[0]||s.cheapestSample);
    const tot=one.reduce((a,o)=>a+o.price,0); items.forEach(seen);
    return `<div class="gg-flight"><h3>${esc(f.title)}</h3><p class="muted">${esc(f.for)}</p><ol>${items.map((s,i)=>`<li><a href="${BASE}/scents/${esc(s.slug)}/">${esc(nm(s.name))}</a><span><a rel="sponsored nofollow noopener" href="${esc(aff(one[i].url))}">${money(one[i].price)}</a> · ${one[i].size_ml} ml</span></li>`).join('')}</ol><p class="gg-tot">Five samples, about <b>${money(Math.round(tot*100)/100)}</b> before shipping</p></div>`; }).join('');

  const tiers=[['Under $250',0,250],['$250 to $400',250,400.01],['$400 and up',400.01,1e9]];
  const byPrice=tiers.map(([label,lo,hi])=>{ const rows=all.filter(r=>r.m&&r.m.price>=lo&&r.m.price<hi).sort((a,b)=>a.m.price-b.m.price); if(!rows.length) return '';
    return `<tr class="gg-tier"><th colspan="4">${label}</th></tr>${rows.map(r=>`<tr><td><a href="#${esc(r.s.slug)}">${esc(nm(r.s.name))}</a><br><span class="muted">${esc(houseName(r.s.house))}</span></td><td>${money(r.m.price)}</td><td>${sizeTxt(r.m.size_ml)}</td><td>${esc(retailerName(r.m.retailer))}</td></tr>`).join('')}`; }).join('');

  const quick=(list,label)=>`<div class="gg-quick"><h3>${label}</h3><ol>${list.map(S).filter(Boolean).map(s=>{ const m=main(s); return `<li><a href="#${esc(s.slug)}">${esc(nm(s.name))}</a>${m?` <span class="muted">${money(m.price)}, ${sizeTxt(m.size_ml)}</span>`:''}</li>`; }).join('')}</ol></div>`;

  dates.sort(); const d0=dates[0], d1=dates[dates.length-1];
  const asOf=d0===d1?fmtDate(d1):`${fmtDate(d0)} to ${fmtDate(d1)}`;
  const giftForm=cfg.giftFormId||'';
  const lead=(where)=>`<aside class="gg-lead" id="${where}"><div class="gg-cover" aria-hidden="true"><span>${esc(cfg.brand)}</span><b>The Gift Guide</b><i>${G.year}</i></div><div><p class="eyebrow" style="margin:0">Free printable</p><h2>Take the whole guide shopping.</h2><p>The PDF version adds a <b>twelve-question snoop sheet</b> for working out someone's taste without asking, the three <b>sample flights</b> with prices, and a printable <b>"one full bottle of your choice"</b> card to put under the tree with the samples.</p>${giftForm?nlForm('Send me the guide',giftForm):`<p><a class="btn" href="${pdf}">Download the PDF</a></p>`}${giftForm?`<p class="gg-subdl muted">Already on the list? <a href="${pdf}">Download it here</a>.</p>`:''}</div></aside>`;

  const toc=[...G.personas.map(p=>[p.id,p.title.replace(/^The /,'')]),['samples','Sample flights'],['by-price','By price'],['him-her','For him, for her'],['faq','Questions']];
  const hero=G.personas.map(p=>S(p.picks[0][0])).filter(Boolean).slice(0,6);
  const body=`<div class="gg">
<header class="gg-hero"><p class="eyebrow">Gift guide · ${G.year}</p><h1>${esc(G.h1)}</h1><p class="lede">${esc(G.dek)}</p><p class="gg-stamp">Prices checked ${esc(asOf)} at authorized retailers · <a href="${BASE}/methodology/">How we track prices</a></p>
<div class="gg-strip" aria-hidden="true">${hero.map(s=>bottle(s,'')).join('')}</div></header>
<p class="verdict"><strong>Short answer:</strong> ${esc(G.answer)}</p>
<nav class="gg-toc" aria-label="In this guide">${toc.map(([id,l])=>`<a href="#${esc(id)}">${esc(l)}</a>`).join('')}</nav>
<section class="gg-sec gg-rules"><p class="eyebrow">Before you buy</p><h2>Five rules for gifting fragrance</h2><ol>${G.rules.map(([h,t])=>`<li><b>${esc(h)}</b> ${esc(t)}</li>`).join('')}</ol></section>
${lead('get-the-pdf')}
${personas}
<section class="gg-sec" id="samples"><p class="eyebrow">Stocking stuffers</p><h2>The sample flight: the gift that can't miss</h2><p class="gg-intro">Five 1 ml samples, about ten sprays each, in a small box with a card that says the full bottle is on you once they've chosen. They test for a week; you buy the winner. It's how people with expensive taste shop for themselves anyway.</p><div class="gg-flights">${flights}</div><p class="muted" style="font-size:15px">Sample prices are for 1 ml where the shop sells it and come from the same dated checks as the bottles. Bigger 2 ml and 5 ml sizes are on each scent's page.</p></section>
<section class="gg-sec" id="by-price"><p class="eyebrow">Shop by price</p><h2>Every bottle in this guide, by price</h2><div class="tablewrap"><table class="gg-table"><thead><tr><th>Fragrance</th><th>Price</th><th>Size</th><th>Retailer</th></tr></thead><tbody>${byPrice}</tbody></table></div><p class="muted" style="font-size:15px">In-stock US prices as checked ${esc(asOf)}. Prices move; the button on each pick goes to the live listing.</p></section>
<section class="gg-sec" id="him-her"><p class="eyebrow">The short lists</p><h2>Best fragrance gifts for him, and for her</h2><p class="gg-intro">Fragrance has no gender, but search bars do. If you came here for a list, here it is, from the picks above.</p><div class="gg-quicks">${quick(G.forHim,'Fragrance gifts for him')}${quick(G.forHer,'Fragrance gifts for her')}</div></section>
<section class="gg-sec prose" id="faq"><p class="eyebrow">Questions</p><h2>Gifting fragrance, answered</h2>${G.faq.map(([q,a])=>`<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}</section>
${lead('get-the-pdf-2').replace('Take the whole guide shopping.','Print it, circle things, leave it somewhere obvious.')}
<p class="muted gg-disc">We never smell or handle the bottles we cover; notes come from the houses' published lists and character lines summarize those notes. Some links earn us a commission at no cost to you. <a href="${BASE}/affiliate-disclosure/">Affiliate disclosure</a>.</p>
</div>`;

  const items=all.map(r=>({"@type":"ListItem",position:r.n,url:cfg.domain+BASE+`/scents/${r.s.slug}/`,name:r.s.name}));
  const ld=[
    {"@context":"https://schema.org","@type":"Article",headline:G.title,description:G.dek,datePublished:G.published,dateModified:d1||G.published,author:{"@type":"Organization",name:cfg.brand},publisher:{"@type":"Organization",name:cfg.brand}},
    {"@context":"https://schema.org","@type":"ItemList",name:`${cfg.brand} fragrance gift guide ${G.year}`,itemListOrder:"https://schema.org/ItemListUnordered",numberOfItems:items.length,itemListElement:items},
    {"@context":"https://schema.org","@type":"FAQPage",mainEntity:G.faq.map(([q,a])=>({"@type":"Question",name:q,acceptedAnswer:{"@type":"Answer",text:a}}))},
    {"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Guides",item:cfg.domain+BASE+'/guides/'},{"@type":"ListItem",position:2,name:"Gift guide"}]}];
  write('gift-guide/index.html',page({title:`${G.title}: ${all.length} bottles worth giving | ${cfg.brand}`,desc:`${all.length} luxury fragrance gifts sorted by who you're shopping for, with prices checked ${asOf}, sample sets that can't miss, and how to pick a scent for someone else.`,path:P,ld,body:`<style>${CSS}</style>${body}`}));
  write('gift-guide/thanks/index.html',page({title:`Your gift guide | ${cfg.brand}`,desc:'Download the printable fragrance gift guide.',path:P+'thanks/',body:`<style>${CSS}</style><div class="gg prose" style="text-align:center;padding:2em 0"><p class="eyebrow">You're on the list</p><h1>Here's your gift guide.</h1><p class="lede">Print it, circle things, leave it somewhere obvious.</p><p><a class="btn" href="${pdf}">Download the PDF</a></p><p class="muted">The Price Book is on its way to your inbox too. <a href="${BASE}/gift-guide/">Back to the guide</a></p></div><script>try{localStorage.setItem('bbg_sub','1')}catch(e){}</script>`}));
  urls.push(P);
  return all.length;
}

const CSS=`.gg{max-width:1080px;margin:0 auto}
.gg .eyebrow{font:600 12px/1.2 var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
.gg-hero{text-align:center;padding:1.2em 0 .4em}.gg-hero h1{font-family:var(--serif);font-weight:500;font-size:clamp(40px,7vw,76px);line-height:1.02;margin:.15em auto .25em;max-width:12em;letter-spacing:-.01em;text-wrap:balance}
.gg-hero .lede{max-width:36em;margin:0 auto;font-size:19px;color:var(--muted)}.gg-stamp{font:13px/1.5 var(--sans);color:var(--muted);margin:1em 0 0}
.gg-strip{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin:1.6em 0 .6em}.gg-strip .bottle{margin:0;aspect-ratio:3/4;height:auto;width:100%}
.gg-toc{display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin:1.4em 0 .4em}.gg-toc a{font:13px/1 var(--sans);padding:9px 13px;border:1px solid var(--line);border-radius:99px;text-decoration:none;color:var(--ink);background:var(--card)}
.gg-sec{padding:2.4em 0 .6em;border-top:1px solid var(--line);margin-top:2em;scroll-margin-top:12px}.gg-sec>h2{font-family:var(--serif);font-weight:500;font-size:clamp(30px,4.6vw,46px);line-height:1.08;margin:.1em 0 .3em;border:0;padding:0}
.gg-intro{max-width:40em;color:var(--muted);margin:0 0 1.4em}
.gg-rules ol{counter-reset:r;list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:18px 28px;margin:1em 0 0}
.gg-rules li{counter-increment:r;position:relative;padding-top:2.4em}.gg-rules li:before{content:counter(r,decimal-leading-zero);position:absolute;top:0;left:0;font:500 34px/1 var(--serif);color:var(--accent)}.gg-rules li b{display:block;font-family:var(--serif);font-size:23px;font-weight:600;line-height:1.2;margin-bottom:.25em}
.gg-picks{display:grid;grid-template-columns:repeat(3,1fr);gap:26px}
.gg-pick{display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:4px;overflow:hidden;scroll-margin-top:12px}
.gg-img{position:relative;display:block}.gg-img .bottle{margin:0;width:100%;height:auto;aspect-ratio:4/5;border-radius:0}.gg-n{position:absolute;top:12px;left:14px;font:500 22px/1 var(--serif);color:var(--accent)}
.gg-t{padding:16px 18px 18px;display:flex;flex-direction:column;flex:1}.gg-house{font:600 11px/1.2 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);margin:0}
.gg-t h3{font-family:var(--serif);font-weight:600;font-size:27px;line-height:1.1;margin:.2em 0 .35em}.gg-t h3 a{color:var(--ink);text-decoration:none}
.gg-blurb{font-size:16.5px;line-height:1.55;margin:0 0 .8em;flex:1}.gg-price{font:15px/1.4 var(--sans);margin:0 0 .7em}.gg-price b{font-size:17px}
.gg-acts{display:flex;flex-wrap:wrap;gap:8px;margin:0}.gg .btn{display:inline-block;font:600 14px/1 var(--sans);padding:12px 14px;border-radius:3px;background:var(--ink);color:var(--bg);text-decoration:none}.gg .btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--ink)}
.gg-flights{display:grid;grid-template-columns:repeat(3,1fr);gap:22px}.gg-flight{background:var(--card);border:1px solid var(--line);border-radius:4px;padding:18px 20px}.gg-flight h3{font-family:var(--serif);font-size:26px;font-weight:600;margin:0}.gg-flight .muted{margin:.1em 0 .6em;font-size:15px}
.gg-flight ol{margin:0;padding-left:1.2em;font-size:16px}.gg-flight li{margin:.35em 0}.gg-flight li span{display:block;font:13px/1.4 var(--sans);color:var(--muted)}.gg-tot{font:14px/1.4 var(--sans);border-top:1px solid var(--line);padding-top:.7em;margin:.8em 0 0}
.gg-table{width:100%;border-collapse:collapse;font-size:16px}.gg-table td,.gg-table th{padding:9px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}.gg-tier th{font-family:var(--serif);font-size:22px;font-weight:600;padding-top:1em;border-bottom:2px solid var(--ink)}
.gg-quicks{display:grid;grid-template-columns:1fr 1fr;gap:26px}.gg-quick h3{font-family:var(--serif);font-size:26px;font-weight:600;margin:0 0 .3em}.gg-quick li{margin:.3em 0}
.gg-lead{display:grid;grid-template-columns:200px 1fr;gap:30px;align-items:center;background:var(--ink);color:var(--bg);padding:28px 30px;border-radius:4px;margin:2.4em 0}.gg-lead h2{font-family:var(--serif);font-weight:500;font-size:clamp(28px,4vw,38px);line-height:1.1;margin:.15em 0 .3em;border:0;padding:0;color:var(--bg)}.gg-lead p{margin:0 0 1em}.gg-lead .eyebrow{color:#d9c3a0}
.gg-lead .btn{background:var(--bg);color:var(--ink)}.gg-lead a{color:var(--bg)}.gg-lead .muted{color:#cfc6b8}.gg-subdl{font-size:14px;display:none}html.bbg-sub .gg-subdl{display:block}
.gg-cover{aspect-ratio:3/4;background:var(--bg);color:var(--ink);border-radius:2px;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:14px;box-shadow:0 10px 30px rgba(0,0,0,.35)}.gg-cover span{font:600 10px/1.2 var(--sans);letter-spacing:.18em;text-transform:uppercase;color:var(--accent)}.gg-cover b{font:500 34px/1 var(--serif);margin:.3em 0}.gg-cover i{font:italic 500 20px/1 var(--serif);color:var(--muted)}
.gg-disc{font-size:14px;margin:2em 0}
@media(max-width:860px){.gg-picks,.gg-flights{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.gg-strip{grid-template-columns:repeat(3,1fr)}.gg-strip .bottle:nth-child(n+4){display:none}.gg-picks,.gg-flights,.gg-quicks{grid-template-columns:1fr}.gg-img .bottle{aspect-ratio:1/1}.gg-lead{grid-template-columns:1fr;padding:22px 18px}.gg-cover{width:130px;margin:0 auto}.gg-table{font-size:14.5px}.gg-table td,.gg-table th{padding:8px 6px}.gg-t h3{font-size:25px}}`;
