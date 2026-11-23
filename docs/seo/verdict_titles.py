"""Verdict-first title tag, meta description and first sentence for 'Is X worth it?' guides.
Usage: python3 verdict_titles.py <guides_dir> <verdicts.tsv> [overrides.json]
Rewrites the md files in place: adds seo_title, replaces description, prepends a verdict sentence
to answer (and to the identical first body line). Idempotent: skips files that already have seo_title."""
import json, re, sys, pathlib

gdir, tsv = pathlib.Path(sys.argv[1]), sys.argv[2]
over = json.load(open(sys.argv[3])) if len(sys.argv) > 3 else {}
BRAND = ' | Blind Buy Guide'
V = {}
for line in open(tsv, encoding='utf8'):
    if line.strip():
        slug, short, like, pas = line.rstrip('\n').split('\t')
        V[slug] = (short, like, pas)

def q(s): return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'
def fmval(src, key):
    m = re.search(r'^' + key + r': "((?:[^"\\]|\\.)*)"$', src, re.M)
    return m.group(1).replace('\\"', '"') if m else None

def title_for(short, like):
    for t in (f'Is {short} worth it? Yes, if you love {like}',
              f'{short} worth it? Yes, if you love {like}',
              f'{short}: worth it if you love {like}',
              f'Is {short} worth it? Sample first'):
        if len(t) <= 60: return t
    return f'{short}: sample first'

LIB = pathlib.Path(sys.argv[4]) if len(sys.argv) > 4 else None
MP = json.load(open(sys.argv[5])).get('items', {}) if len(sys.argv) > 5 else {}
def money(x): return '$' + (f'{x:,.0f}' if x == int(x) else f'{x:,.2f}')
def price_bit(slug):
    f = LIB / f'{slug}.json' if LIB else None
    if not f or not f.exists(): return ''
    d = json.load(open(f)); days = []
    smp = [(o['price'], o.get('date_checked')) for o in d.get('sample_offers', []) if o.get('in_stock') is True and o.get('currency', 'USD') == 'USD' and o.get('price')]
    mp = MP.get(slug)
    if mp: smp += [(z['price'], mp.get('checked')) for z in mp.get('sizes', []) if z.get('ml', 99) <= 10]
    btl = [(o['price'], o.get('size_ml'), o.get('date_checked')) for o in d.get('full_bottle_offers', []) if o.get('in_stock') is not False and o.get('currency', 'USD') == 'USD' and o.get('price')]
    out = []
    if smp:
        p = min(smp, key=lambda x: x[0]); out.append(f'Samples from {money(p[0])}'); days.append(p[1])
    if btl:
        b = min(btl, key=lambda x: x[0]); out.append(f'bottles from {money(b[0])}' if out else f'Bottles from {money(b[0])}'); days.append(b[2])
    if not out: return ''
    days = sorted(x for x in days if x)
    import datetime
    when = datetime.date.fromisoformat(days[-1]).strftime('%b %-d') if days else ''
    return '; '.join(out) + (f', checked {when}.' if when else '.')

report = []
for f in sorted(gdir.glob('is-*-worth-it.md')):
    slug = f.name[3:-12]
    src = f.read_text(encoding='utf8')
    if re.search(r'^seo_title:', src, re.M): report.append((slug, 'skip (done)')); continue
    ans = fmval(src, 'answer')
    if slug in over:
        o = over[slug]; seo, desc, lead = o['seo_title'], o['description'], o['lead']
        rest = ans
    elif slug in V and ans:
        short, like, pas = V[slug]
        seo = title_for(short, like)
        lead = f'Safe blind buy? Only if you already love {like}; sample first if {pas}.'
        rest = re.sub(r'^(Sample it first|Buy it)[^:]*:\s*', '', ans); rest = rest[0].upper() + rest[1:]
        desc = f'Our verdict: yes if you love {like}; sample first if {pas}.'
        pb = price_bit(slug)
        if pb and len(desc) + 1 + len(pb) <= 160: desc += ' ' + pb
        elif pb and len(desc) + 1 + len(pb.split(', checked')[0]) + 1 <= 160: desc += ' ' + pb.split(', checked')[0] + '.'
    else:
        report.append((slug, 'NO DATA')); continue
    new_ans = lead + ' ' + rest
    tt = seo + BRAND if len(seo + BRAND) <= 60 else seo
    old_desc = fmval(src, 'description')
    src2 = src.replace('answer: ' + q(ans), 'answer: ' + q(new_ans), 1)
    src2 = src2.replace('description: ' + q(old_desc), 'description: ' + q(desc.strip()), 1)
    src2 = re.sub(r'^(title: .*)$', lambda m: m.group(1) + '\nseo_title: ' + q(seo), src2, count=1, flags=re.M)
    # first body line repeats the old answer: swap it for the new one
    head, sep, body = src2.partition('\n---\n')[0], '\n---\n', src2.partition('\n---\n')[2]
    if body.startswith(ans): body = new_ans + body[len(ans):]
    elif body.lstrip('\n').startswith(ans): body = body.replace(ans, new_ans, 1)
    else:
        b2 = body.lstrip('\n'); body = body[:len(body)-len(b2)] + lead + ' ' + b2
        report.append((slug, 'lead prepended to body'))
    f.write_text(head + sep + body, encoding='utf8')
    report.append((slug, f'{len(tt):>2} {tt} || {len(desc.strip())} {desc.strip()}'))
for r in report: print(*r, sep='\t')
