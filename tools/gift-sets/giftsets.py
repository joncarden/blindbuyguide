#!/usr/bin/env python3
"""Generate holiday gift-set "worth it?" guides + a roundup from content/gift-sets/<year>.json and the library.
Set prices come from the JSON (dated, from retailer pages); component bottle prices come from the library at run time.
Usage: python3 giftsets.py   (writes content/guides/is-<set>-worth-it.md and holiday-fragrance-gift-sets-worth-it.md)"""
import json, os
LIB='/mnt/project-files/library/scents/'; ROOT='/mnt/project-files/content/'
MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
DECANT={'Fragrances Line','Scentsplit','Scent Split'}
def money(x): return ('${:,.2f}'.format(x)).replace('.00','')
def pretty(d): y,m,dd=d.split('-'); return f"{MONTHS[int(m)-1]} {int(dd)}, {y}"
def q(s): return s.replace('"',"'")
def lib(slug):
    try: return json.load(open(LIB+slug+'.json'))
    except Exception: return None
def best_bottle(d):
    if not d: return None
    ok=[o for o in d['full_bottle_offers'] if o.get('currency')=='USD' and o.get('price') and o.get('size_ml') and o.get('in_stock') is not False and o['retailer'] not in DECANT]
    return min(ok,key=lambda o:o['price']/o['size_ml']) if ok else None
G=json.load(open(ROOT+'gift-sets/2026.json')); A=pretty(G['checked']); out=ROOT+'guides/'
VT={'buy':'Buy it','sample_first':'Sample it first','skip':'Skip it'}
rows_summary=[]
for st in G['sets']:
    tot=sum(i['ml'] for i in st['items']); ppm=st['price']/tot
    names=', '.join(i['label'].replace(' Eau de Parfum','').replace(' Extrait de Parfum',' Extrait') for i in st['items'])
    vt=VT[st['verdict']]
    cmp=[]
    for c in st['compare']:
        d=lib(c['scent']); b=best_bottle(d)
        cmp.append((c,d,b))
    ans=f"{vt}: the {st['short']} is {money(st['price'])} for {len(st['items'])} bottles, about {tot:g} ml in all, which works out to {money(round(ppm,2))} per ml at {st['retailer']} on {A}."
    oos=st.get('in_stock') is False
    if oos: ans+=f" It was out of stock at {st['retailer']} when we checked, so watch for a restock or start with samples of the bottles inside."
    desc=f"Is the {st['short']} worth it? {len(st['items'])} bottles, {tot:g} ml, {money(st['price'])} at {st['retailer']} ({money(round(ppm,2))}/ml), compared with full bottles. Checked {A}."
    sl=[i['scent'] for i in st['items'] if i['scent']]
    faq=[(f"Is the {st['short']} worth it?",f"{vt}. It is {money(st['price'])} at {st['retailer']} on {A}, or {money(round(ppm,2))} per ml across {tot:g} ml.{' It was out of stock there when we checked.' if oos else ''} {st['hook']}"),
         (f"What is in the {st['short']}?",f"{names}. {st['item_size_note']}"),
         (f"Who should get the {st['short']}?",f"Best for {st['recipient']}. Skip it if {st['skip_if']}.")]
    fm=f'---\ntitle: "Is the {st["short"]} worth it?"\nslug: is-{st["slug"]}-worth-it\ndescription: "{q(desc)}"\nanswer: "{q(ans)}"\nscents: [{", ".join(sl)}]\nfaq:\n'
    for a,b in faq: fm+=f'  - q: "{q(a)}"\n    a: "{q(b)}"\n'
    fm+=f"published: 2026-11-18\nprices_as_of: {G['checked']}\n---\n"
    body=f"{ans} {st['hook']}\n\n## What is in the box\n\n| Bottle | Size |\n| --- | --- |\n"
    for i in st['items']:
        lab=f"[{i['label']}](/scents/{i['scent']}/)" if i['scent'] else i['label']
        body+=f"| {lab} | {i['ml']:g} ml |\n"
    body+=f"\n{st['item_size_note']} Total about {tot:g} ml. Contents as listed by the retailer on {A}; the brand can swap a bottle between print runs, so check the listing before you buy.\n\n"
    if st.get('faq_extra'): body+=f"{st['faq_extra']}\n\n"
    body+=f"## The price per ml, set against full bottles\n\nThe set is {money(st['price'])} for {tot:g} ml, or {money(round(ppm,2))} per ml ({st['retailer']}, {st['stock']}, checked {A}). A set is never the best per-ml price, and that is not what you are buying: you are buying five or four decisions, wrapped. Here is what a full bottle of the same scents costs in our library.\n\n| Fragrance | Best in-stock bottle | Size | Price | Per ml | Checked |\n| --- | --- | --- | --- | --- | --- |\n"
    for c,d,b in cmp:
        if b: body+=f"| [{c['label']}](/scents/{c['scent']}/) | {b['retailer']} | {b['size_ml']:g} ml | {money(b['price'])} | {money(round(b['price']/b['size_ml'],2))} | {pretty(b['date_checked'])} |\n"
        else: body+=f"| [{c['label']}](/scents/{c['scent']}/) | no in-stock US bottle price in our library | | | | |\n"
    body+=f"\nPer-ml figures use the lowest in-stock price at a non-decant retailer in our library. Not every bottle in a set has one, and we leave out sold-out listings rather than present them as deals.\n\n"
    body+=f"## Who it is for, and who should pass\n\n**Worth it if** the recipient is {st['recipient']}.\n\n**Pass if** {st['skip_if']}.\n\n"
    body+=f"## Where to buy\n\n- **{st['retailer']}:** [{st['name']}]({st['url']}), {money(st['price'])}, {st['stock']} on {A}.\n\n{'It was sold out when we checked; holiday sets sometimes restock, so the link goes to the listing in case it comes back. ' if oos else ''}Prices move through the holidays and sets sell out, so treat this as a snapshot and confirm on the retailer page.\n\n"
    body+="## Keep reading\n\n- [Holiday fragrance gift sets: which are worth it](/guides/holiday-fragrance-gift-sets-worth-it/)\n- [The 2026 gift guide](/gift-guide/)\n- [How to test a fragrance](/guides/how-to-test-a-fragrance/)\n"
    body+=f"\n**Verdict: {vt.lower()}.** {st['closer']}\n"
    open(out+f"is-{st['slug']}-worth-it.md",'w').write(fm+body)
    rows_summary.append((st,tot,ppm,vt))
