#!/usr/bin/env python3
"""Idempotent AEO post-processor for the generated Blind Buy Guide site.
Usage: python3 apply_aeo.py /path/to/repo   (re-run after every generator build)
Head/JSON-LD changes plus new files only: methodology page, robots, sitemap, llms.txt, data/price-index.*"""
import json, re, sys, glob, os, csv, html
R = sys.argv[1].rstrip('/')
B = 'https://www.blindbuyguide.com'
ORG = {"@type": "Organization", "@id": B + "/#org", "name": "Blind Buy Guide", "url": B + "/",
       "description": "An independent luxury and niche fragrance publication that tracks sample and full-bottle prices per ml and says whether to blind buy or sample first.",
       "publishingPrinciples": B + "/editorial-policy/"}
SITE = {"@type": "WebSite", "@id": B + "/#site", "name": "Blind Buy Guide", "url": B + "/", "publisher": {"@id": B + "/#org"}}
DEFIMG = B + "/price-book/cover.jpg"
LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)
def rd(p): return open(p, encoding='utf-8').read()
def wr(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True); open(p, 'w', encoding='utf-8').write(s)
def ld(o): return '<script type="application/ld+json">' + json.dumps(o, ensure_ascii=False, separators=(',', ':')) + '</script>'

data = json.load(open(R + '/data/scents.json'))
def summarize(s):
    ins = [o for o in s['full_bottle_offers'] if o.get('in_stock') and o.get('price_per_ml') and str(o.get('currency') or '').upper() == 'USD']
    best = min(ins, key=lambda o: o['price_per_ml']) if ins else None
    sm = [o for o in s['sample_offers'] if o.get('price') and o.get('size_ml') and o.get('in_stock') is not False and str(o.get('currency') or '').upper() == 'USD']
    low = min(sm, key=lambda o: o['price']) if sm else None
    dates = [o['date_checked'] for o in s['full_bottle_offers'] + s['sample_offers'] if o.get('date_checked')]
    return best, low, (max(dates) if dates else None)
info = {s['slug']: (s,) + summarize(s) for s in data}
try: ST = json.load(open(R + '/data/stats.json'))
except Exception: ST = None
def n0(x): return f'{x:,}'
LATEST = max(v[3] for v in info.values() if v[3])

# 1. data files
rows = []
for slug, (s, best, low, d) in info.items():
    rows.append({"slug": slug, "name": s['name'], "house": s['house'], "url": f"{B}/scents/{slug}/",
        "lowest_sample_usd": low['price'] if low else None, "lowest_sample_ml": low['size_ml'] if low else None,
        "lowest_sample_retailer": low['retailer'] if low else None,
        "best_in_stock_bottle_usd_per_ml": best['price_per_ml'] if best else None,
        "best_bottle_price_usd": best['price'] if best else None, "best_bottle_ml": best['size_ml'] if best else None,
        "best_bottle_retailer": best['retailer'] if best else None, "date_checked": d})
rows.sort(key=lambda r: r['name'].lower())
json.dump({"title": "Blind Buy Guide price index", "source": B + "/price-book/", "date_checked": LATEST, "currency": "USD",
           "note": "Prices are as shown on retailer pages on date_checked and change often. best_in_stock_bottle is the lowest price per ml among full bottles marked in stock.",
           "items": rows}, open(R + '/data/price-index.json', 'w'), indent=1, ensure_ascii=False)
with open(R + '/data/price-index.csv', 'w', newline='') as f:
    w = csv.DictWriter(f, fieldnames=list(rows[0])); w.writeheader(); w.writerows(rows)

# 2. per-page head + JSON-LD
def page_kind(rel):
    return rel.split('/')[0] if '/' in rel else 'root'
