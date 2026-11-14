"""Studio compositor: puts every bottle on one shared backdrop so the grid reads as one shoot.
Input: tools/studio/cutouts.json  {slug: {cutout, source, retailer, source_page, name, house}}
       an entry with no "cutout" becomes a typographic card on the same backdrop.
Output: images/studio/<slug>.webp (1200x1500) + <slug>-sm.webp (600x750),
        tools/studio/contact-before.jpg and contact-after.jpg for review."""
import json, os, io, sys, textwrap, urllib.request
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps
W, H = 1200, 1500
TOP, BOT = (245, 240, 232), (233, 225, 211)
BOTTLE_H, MAX_W, FLOOR = 880, 760, 1250
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'images', 'studio'); os.makedirs(OUT, exist_ok=True)
UA = {'User-Agent': 'Mozilla/5.0 (compatible; studio-compositor)'}

def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
        return Image.open(io.BytesIO(r.read()))

def backdrop():
    g = Image.new('RGB', (1, H))
    for y in range(H):
        t = y / (H - 1)
        g.putpixel((0, y), tuple(round(TOP[i] + (BOT[i] - TOP[i]) * t) for i in range(3)))
    bg = g.resize((W, H))
    glow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(glow).ellipse((W*0.15, H*0.12, W*0.85, H*0.78), fill=60)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    bg = Image.composite(Image.new('RGB', (W, H), (250, 247, 241)), bg, glow)
    return bg

def font(path, size, var=None):
    try:
        f = ImageFont.truetype(path, size)
        if var:
            try: f.set_variation_by_name(var)
            except Exception: pass
        return f
    except Exception:
        return ImageFont.load_default(size)

def bottle_card(cut):
    cut = cut.convert('RGBA')
    a = cut.split()[3].point(lambda v: 255 if v > 12 else 0)
    box = a.getbbox()
    if not box: raise ValueError('empty cutout')
    cut = cut.crop(box)
    s = min(BOTTLE_H / cut.height, MAX_W / cut.width)
    cut = cut.resize((max(1, round(cut.width * s)), max(1, round(cut.height * s))), Image.LANCZOS)
    bg = backdrop().convert('RGBA')
    x, y = (W - cut.width) // 2, FLOOR - cut.height
    sh = Image.new('L', (W, H), 0); d = ImageDraw.Draw(sh)
    sw = cut.width * 0.95
    d.ellipse((W/2 - sw/2, FLOOR - 26, W/2 + sw/2, FLOOR + 30), fill=70)
    sh = sh.filter(ImageFilter.GaussianBlur(26))
    c2 = Image.new('L', (W, H), 0); d2 = ImageDraw.Draw(c2)
    d2.ellipse((W/2 - sw*0.42, FLOOR - 8, W/2 + sw*0.42, FLOOR + 10), fill=110)
    c2 = c2.filter(ImageFilter.GaussianBlur(7))
    shadow = Image.new('RGBA', (W, H), (60, 45, 30, 0))
    shadow.putalpha(Image.eval(Image.merge('L', [sh]), lambda v: v))
    bg = Image.alpha_composite(bg, shadow)
    shadow2 = Image.new('RGBA', (W, H), (40, 30, 20, 0)); shadow2.putalpha(c2)
    bg = Image.alpha_composite(bg, shadow2)
    bg.alpha_composite(cut, (x, y))
    return bg.convert('RGB')

def text_card(name, house, serif, sans):
    bg = backdrop(); d = ImageDraw.Draw(bg)
    ink, muted, accent = (23, 20, 15), (107, 98, 89), (122, 91, 46)
    hs = ' '.join(house.upper())
    hf = font(sans, 30)
    tw = d.textlength(hs, font=hf); d.text(((W - tw) / 2, 470), hs, font=hf, fill=accent)
    nf = font(serif, 118, 'Medium')
    lines = textwrap.wrap(name, 16)[:3]
    y = 560
    for ln in lines:
        tw = d.textlength(ln, font=nf); d.text(((W - tw) / 2, y), ln, font=nf, fill=ink); y += 132
    d.line((W/2 - 60, y + 40, W/2 + 60, y + 40), fill=accent, width=2)
    sf = font(sans, 24); t = 'BOTTLE PHOTO COMING'
    t = ' '.join(t); tw = d.textlength(t, font=sf); d.text(((W - tw) / 2, y + 80), t, font=sf, fill=muted)
    return bg

def sheet(items, path, label):
    cols, tw, th = 4, 300, 375
    rows = (len(items) + cols - 1) // cols
    s = Image.new('RGB', (cols * tw, rows * (th + 30) + 40), (255, 255, 255)); d = ImageDraw.Draw(s)
    d.text((10, 10), label, fill=(0, 0, 0))
    for i, (slug, im) in enumerate(items):
        x, y = (i % cols) * tw, 40 + (i // cols) * (th + 30)
        if im is not None:
            t = ImageOps.contain(im.convert('RGB'), (tw - 10, th - 10)); s.paste(t, (x + (tw - t.width)//2, y + (th - t.height)//2))
        d.text((x + 6, y + th + 6), slug[:40], fill=(0, 0, 0))
    s.save(path, quality=85)

def main():
    here = os.path.dirname(os.path.abspath(__file__))
    data = json.load(open(os.path.join(here, 'cutouts.json')))
    serif = os.path.join(here, 'serif.ttf'); sans = os.path.join(here, 'sans.ttf')
    before, after, report = [], [], {}
    for slug, e in data.items():
        src = None
        try:
            if e.get('source'): src = get(e['source'])
        except Exception as ex: report.setdefault(slug, []).append(f'source: {ex}')
        try:
            card = bottle_card(get(e['cutout'])) if e.get('cutout') else text_card(e.get('name', slug), e.get('house', ''), serif, sans)
        except Exception as ex:
            report.setdefault(slug, []).append(f'compose: {ex}')
            card = text_card(e.get('name', slug), e.get('house', ''), serif, sans)
        card.save(os.path.join(OUT, slug + '.webp'), quality=84, method=6)
        card.resize((600, 750), Image.LANCZOS).save(os.path.join(OUT, slug + '-sm.webp'), quality=82, method=6)
        before.append((slug, src)); after.append((slug, card))
    sheet(before, os.path.join(here, 'contact-before.jpg'), 'BEFORE: source images as found')
    sheet(after, os.path.join(here, 'contact-after.jpg'), 'AFTER: studio composite')
    json.dump(report, open(os.path.join(here, 'report.json'), 'w'), indent=1)
    print('done', len(data), 'problems', report)

if __name__ == '__main__': main()