# roundup
slug='holiday-fragrance-gift-sets-worth-it'
ans=f"Of the luxury fragrance gift sets we could price on {A}, the {len(rows_summary)} worth considering are the Tom Ford Private Blend Luxe Discovery Set at $100, the Creed Men's 5-Piece Discovery Set at $380 and the MFK 5-Piece Holiday Miniature Set at $325."
_oos=[st['short'] for st,_,_,_ in rows_summary if st.get('in_stock') is False]
if _oos: ans+=f" On {A} the {' and the '.join(_oos)} {'was' if len(_oos)==1 else 'were'} out of stock."
_ins=[f"the {st['short']} at {st['retailer']}" for st,_,_,_ in rows_summary if st.get('in_stock')]
_stock_a=(f"On {A}, {', '.join(_ins[:-1])+' and '+_ins[-1] if len(_ins)>1 else _ins[0]} {'were' if len(_ins)>1 else 'was'} listed in stock" if _ins else f"On {A} none of the sets we price was listed in stock")+(f", and the {' and the '.join(_oos)} {'was' if len(_oos)==1 else 'were'} out of stock" if _oos else '')+". Parfums de Marly's discovery sets were sold out at its US site."
desc=f"Which holiday fragrance gift sets are worth it in 2026? Creed, Tom Ford and MFK sets compared on price per ml, contents and who should get them. Prices as of {A}."
fm=f'---\ntitle: "Holiday fragrance gift sets: which are worth it (2026)"\nslug: {slug}\ndescription: "{q(desc)}"\nanswer: "{q(ans)}"\nscents: []\nfaq:\n'
faq=[("Are fragrance gift sets worth it?",f"Discovery sets are, when the recipient has not picked a signature yet: they hold several full-strength scents in travel sizes for one price. They are not the best per-ml deal, and they are the wrong gift for someone who already knows their bottle. Prices as of {A}."),
     ("Which fragrance gift sets are in stock?",_stock_a)]
for a,b in faq: fm+=f'  - q: "{q(a)}"\n    a: "{q(b)}"\n'
fm+=f"published: 2026-11-18\nprices_as_of: {G['checked']}\n---\n"
body=f"{ans} Every set below is priced from a retailer page we read on {A}, and the verdicts follow the house rule: sample before you commit to a bottle, and a set is the gift-wrapped version of that rule.\n\n## The sets, side by side\n\n| Set | Price | Size | Per ml | Stock | Verdict |\n| --- | --- | --- | --- | --- | --- |\n"
for st,tot,ppm,vt in rows_summary:
    body+=f"| [{st['short']}](/guides/is-{st['slug']}-worth-it/) | {money(st['price'])} | {tot:g} ml | {money(round(ppm,2))} | {st['stock']} | {vt} |\n"
body+=f"\nPrices at Bluemercury (Tom Ford, Creed) and Dillard's (MFK), checked {A}. The sets are travel sizes (3 ml to 10 ml per bottle), so the per-ml price is higher than a full bottle. That is the point of a discovery set, not a flaw in it.\n\n## How to choose a set\n\n1. **Is the recipient still deciding?** A discovery set is ideal. If they already have a signature, give the bottle.\n2. **Count the scents they would actually wear.** A set where three of five are a miss is a poor gift whatever the per-ml price.\n3. **Check the contents on the retailer page.** Brands swap bottles between print runs.\n4. **Mind the stock.** Limited-edition holiday sets sell out and often don't return.\n\n"
body+="## Sold out when we checked\n\n| Set | Retailer | Price | Size | Status |\n| --- | --- | --- | --- | --- |\n"
for s in G['sold_out']: body+=f"| {s['name']} | {s['retailer']} | {money(s['price'])} | {s['size']} | {s['status']} |\n"
body+="\nListed for reference only. Check the retailer for restocks.\n\n"
body+="## Not covered yet\n\nDillard's lists more Creed and Tom Ford sets (Aventus Home & Away, Aventus 3-piece, and several Tom Ford eau de parfum and travel spray sets) without showing prices where we read them, so we have not priced them. We have not priced Dior or YSL sets, because those scents are outside our price library.\n\n"
open(out+slug+'.md','w').write(fm+body)
print('wrote',len(rows_summary)+1)
