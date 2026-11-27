# Comparison builder (2026-11-27): like content/tools/comp.py, but adds MicroPerfumes (Rakuten) sample sizes from
# site/partners/microperfumes-offers.json, a "smallest sample" row, and real check dates instead of a fixed date.
import json,sys,datetime
LIB,MP,OUT,PAIRS=sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4]
MPD=json.load(open(MP)).get('items',{})
def fmt(d):
    x=datetime.date.fromisoformat(d); return x.strftime('%b ')+str(x.day)+x.strftime(', %Y')
def load(s):
    d=json.load(open(LIB+'/'+s+'.json')); d['slug']=s
    so=[o for o in d.get('sample_offers',[]) if o.get('retailer')!='MicroPerfumes']
    it=MPD.get(s)
    if it: so+= [{'retailer':'MicroPerfumes','size_ml':z['ml'],'price':z['price'],'currency':'USD','in_stock':True,'date_checked':it.get('checked')} for z in it.get('sizes',[]) if z.get('ml') and z.get('price')]
    d['sample_offers']=so; return d
def ok(o): return o.get('currency')=='USD' and o.get('price') and o.get('size_ml') and o.get('in_stock') is not False
def best_bottle(d):
    fb=[o for o in d.get('full_bottle_offers',[]) if ok(o)]
    return min(fb,key=lambda o:o['price']/o['size_ml']) if fb else None
def sample(d,ml):
    so=[o for o in d.get('sample_offers',[]) if ok(o) and float(o['size_ml'])==ml]
    return min(so,key=lambda o:o['price']) if so else None
def smallest(d):
    so=[o for o in d.get('sample_offers',[]) if ok(o)]
    return min(so,key=lambda o:o['price']) if so else None
def notes(d,k):
    n=d.get('notes',{}).get(k) or []; return ', '.join(n) if n else 'not listed'
def money(x): return f"${x:,.0f}" if x==int(x) else f"${x:,.2f}"
def name(d):
    h=d['house'].split(' (')[0]; n=d['name']; return n if n.startswith(h) else f"{h} {n}"
import re as _re
def short(d):
    n=d['name']; h=d['house'].split(' (')[0]
    for pre in (h+' ','Maison Margiela ','Replica ','Tom Ford ','Parfums de Marly ','Creed '):
        if n.startswith(pre): n=n[len(pre):]
    n=_re.sub(r'\s+(Eau de Parfum|Eau de Toilette|Extrait de Parfum|Parfum)$','',n)
    if d['slug'].endswith('extrait') and 'Extrait' not in n: n+=' Extrait'
    return n
def ml(x): return f"{x:g}"
def build(a,b,title_hook,intro,diff,verdict,faqs,seo_title=None):
    A,B=load(a),load(b); slug=f"{a}-vs-{b}"; used=[]
    def u(o):
        if o and o.get('date_checked'): used.append(o['date_checked'])
        return o
    def cell(d,f):
        if f=='bottle':
            o=u(best_bottle(d)); return f"{ml(o['size_ml'])} ml, {money(o['price'])} ({o['retailer']})" if o else 'no in-stock US price'
        if f=='perml':
            o=best_bottle(d); return money(round(o['price']/o['size_ml'],2)) if o else '—'
        if f=='small':
            o=u(smallest(d)); return f"{money(o['price'])} for {ml(float(o['size_ml']))} ml ({o['retailer']})" if o else '—'
        if f in (1,2):
            o=u(sample(d,f)); return f"{money(o['price'])} ({o['retailer']})" if o else '—'
        if f in ('top','heart','base'): return notes(d,f)
        if f=='house': return d['house'].split(' (')[0]
    labels=[('House','house'),('Top notes','top'),('Heart notes','heart'),('Base notes','base'),('Smallest sample','small'),('1 ml sample',1),('2 ml sample',2),('Lowest in-stock bottle price','bottle'),('Bottle price per ml','perml')]
    tbl=f"| | [{name(A)}](/scents/{a}/) | [{name(B)}](/scents/{b}/) |\n| --- | --- | --- |\n"
    for l,f in labels: tbl+=f"| {l} | {cell(A,f)} | {cell(B,f)} |\n"
    asof=max(used) if used else datetime.date.today().isoformat()
    sa,sb=smallest(A),smallest(B)
    both=money(round(sa['price']+sb['price'],2)) if sa and sb else None
    title=f"{short(A)} vs {short(B)}: {title_hook}"
    fm="---\n"+f"title: \"{title}\"\n"+(f"seo_title: \"{seo_title}\"\n" if seo_title else "")+f"slug: {slug}\ndescription: \"{verdict['answer']} Smallest samples: {money(sa['price']) if sa else 'n/a'} and {money(sb['price']) if sb else 'n/a'}, checked {fmt(asof)}.\"\nanswer: \"{verdict['answer']}\"\nscents: [{a}, {b}]\nfaq:\n"
    for q,ans in faqs: fm+=f"  - q: \"{q}\"\n    a: \"{ans}\"\n"
    fm+=f"published: {datetime.date.today().isoformat()}\nprices_as_of: {asof}\n---\n\n"
    body=verdict['answer']+" "+intro+"\n\n## Side by side ("+fmt(asof)+", USD)\n\n"+tbl+"\nNotes as listed by the brand or retailers. Prices are the lowest in-stock US prices we found on the date checked; each scent page has every option.\n\n## How they differ\n\n"+diff+"\n\n## Try both first\n\n"
    body+=(f"The smallest sample of each costs {both} together. " if both else "")+"Wear one on each wrist and check at 10 minutes, 2 hours and 6 hours ([how to test properly](/guides/how-to-test-a-fragrance/)).\n\n"
    body+=f"**Verdict:** {verdict['text']}\n"
    open(OUT+'/'+slug+'.md','w').write(fm+body); print('wrote',slug,asof)
exec(open(PAIRS).read())
