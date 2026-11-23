#!/usr/bin/env python3
"""Outbound click counting on the free Vercel Web Analytics plan.

Rewrites every sponsored shop link (except Amazon, whose agreement restricts
redirects) to a static page /go/<shop>/<page>/<id>/ that loads the analytics
script and then forwards to the shop. Each click is then a page view, so Vercel
can count clicks per shop (startswith(requestPath,'/go/<shop>/')) and per page.

Idempotent: links already pointing at /go/ are left alone, and go pages are
rewritten from the current link target on every run.

Usage: python3 go_links.py <built site dir>
"""
import hashlib, html, os, re, sys
from urllib.parse import urlsplit, parse_qs, unquote

ROOT = sys.argv[1] if len(sys.argv) > 1 else '.'
SKIP_HOSTS = ('amazon.',)  # Amazon: direct links only
NAMES = {'fragrancesline': 'Fragrances Line', 'microperfumes': 'MicroPerfumes', 'scentsplit': 'Scent Split',
         'perfumania': 'Perfumania', 'luckyscent': 'Luckyscent', 'bluemercury': 'Bluemercury',
         'neimanmarcus': 'Neiman Marcus', 'bergdorfgoodman': 'Bergdorf Goodman', 'saksfifthavenue': 'Saks Fifth Avenue',
         'nordstrom': 'Nordstrom', 'sephora': 'Sephora', 'libertylondon': 'Liberty London', 'venbafragrance': 'Venba',
         'tomfordbeauty': 'Tom Ford', 'nichebeauty': 'Niche Beauty', 'harrods': 'Harrods', 'dillards': "Dillard's"}
A_TAG = re.compile(r'<a\b[^>]*>', re.I)
HREF = re.compile(r'href="([^"]+)"')


def merchant_url(u):
    """The shop URL behind an affiliate network wrapper, for naming only."""
    p = urlsplit(u)
    if 'linksynergy.com' in p.netloc:
        m = parse_qs(p.query).get('murl')
        if m:
            return unquote(m[0])
    if '/type/dlg/' in u:  # CJ deep link
        return u.split('/type/dlg/', 1)[1]
    return u


def shop_key(u):
    host = urlsplit(merchant_url(u)).netloc.lower()
    host = re.sub(r'^(www|us|shop)\.', '', host)
    return re.sub(r'[^a-z0-9]+', '', host.split('.')[0]) or 'shop'


def link_id(u):
    # Hash of the shop URL without query, so adding a tracking code later
    # (rfsn, ref, tag) keeps the same /go/ path and the counts stay comparable.
    base = merchant_url(u).split('?')[0].split('#')[0].rstrip('/')
    return hashlib.sha1(base.encode()).hexdigest()[:8]


def page_key(rel_path):
    parts = [p for p in rel_path.replace('\\', '/').split('/') if p and p != 'index.html']
    if not parts:
        return 'home'
    key = parts[-1] if parts[0] in ('scents', 'guides', 'compare') else '-'.join(parts)
    return re.sub(r'[^a-z0-9-]+', '-', key.lower()).strip('-')[:80] or 'page'


GO_PAGE = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Taking you to {shop}</title>
<script>window.va=window.va||function(){{(window.vaq=window.vaq||[]).push(arguments)}};</script>
<script defer src="/_vercel/insights/script.js"></script>
<script>setTimeout(function(){{location.replace({target_js})}},600);</script>
<noscript><meta http-equiv="refresh" content="0;url={target_attr}"></noscript>
<style>body{{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f6f2ea;color:#17140f;font:16px/1.5 Georgia,serif;padding:16px;text-align:center}}a{{color:#7a5b2e}}</style>
</head><body><p>Taking you to {shop}&hellip;<br><a rel="sponsored nofollow noopener" href="{target_attr}">Continue</a></p></body></html>
'''


def main():
    pages = {}
    changed_files = 0
    for dirpath, dirnames, files in os.walk(ROOT):
        rel_dir = os.path.relpath(dirpath, ROOT)
        top = rel_dir.split(os.sep)[0]
        if top in ('.git', 'go', 'site', 'tools', 'docs', 'reports', 'node_modules', '.github', '.claude'):
            dirnames[:] = []
            continue
        for f in files:
            if not f.endswith('.html'):
                continue
            path = os.path.join(dirpath, f)
            rel = os.path.relpath(path, ROOT)
            src = open(path, encoding='utf-8').read()
            pkey = page_key(rel)

            def fix(m):
                tag = m.group(0)
                if 'sponsored' not in tag:
                    return tag
                h = HREF.search(tag)
                if not h:
                    return tag
                raw = h.group(1)
                if raw.startswith('/go/'):
                    return tag
                url = html.unescape(raw)
                if not url.startswith('http') or any(s in urlsplit(url).netloc for s in SKIP_HOSTS):
                    return tag
                shop = shop_key(url)
                go = f'/go/{shop}/{pkey}/{link_id(url)}/'
                pages[go] = (shop, url)
                return tag.replace(h.group(0), f'href="{go}"')

            out = A_TAG.sub(fix, src)
            if out != src:
                open(path, 'w', encoding='utf-8').write(out)
                changed_files += 1
    # (Re)write go pages; keep existing ones whose links were rewritten on an earlier run.
    for dirpath, _, files in os.walk(os.path.join(ROOT, 'go')):
        if 'index.html' in files:
            go = '/' + os.path.relpath(dirpath, ROOT).replace(os.sep, '/') + '/'
            if go not in pages:
                t = re.search(r'location\.replace\(("(?:[^"\\]|\\.)*")\)', open(os.path.join(dirpath, 'index.html'), encoding='utf-8').read())
                if t:
                    import json
                    pages[go] = (go.split('/')[2], json.loads(t.group(1)))
    import json
    for go, (shop, url) in pages.items():
        d = os.path.join(ROOT, go.strip('/'))
        os.makedirs(d, exist_ok=True)
        open(os.path.join(d, 'index.html'), 'w', encoding='utf-8').write(
            GO_PAGE.format(shop=html.escape(NAMES.get(shop, shop.title())), target_js=json.dumps(url).replace('</', '<\\/'), target_attr=html.escape(url, quote=True)))
    # Keep crawlers out of /go/.
    rp = os.path.join(ROOT, 'robots.txt')
    if os.path.exists(rp):
        r = open(rp, encoding='utf-8').read()
        if 'Disallow: /go/' not in r:
            r = re.sub(r'(User-agent: \*\n)', r'\1Disallow: /go/\n', r, count=1)
            open(rp, 'w', encoding='utf-8').write(r)
    print(f'go_links: {changed_files} pages rewritten, {len(pages)} /go/ pages')


if __name__ == '__main__':
    main()