n = 0
for p in glob.glob(R + '/**/index.html', recursive=True) + [R + '/index.html']:
    rel = os.path.relpath(p, R).replace('\\', '/')
    h = rd(p); o = h
    kind = page_kind(rel)
    url = B + '/' + rel[:-len('index.html')]
    slug = rel.split('/')[1] if kind == 'scents' and rel.count('/') == 2 else None
    img = f"{B}/images/studio/{slug}.webp" if slug in info else DEFIMG
    if 'og:site_name' not in h:
        t = 'article' if kind in ('guides', 'compare') and rel.count('/') == 2 else 'website'
        h = h.replace('<meta property="og:type" content="website">', f'<meta property="og:type" content="{t}">', 1)
        alt = html.escape(info[slug][0]['name']) if slug in info else 'Blind Buy Guide'
        extra = (f'<meta property="og:site_name" content="Blind Buy Guide"><meta property="og:image" content="{img}">'
                 f'<meta property="og:image:alt" content="{alt}"><meta name="twitter:card" content="summary_large_image">'
                 f'<meta name="twitter:image" content="{img}">')
        h = re.sub(r'(<meta property="og:url" content="[^"]*">)', r'\1' + extra, h, count=1)
    def fix(m):
        try: j = json.loads(m.group(1))
        except Exception: return m.group(0)
        t = j.get('@type')
        if t == 'WebSite' and kind == 'root' and rel == 'index.html':
            return ld({"@context": "https://schema.org", "@graph": [ORG, SITE]})
        if t == 'Article':
            j.setdefault('author', {"@id": B + "/#org"}); j.setdefault('publisher', {"@id": B + "/#org"})
            j.setdefault('mainEntityOfPage', url); j.setdefault('image', img); j.setdefault('inLanguage', 'en-US')
            return ld(j)
        if t == 'Product' and slug in info:
            j['@id'] = url + '#product'; j['url'] = url; j.setdefault('image', img)
            return ld(j)
        return m.group(0)
    if kind != 'root' or rel == 'index.html':
        h = LD.sub(fix, h)
    # freshness / page node
    if slug in info and '"@type":"WebPage"' not in h and info[slug][3]:
        s, best, low, d = info[slug]
        wp = {"@context": "https://schema.org", "@type": "WebPage", "@id": url, "url": url, "name": s['name'] + ' sample and price per ml',
              "dateModified": d, "inLanguage": "en-US", "isPartOf": {"@id": B + "/#site"}, "publisher": {"@id": B + "/#org"},
              **({"about": {"@id": url + "#product"}} if '"@type":"Product"' in h else {})}
        h = h.replace('</head>', ld(wp) + '</head>', 1)
    if rel == 'price-book/index.html' and '"@type":"Dataset"' not in h:
        ds = {"@context": "https://schema.org", "@type": "Dataset", "name": "Blind Buy Guide price index: luxury fragrance sample and bottle prices per ml",
              "description": f"Lowest sample price and best in-stock full-bottle price per ml for {len(rows)} niche and designer fragrances, with retailer and date checked. Prices are in USD and change often.",
              "url": B + "/price-book/", "dateModified": LATEST, "creator": {"@id": B + "/#org"}, "publisher": {"@id": B + "/#org"},
              "isAccessibleForFree": True, "inLanguage": "en-US", "measurementTechnique": "Prices read from public retailer product pages on the date shown; see methodology.",
              "isBasedOn": B + "/methodology/", "keywords": ["fragrance prices", "perfume price per ml", "perfume samples", "niche fragrance"],
              **({"temporalCoverage": f"{ST['first_checked']}/{ST['last_checked']}", "variableMeasured": ["lowest sample price (USD)", "sample size (ml)", "full-bottle price (USD)", "full-bottle price per ml (USD)", "retailer", "in-stock status", "date checked"]} if ST else {}),
              "distribution": [{"@type": "DataDownload", "encodingFormat": "text/csv", "contentUrl": B + "/data/price-index.csv"},
                               {"@type": "DataDownload", "encodingFormat": "application/json", "contentUrl": B + "/data/price-index.json"},
                               {"@type": "DataDownload", "encodingFormat": "application/pdf", "contentUrl": B + "/price-book/blind-buy-guide-price-book.pdf"}]}
        h = h.replace('</head>', ld(ds) + '</head>', 1)
    if h != o: wr(p, h); n += 1
print('pages changed', n)

