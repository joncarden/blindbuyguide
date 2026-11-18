"""Build partners/microperfumes-offers.json: MicroPerfumes sample sizes for scents in the library.

Usage: python3 build_microperfumes.py <scents.json> <dir with products.json pages> [out]
Fetch pages first (sandbox allows microperfumes.com):
  for p in 1..10: curl "https://www.microperfumes.com/products.json?limit=250&page=$p" -o p$p.json
Only sample formats are kept (Sample Vial, Sample Spray, Travel Spray, Travel Spray XL), in stock only.
Matching is exact on normalized house + name + concentration family; anything ambiguous is left out.
Hand overrides live in microperfumes-map.json ({"slug": "base handle" or null to exclude}).
"""
import json, re, sys, glob, os, unicodedata, datetime

FORMATS = ('Sample Vial', 'Sample Spray', 'Travel Spray', 'Travel Spray XL')
HOUSE_ALIAS = {
    'tom ford private blend': 'tom ford', 'by kilian': 'kilian', 'kilian paris': 'kilian',
    'initio parfums prives': 'initio', 'initio parfums': 'initio', 'initio': 'initio',
    'editions de parfums frederic malle': 'frederic malle', 'maison margiela replica': 'maison margiela',
    'roja parfums': 'roja', 'roja dove': 'roja', 'penhaligons': 'penhaligons',
    'parfums de marly': 'parfums de marly', 'maison francis kurkdjian': 'maison francis kurkdjian',
}
CONC_WORDS = r'\b(eau de parfum|eau de toilette|eau de cologne|extrait de parfum|extrait|edp|edt|edc|parfum|cologne|intense)\b'


def plain(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    s = s.replace('&', ' and ').replace("'", '').replace('’', '')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def house_key(h):
    h = plain(re.sub(r'\(.*?\)', lambda m: ' ' + m.group(0)[1:-1], h or ''))
    return HOUSE_ALIAS.get(h, h)


def conc_family(text):
    t = plain(text)
    if re.search(r'\b(extrait|parfum)\b', t) and not re.search(r'\b(eau de parfum|edp)\b', t):
        return 'extrait'
    if re.search(r'\b(eau de toilette|edt)\b', t):
        return 'edt'
    if re.search(r'\b(eau de parfum|edp)\b', t):
        return 'edp'
    if re.search(r'\b(cologne|edc)\b', t):
        return 'cologne'
    return None


def name_key(n, house=None):
    n = plain(n)
    if house:
        n = re.sub(r'^' + re.escape(plain(house)) + r' ', '', n)
    n = re.sub(r'^(maison margiela |xj )', '', n)
    n = re.sub(r'([a-z]) (\d+)$', r'\1\2', n)  # "torino 21" == "torino21"
    n = re.sub(r'\b(intense)\b', ' INT ', n)  # keep "intense" flankers distinct
    # strip concentration words only at the end, so "Aventus Cologne" stays distinct from "Aventus"
    n = re.sub(r'(\s(eau de parfum|eau de toilette|extrait de parfum|extrait|edp|edt|edc|parfum))+$', '', ' ' + n).strip()
    n = re.sub(r'\b(by kilian|kilian|tom ford|replica)\b', ' ', n)
    return re.sub(r'\s+', ' ', n).strip()


def ml_of(variant_title):
    m = re.search(r'([\d.]+)\s*ml', variant_title)
    return float(m.group(1)) if m else None


def main():
    scents = json.load(open(sys.argv[1]))
    pages = sorted(glob.glob(os.path.join(sys.argv[2], 'p*.json')))
    out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(os.path.dirname(__file__), 'microperfumes-offers.json')
    here = os.path.dirname(os.path.abspath(__file__))
    try:
        overrides = json.load(open(os.path.join(here, 'microperfumes-map.json')))
    except FileNotFoundError:
        overrides = {}
    products = [p for f in pages for p in json.load(open(f))['products']]
    groups = {}  # (house, name, conc) -> list of (base, format, product)
    for p in products:
        if ' - ' not in p['title']:
            continue
        base, fmt = p['title'].rsplit(' - ', 1)
        if fmt not in FORMATS:
            continue
        key = (house_key(p['vendor']), name_key(base, p['vendor']), conc_family(base) or conc_family(p.get('product_type', '')))
        groups.setdefault(key, []).append((base, fmt, p))
    items, unmatched = {}, []
    for s in scents:
        slug = s['slug']
        if slug in overrides and overrides[slug] is None:
            continue
        conc = conc_family(s.get('concentration') or '') or conc_family(s.get('name', ''))
        k = (house_key(s.get('house')), name_key(s.get('name'), s.get('house')))
        hits = [g for g in groups if g[:2] == k and (conc is None or g[2] is None or g[2] == conc
                                                    or {g[2], conc} == {'extrait', 'edp'} and False)]
        if slug in overrides:
            hits = [g for g in groups if any(pr['handle'].startswith(overrides[slug]) for _, _, pr in groups[g])]
        if len(hits) != 1:
            unmatched.append((slug, s.get('house'), s.get('name'), len(hits)))
            continue
        sizes = []
        for base, fmt, p in groups[hits[0]]:
            v = p['variants'][0]
            if not v.get('available'):
                continue
            ml = ml_of(v['title'])
            if not ml:
                continue
            sizes.append({'format': fmt, 'ml': ml, 'price': float(v['price']),
                          'url': 'https://www.microperfumes.com/products/' + p['handle']})
        if sizes:
            items[slug] = {'title': groups[hits[0]][0][0], 'sizes': sorted(sizes, key=lambda z: z['ml'])}
    json.dump({'retailer': 'MicroPerfumes', 'checked': datetime.date.today().isoformat(),
               'source': 'https://www.microperfumes.com/products.json', 'items': items},
              open(out, 'w'), indent=1, ensure_ascii=False)
    print(f'{len(items)} scents matched with in-stock sample sizes; {len(unmatched)} not matched')
    for u in unmatched:
        print('  no match:', *u, sep=' | ')


if __name__ == '__main__':
    main()
