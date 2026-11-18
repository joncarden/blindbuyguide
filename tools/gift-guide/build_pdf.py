#!/usr/bin/env python3
"""Build the printable gift guide (lead magnet).
Usage: python3 tools/gift-guide/build_pdf.py <content json> <out dir>
Reads data/scents.json and images/studio/ from the repo; writes gift-guide.html, then
tools/gift-guide/print.js turns it into the PDF. Prices: in-stock USD offers only, with dates."""
import json, sys, os, html, datetime, re
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
G = json.load(open(sys.argv[1])); OUT = sys.argv[2]; os.makedirs(OUT, exist_ok=True)
SN = json.load(open(os.path.join(os.path.dirname(__file__), 'snoop.json')))
S = {s['slug']: s for s in json.load(open(os.path.join(ROOT, 'data', 'scents.json')))}
e = html.escape
dates = []

def ok(o): return o.get('in_stock') and o.get('price') and o.get('size_ml') and str(o.get('currency') or '').upper() == 'USD'
def bottles(s):
    b = sorted([o for o in s['full_bottle_offers'] if ok(o)], key=lambda o: (o['size_ml'], o['price'])); seen = set(); r = []
    for o in b:
        if o['size_ml'] not in seen: seen.add(o['size_ml']); r.append(o)
    return r
def main(s):
    b = bottles(s); return next((o for o in b if 45 <= o['size_ml'] <= 80), b[0] if b else None)
def samples(s): return sorted([o for o in s['sample_offers'] if ok(o)], key=lambda o: o['price'])
def one_ml(s):
    sm = samples(s); return next((o for o in sm if o['size_ml'] <= 1.1), sm[0] if sm else None)
def money(n): return '$' + (f'{n:,.2f}' if n % 1 else f'{n:,.0f}')
def ml(n): return f'{round(n, 1):g} ml'
def rname(r):
    import re
    r = re.sub(r'\(.*?\)', ' ', r); r = re.sub(r'\s(US|UK)\b.*$', '', r); return ' '.join(r.split())
def short(n):
    import re
    return re.sub(r'\s+(Eau de (Parfum|Toilette)|Extrait de Parfum)$', '', re.sub(r"^(Tom Ford|Creed|Penhaligon's|Parfums de Marly)\s+", '', n))
def img(slug): return 'file://' + os.path.join(ROOT, 'images', 'studio', slug + '-sm.webp')
def house(h): return {'BYREDO': 'Byredo'}.get(h, re.sub(r'\s*\(.*?\)', '', h or ''))
def track(s):
    for o in s['full_bottle_offers'] + s['sample_offers']:
        if ok(o) and o.get('date_checked'): dates.append(o['date_checked'])
def fmt(d):
    x = datetime.date.fromisoformat(d); return x.strftime('%b ') + str(x.day) + x.strftime(', %Y')

pages = []
hero = [S[p['picks'][0][0]] for p in G['personas']][:6]
pages.append(f'''<section class="pg cover"><p class="brand">Blind Buy Guide</p><div class="ct"><p class="eb">The {G['year']} edition</p><h1>The Gift<br>Guide</h1><p class="sub">Twenty-one luxury fragrances worth giving, a snoop sheet for guessing right, and the sample trick that means you never guess wrong.</p></div>
<div class="strip">{''.join(f'<img src="{img(s["slug"])}">' for s in hero)}</div><p class="foot">blindbuyguide.com</p></section>''')

letters = {v[0]: k for k, v in SN['key'].items()}
pages.append(f'''<section class="pg"><p class="eb">How to use this guide</p><h2>Gifting fragrance without the gamble</h2>
<p class="lede">{e(G['answer'])}</p>
<ol class="rules">{''.join(f'<li><b>{e(h)}</b> {e(t.replace("Our printable version has a twelve-question snoop sheet for exactly this.", "The snoop sheet on page 3 is built for exactly this."))}</li>' for h, t in G['rules'])}</ol>
<div class="map"><p class="eb">Find your person</p><ol>{''.join(f'<li><span>{letters[p["id"]]}</span>{e(p["title"])} <i>p. {i+5}</i></li>' for i, p in enumerate(G['personas']))}</ol><p class="small">Not sure who they are? The snoop sheet on the next pages works it out in five minutes.</p></div></section>''')

# snoop sheet: two pages of six questions
qs = SN['questions']
for part in (qs[:6], qs[6:]):
    first = part is qs[:6] or part == qs[:6]
    pages.append(f'''<section class="pg snoop">{'<p class="eb">The snoop sheet</p><h2>Twelve questions you can answer without asking</h2><p class="small">Tick the closest answer to each, then count your letters. The letter you ticked most is your person; the runner-up is your backup page.</p>' if first else '<p class="eb">The snoop sheet, continued</p>'}
<div class="qs">{''.join(f'<div class="q"><h3><span>{qs.index(q)+1:02d}</span> {e(q[0])}</h3><ul>{"".join(f"<li><i></i>{e(a)} <b>{l}</b></li>" for a, l in q[1])}</ul></div>' for q in part)}</div>
{'' if first else '<div class="tally"><p class="eb">Your count</p><div>' + ''.join(f'<span><b>{k}</b>{e(v[1])}<i></i></span>' for k, v in SN['key'].items()) + '</div></div>'}</section>''')