# 3. methodology page (built from the editorial-policy shell)
ep = rd(R + '/editorial-policy/index.html')
head = ep[:ep.index('<main>')]; foot = ep[ep.index('</main>'):]
head = re.sub(r'<title>.*?</title>', '<title>How we track fragrance prices: methodology | Blind Buy Guide</title>', head)
desc = 'How Blind Buy Guide collects sample and bottle prices, calculates price per ml, dates every price and keeps the Price Book current. Includes how to cite the data.'
head = re.sub(r'(<meta name="description" content=")[^"]*', r'\g<1>' + desc, head)
head = head.replace(B + '/editorial-policy/', B + '/methodology/').replace('Editorial policy', 'Methodology')
head = re.sub(r'(og:title" content=")[^"]*', r'\g<1>How we track fragrance prices: methodology | Blind Buy Guide', head)
head = re.sub(r'(og:description" content=")[^"]*', r'\g<1>' + desc, head)
faq = [("How does Blind Buy Guide calculate price per ml?", "Price per ml is the listed price divided by the bottle or sample size in milliliters, for example $360 for 70 ml is $5.14 per ml. We show it for every size we track so a 2 ml sample and a 100 ml bottle can be compared on the same footing."),
       ("How often are the prices updated?", "Every price on a scent page carries the date it was checked. We refresh the price library and publish a new edition of the Price Book each month, so a price older than that should be treated as out of date."),
       ("Does Blind Buy Guide test the fragrances?", "No. We do not claim to have smelled or worn anything. Notes and accords come from published brand and retailer information, the analysis is price and sampling math, and the site is written with AI tools, as explained on the how we use AI page."),
       ("Which retailers do the prices come from?", "Full-bottle prices come from the retailer pages we link on each scent page, with authorized luxury retailers such as Bergdorf Goodman and Neiman Marcus preferred where they carry the fragrance. Sample prices come from decant and sample retailers, which are independent resellers rather than the brands themselves."),
       ("Can I cite or reuse the Blind Buy Guide price data?", "Yes. Cite it as Blind Buy Guide, Price Book, with the edition date and the link https://www.blindbuyguide.com/price-book/. The same figures are available as CSV and JSON.")]
