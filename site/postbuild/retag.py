#!/usr/bin/env python3
"""One-step affiliate retag: add a tracking parameter to every link to one shop.

Example (Fragrances Line via Refersion, link looks like ...?rfsn=1234567.abc123):
  python3 site/postbuild/retag.py --host fragrancesline.com --param rfsn --value 1234567.abc123 \
      --config site/config.json --config /mnt/project-files/site/config.json --site .

It (1) sets the rule in each config's affiliate.rules so future builds tag the
links, and (2) rewrites the already-built HTML in --site: direct shop links and
the targets inside /go/ redirect pages. JSON-LD offer URLs are left untouched.
Run it again with a new value to change the code; --dry-run shows counts only.
"""
import argparse, html, json, os, re
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

ap = argparse.ArgumentParser()
ap.add_argument('--host', required=True)
ap.add_argument('--param', required=True)
ap.add_argument('--value', required=True)
ap.add_argument('--name', default=None)
ap.add_argument('--config', action='append', default=[])
ap.add_argument('--site', default='.')
ap.add_argument('--dry-run', action='store_true')
a = ap.parse_args()


def tag(url):
    p = urlsplit(url)
    if not p.netloc.lower().endswith(a.host):
        return url
    q = [(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True) if k != a.param]
    q.append((a.param, a.value))
    return urlunsplit((p.scheme, p.netloc, p.path, urlencode(q), p.fragment))


for c in a.config:
    if not os.path.exists(c):
        print('skip missing config', c); continue
    cfg = json.load(open(c, encoding='utf-8'))
    rules = cfg.setdefault('affiliate', {}).setdefault('rules', [])
    r = next((r for r in rules if r.get('match') == a.host), None)
    if not r:
        r = {'name': a.name or a.host, 'match': a.host, 'param': a.param, 'value': ''}
        rules.append(r)
    r['param'], r['value'] = a.param, a.value
    if not a.dry_run:
        with open(c, 'w', encoding='utf-8') as f:
            json.dump(cfg, f, indent=2, ensure_ascii=False); f.write('\n')
    print('config', c, '->', r)

HOST_RE = re.escape(a.host)
HREF = re.compile(r'href="(https?://(?:[a-z0-9-]+\.)*' + HOST_RE + r'[^"]*)"', re.I)
JS = re.compile(r'location\.replace\(("https?://(?:[a-z0-9-]+\.)*' + HOST_RE + r'(?:[^"\\]|\\.)*")\)', re.I)
REFRESH = re.compile(r'(content="0;url=)(https?://(?:[a-z0-9-]+\.)*' + HOST_RE + r'[^"]*)"', re.I)
files = links = 0
skip = {'.git', 'site', 'tools', 'docs', 'reports', 'node_modules', '.github', '.claude'}
for dp, dn, fs in os.walk(a.site):
    if os.path.relpath(dp, a.site).split(os.sep)[0] in skip:
        dn[:] = []; continue
    for f in fs:
        if not f.endswith('.html'):
            continue
        p = os.path.join(dp, f); s = open(p, encoding='utf-8').read(); n = [0]

        def h(m):
            n[0] += 1; return 'href="' + html.escape(tag(html.unescape(m.group(1))), quote=True) + '"'

        def j(m):
            n[0] += 1; return 'location.replace(' + json.dumps(tag(json.loads(m.group(1)))).replace('</', '<\\/') + ')'

        def r(m):
            n[0] += 1; return m.group(1) + html.escape(tag(html.unescape(m.group(2))), quote=True) + '"'

        o = REFRESH.sub(r, JS.sub(j, HREF.sub(h, s)))
        if o != s:
            files += 1; links += n[0]
            if not a.dry_run:
                open(p, 'w', encoding='utf-8').write(o)
print(f'retag {a.host}: {links} links in {files} files' + (' (dry run)' if a.dry_run else ''))