n = 0; allp = []
for i, p in enumerate(G['personas']):
    cards = []
    for slug, blurb in p['picks']:
        s = S[slug]; n += 1; track(s); m = main(s); sm = samples(s); allp.append((s, m, n))
        b = bottles(s)
        price = ' · '.join(f'<b>{money(o["price"])}</b> {ml(o["size_ml"])}' for o in b)
        cards.append(f'''<div class="pick"><div class="ph"><img src="{img(slug)}"><span>{n:02d}</span></div><div class="pt"><p class="house">{e(house(s['house']))}</p><h3>{e(short(s['name']))}</h3><p class="bl">{e(blurb)}</p>
<p class="pr">{price} <span>at {e(rname(m['retailer']))}</span></p>{f'<p class="smp">Sample first: {money(sm[0]["price"])} for {ml(sm[0]["size_ml"])} at {e(rname(sm[0]["retailer"]))}</p>' if sm else ''}</div></div>''')
    pages.append(f'''<section class="pg persona"><p class="eb"><span class="lt">{letters[p['id']]}</span> {e(p['kicker'])}</p><h2>{e(p['title'])}</h2><p class="lede">{e(p['intro'])}</p><div class="picks">{''.join(cards)}</div></section>''')

fl = []
for f in G['flights']:
    items = [S[x] for x in f['slugs']]; one = [one_ml(s) for s in items]; [track(s) for s in items]
    tot = sum(o['price'] for o in one)
    fl.append(f'''<div class="flight"><h3>{e(f['title'])}</h3><p class="small">{e(f['for'])}</p><ol>{''.join(f'<li><img src="{img(s["slug"])}"><span>{e(short(s["name"]))}<i>{money(o["price"])} for {ml(o["size_ml"])}</i></span></li>' for s, o in zip(items, one))}</ol><p class="tot">Five samples, about <b>{money(round(tot, 2))}</b> before shipping</p></div>''')
pages.append(f'''<section class="pg"><p class="eb">Stocking stuffers</p><h2>The sample flight: the gift that can't miss</h2><p class="lede">Five 1 ml samples in a small box, plus the card at the back promising the full bottle once they've chosen. They test for a week; you buy the winner.</p><div class="flights">{''.join(fl)}</div>
<div class="how"><p class="eb">Wrap it like you meant it</p><ol><li>Order the five samples by the first week of December.</li><li>Number them 1 to 5 and put them in a small box with tissue.</li><li>Add the "one full bottle" card from the back of this guide.</li><li>Tell them to wear one a day, morning and evening, before deciding.</li></ol></div></section>''')

tiers = [('Under $250', 0, 250), ('$250 to $400', 250, 400.01), ('$400 and up', 400.01, 1e9)]
rows = ''
for label, lo, hi in tiers:
    r = sorted([x for x in allp if x[1] and lo <= x[1]['price'] < hi], key=lambda x: x[1]['price'])
    if r: rows += f'<tr class="tier"><th colspan="4">{label}</th></tr>' + ''.join(f'<tr><td><b>{e(short(s["name"]))}</b> <span>{e(house(s["house"]))}</span></td><td>{money(m["price"])}</td><td>{ml(m["size_ml"])}</td><td>{e(rname(m["retailer"]))}</td></tr>' for s, m, _ in r)
def ql(lst): return ''.join(f'<li>{e(short(S[x]["name"]))} <span>{money(main(S[x])["price"])}</span></li>' for x in lst)
pages.append(f'''<section class="pg"><p class="eb">The cheat sheet</p><h2>Every bottle, by price</h2><table>{rows}</table>
<div class="quick"><div><h3>For him</h3><ol>{ql(G['forHim'])}</ol></div><div><h3>For her</h3><ol>{ql(G['forHer'])}</ol></div></div></section>''')

card = '''<div class="iou"><p class="brand">Blind Buy Guide</p><p class="eb">A promise, in writing</p><h3>Good for one full bottle<br>of the fragrance of your choice</h3><p>Test the samples. Wear each one for a day. Pick the one you can't stop thinking about, and it's yours.</p><div class="lines"><span>For</span><span>From</span><span>Valid until</span></div></div>'''
pages.append(f'''<section class="pg ious"><p class="eb">Cut along the line</p>{card}<div class="cut"></div>{card}</section>''')

dates.sort()
pages.append(f'''<section class="pg back"><div><p class="eb">One more thing</p><h2>Before you buy anything for yourself</h2><p class="lede">Every week the Blind Buy Guide newsletter does the math on one luxury fragrance: what it costs per ml, where it's in stock, and how to sample it before you commit. Free, with opinions.</p><p class="url">blindbuyguide.com</p></div>
<p class="fine">Prices are in-stock US prices from authorized retailers and sample shops, checked {fmt(dates[0])} to {fmt(dates[-1])}. Prices change; check the retailer before you buy. We never smell or handle the bottles we cover: notes come from the houses' published lists and character lines summarize them. Some links on blindbuyguide.com earn us a commission at no cost to you. Fragrance has no gender; "for him" and "for her" are shortcuts, not rules.</p></section>''')

CSS = open(os.path.join(os.path.dirname(__file__), 'pdf.css')).read()
open(os.path.join(OUT, 'gift-guide.html'), 'w').write(f'<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet"><style>{CSS}</style></head><body>{"".join(pages)}</body></html>')
print('pages', len(pages), 'picks', n, 'dates', dates[0], dates[-1])