mi = f'''<main><div class="prose"><h1>How we track fragrance prices</h1>
<p class="verdict"><strong>Short version:</strong> every price on Blind Buy Guide was read from a public retailer page on the date shown next to it. Price per ml is price divided by milliliters. The library covers {len(rows)} fragrances and was last refreshed {LATEST}.</p>
''' + (f'''<h2>The dataset at a glance</h2>
<table><tbody>
<tr><td>Fragrances tracked</td><td>{n0(ST['fragrances'])}</td></tr>
<tr><td>Luxury and niche houses</td><td>{n0(ST['houses'])}</td></tr>
<tr><td>Retailers and brand boutiques read</td><td>{n0(ST['retailers_and_brand_sites'])}, including {n0(ST['sample_retailers'])} sample and decant shops</td></tr>
<tr><td>Dated prices on file</td><td>{n0(ST['dated_prices'])} ({n0(ST['full_bottle_prices'])} full bottle, {n0(ST['sample_prices'])} sample)</td></tr>
<tr><td>Fragrances with a sample price</td><td>{n0(ST['fragrances_with_sample_price'])}</td></tr>
<tr><td>Fragrances with a bottle price shown</td><td>{n0(ST['fragrances_with_bottle_price'])}</td></tr>
<tr><td>Fragrances with published notes</td><td>{n0(ST['fragrances_with_notes'])}</td></tr>
<tr><td>Prices checked</td><td>{ST['first_checked']} to {ST['last_checked']}</td></tr>
</tbody></table>
<p class="muted" style="font-size:15px">These figures are recalculated from the library every time the site is built, so they move as we add scents and recheck prices. Machine-readable summary: <a href="/data/stats.json">stats.json</a>.</p>
<p><strong>Houses covered:</strong> {html.escape(', '.join(f"{h} ({c})" for h, c in ST['house_counts'].items()))}.</p>
<p><strong>Most-read retailers:</strong> {html.escape(', '.join(list(ST['retailer_counts'])[:14]))}, and {max(0, len(ST['retailer_counts']) - 14)} more.</p>
''' if ST else '') + f'''<h2>What we measure</h2>
<p><strong>Lowest sample.</strong> The lowest total price for a decant or sample of the fragrance among the sample retailers we track, with the size and retailer named.</p>
<p><strong>Best bottle.</strong> The lowest price per ml among full bottles we saw marked in stock. Sold-out listings stay visible for context but never set the best bottle.</p>
<p><strong>Price per ml.</strong> Listed price divided by size in ml, rounded to the cent. Prices are in US dollars and exclude tax and shipping.</p>
<p><strong>Currency.</strong> We only show prices listed in US dollars. When a retailer lists a fragrance in pounds, euros or another currency, or the page does not say, that price stays in our records but is never shown or compared as a dollar price, so a UK store never sets the best price.{(" Right now " + n0(ST["non_usd_prices_hidden"]) + " such prices are held back.") if ST and ST.get("non_usd_prices_hidden") else ""}</p>
<h2>Where the numbers come from</h2>
<p>Retailer product pages: authorized luxury retailers for full bottles where available, plus decant and sample retailers for samples. Each scent page links the exact page we read. Notes, accords, house and concentration come from published brand and retailer information.</p>
<h2>How fresh it is</h2>
<p>Every price shows its check date. We also keep every past observation, so when a retailer changes the price of the same listing, the old and new price both stay on record with their dates. Price history starts {(ST.get("price_history_since") if ST else None) or "November 2026"} and is published as <a href="/data/price-history.csv">price-history.csv</a>. Stock status is recorded when a retailer page shows it, and sold-out bottles never set the best price, but stock moves faster than any library, so check the retailer before you count on it. We refresh the library and publish a new Price Book edition monthly. Prices move, and a number we published can be wrong by the time you read it, which is why the date is always beside it.</p>
<h2>What we do not do</h2>
<p>We do not claim to have smelled or worn any fragrance, and we do not accept payment for verdicts. Some links are affiliate links, as described in our <a href="/affiliate-disclosure/">affiliate disclosure</a> and <a href="/editorial-policy/">editorial policy</a>. The site is written with AI tools, explained on <a href="/how-we-use-ai/">how we use AI</a>.</p>
<h2>Download and cite the data</h2>
<p>The <a href="/price-book/">Price Book</a> is free. The same figures are available as <a href="/data/price-index.csv">CSV</a> and <a href="/data/price-index.json">JSON</a>. To cite: <em>Blind Buy Guide, Price Book, {LATEST} edition, https://www.blindbuyguide.com/price-book/</em>.</p>
<h2>Frequently asked questions</h2>
''' + ''.join(f'<h3>{html.escape(q)}</h3><p>{html.escape(a)}</p>\n' for q, a in faq) + '</div></main>'
page_ld = ld({"@context": "https://schema.org", "@graph": [
    {"@type": "AboutPage", "@id": B + "/methodology/", "url": B + "/methodology/", "name": "How we track fragrance prices", "dateModified": LATEST,
     "isPartOf": {"@id": B + "/#site"}, "publisher": {"@id": B + "/#org"}},
    {"@type": "FAQPage", "mainEntity": [{"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq]}]})
head = re.sub(r'<script type="application/ld\+json">.*?</script>', '', head, flags=re.S).replace('</head>', page_ld + '</head>')
wr(R + '/methodology/index.html', head + mi + foot)

# internal links to methodology from the two trust pages (one line each, idempotent)
for rel, anchor in (('price-book/index.html', '<p><a class="btn" href="/price-book/blind-buy-guide-price-book.pdf">Download the PDF</a></p>'),):
    p = R + '/' + rel; h = rd(p)
    if '/methodology/' not in h and anchor in h:
        h = h.replace(anchor, anchor + '<p class="muted" style="font-size:15px">How these prices are collected and dated: <a href="/methodology/">methodology</a>. Data as <a href="/data/price-index.csv">CSV</a> or <a href="/data/price-index.json">JSON</a>.</p>', 1); wr(p, h)
p = R + '/editorial-policy/index.html'; h = rd(p)
if '/methodology/' not in h:
    h = h.replace('<p><strong>Corrections.</strong>', '<p><strong>Methodology.</strong> How we collect, date and calculate prices is on the <a href="/methodology/">methodology page</a>.</p>\n<p><strong>Corrections.</strong>', 1); wr(p, h)

# 4. robots
bots = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "Claude-User", "PerplexityBot", "Perplexity-User",
        "Google-Extended", "Applebot-Extended", "Applebot", "Bingbot", "Googlebot", "CCBot", "Meta-ExternalAgent", "Amazonbot", "DuckAssistBot", "MistralAI-User"]
wr(R + '/robots.txt', '# AI answer engines and search crawlers are welcome. Cite us.\n' +
   ''.join(f'User-agent: {b}\nAllow: /\n\n' for b in bots) + f'User-agent: *\nAllow: /\n\nSitemap: {B}/sitemap.xml\n')

# 5. sitemap with lastmod
sm = rd(R + '/sitemap.xml')
if '/methodology/' not in sm:
    sm = sm.replace('</urlset>', f'<url><loc>{B}/methodology/</loc></url></urlset>')
def lm(m):
    loc = m.group(1); path = loc[len(B):]
    d = LATEST
    pf = R + path + 'index.html'
    if os.path.exists(pf):
        mm = re.search(r'"dateModified":"(\d{4}-\d\d-\d\d)"', rd(pf))
        if mm: d = mm.group(1)
    return f'<url><loc>{loc}</loc><lastmod>{d}</lastmod></url>'
sm = re.sub(r'<url><loc>([^<]*)</loc>(?:<lastmod>[^<]*</lastmod>)?</url>', lm, sm)
wr(R + '/sitemap.xml', sm)

# 6. llms.txt
def meta(rel):
    h = rd(f'{R}/{rel}/index.html')
    t = re.search(r'<title>(.*?) \| Blind Buy Guide</title>', h); d = re.search(r'<meta name="description" content="([^"]*)"', h)
    return html.unescape(t.group(1)) if t else rel, html.unescape(d.group(1)) if d else ''
L = ['# Blind Buy Guide', '',
 '> Independent luxury and niche fragrance guide. For each of ' + str(len(rows)) + ' scents we publish the lowest sample price, the best in-stock bottle price per ml, notes, and a verdict on whether to blind buy or sample first. Prices are dated and refreshed monthly. We do not claim to have smelled or worn anything; see the methodology.', '',
 '## Key facts and data', f'- [Price Book (free, monthly)]({B}/price-book/): lowest sample price and best in-stock bottle price per ml for {len(rows)} fragrances, last refreshed {LATEST}.',
 f'- [Methodology]({B}/methodology/): how prices are collected, dated and calculated, and how to cite them.',
 *([f"- Dataset size: {n0(ST['dated_prices'])} dated prices from {ST['retailers_and_brand_sites']} retailers and brand sites across {ST['fragrances']} fragrances and {ST['houses']} houses, checked {ST['first_checked']} to {ST['last_checked']}. Summary: {B}/data/stats.json"] if ST else []),
 f'- [Price index as CSV]({B}/data/price-index.csv) and [as JSON]({B}/data/price-index.json): the same figures, machine readable.',
 f'- [Editorial policy]({B}/editorial-policy/), [How we use AI]({B}/how-we-use-ai/), [Affiliate disclosure]({B}/affiliate-disclosure/)',
 '', '## Citing us', f'Cite price figures as "Blind Buy Guide, Price Book, {LATEST} edition" with the scent page URL. Always state the date checked, because prices change.', '']
for sect, d in (('Guides', 'guides'), ('Head-to-head comparisons', 'compare')):
    L.append('## ' + sect)
    for pth in sorted(glob.glob(f'{R}/{d}/*/index.html')):
        s = pth.split('/')[-2]; t, ds = meta(f'{d}/{s}'); L.append(f'- [{t}]({B}/{d}/{s}/): {ds}')
    L.append('')
L.append('## Scents (one page each: notes, sample prices, bottle price per ml, verdict)')
for r in rows:
    bits = []
    if r['lowest_sample_usd'] is not None: bits.append(f"lowest sample ${r['lowest_sample_usd']:.2f}" + (f" for {r['lowest_sample_ml']:g} ml" if r['lowest_sample_ml'] else ""))
    if r['best_in_stock_bottle_usd_per_ml'] is not None: bits.append(f"best in-stock bottle ${r['best_in_stock_bottle_usd_per_ml']:.2f}/ml")
    L.append(f"- [{r['name']}]({r['url']}): {r['house']}" + (f"; {', '.join(bits)} (checked {r['date_checked']})" if bits else ''))
wr(R + '/llms.txt', '\n'.join(L) + '\n')
print('done; latest', LATEST)
