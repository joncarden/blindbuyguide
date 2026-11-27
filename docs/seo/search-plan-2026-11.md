# Search plan, Nov 27 2026 (2-week plan, one batched PR)

Jon approved the PM/coordinator 2-week plan on Nov 27. This PR ships all of it at once (Vercel Hobby deploy cap).

## What changed

All of it is driven by `site/config.json` `searchPlan` and lives in the shared generator, so full rebuilds keep it.

1. **Upgrade set: 29 scent pages** (`searchPlan.upgradeSlugs`): 18 scent pages that got Google landings Nov 14-27 (Vercel, referrer google.com) plus 11 pages tied to the PM's top queries. Each gets:
   - title `"<Scent>: safe blind buy? <Verdict> (samples from $X)"`, shortest form that fits 60 characters;
   - a "Safe blind buy?" direct answer at the top (from the scent verdict, or the worth-it guide's answer) plus a link to the full worth-it guide;
   - the same answer as the meta description.
   Two pages (Creed Iris Debonair, Le Labo The Matcha 26) have no in-stock price, so they keep the old title.
2. **"Is X a safe blind buy?" FAQ** (visible + FAQPage schema) on every scent page with a verdict, guide answer or sample price.
3. **10 new comparison pages** for "X vs Y" intent (Google surfaced "Oud for Greatness vs Oud Wood"): built by `docs/seo/comparisons_build.py docs/seo/pairs-2026-11-27.py` (library + MicroPerfumes prices, real check dates). The 9 older comparisons got short H1s (they wrapped to 10 lines on phones).
4. **Two guides retargeted at real queries**: By the Fireplace ("is by the fireplace a safe blind buy", 19 impressions) and Beach Walk ("is margiela replica beach walk a good beginner niche fragrance"): new titles, a section answering the query, live MicroPerfumes prices (the old 1 ml Fragrances Line price for Fireplace was sold out), links to the new comparisons.
5. **Noindex thin scent pages**: a scent page is thin when it has no in-stock US price with notes or a verdict, and no guide or comparison covers it, and it is not a Google landing (`searchPlan.keepIndexed`). 111 pages (list: `noindexed-2026-11-27.txt`) now carry `noindex,follow`, stay crawlable and linked, and left the sitemap (1,579 to 1,478 URLs). Letter index pages, guides and comparisons stay indexed.
   - Note: the "4,573 pages" figure is mostly /go/ redirect pages (~3,000, already noindex and disallowed in robots.txt). Indexable pages were ~1,580, and 1,286 of 1,339 scent pages have real prices. Catalog pages do earn Google landings (Sunflowers, Penhaligon's, Orpheon), so a deeper cut was not justified.
6. **Paying program as the primary sample button**: when MicroPerfumes (Rakuten) or another enabled Rakuten/CJ shop sells a sample within max($4, 50%) of the cheapest price and at most 50% more per ml, it gets the main "Sample it" button and the mobile sticky bar; the smallest price stays listed under the button. Moves 23 more scent pages to MicroPerfumes (349 total). 827 primary buttons still go to Fragrances Line (untagged; no paying shop stocks those samples). Tag them the moment the Refersion rfsn code arrives (`site/postbuild/retag.py`).
7. **AI-answer and UTM measurement**: the analytics snippet tags the landing pageview of a visit that came from an AI assistant (referrer chatgpt.com, perplexity.ai, copilot, gemini, claude.ai, you.com, meta.ai, deepseek, grok, mistral, brave, kagi) or any `utm_source` as `/from/<source>/<page>`. Free plan: Vercel's UTM dimension and custom events return 402 on Hobby. Read it with `aggregate_pageviews` filter `startswith(requestPath,'/from/')`, by requestPath.
8. Mobile: the hero bottle on scent pages is capped at 200 px wide so the answer sits higher; the sticky "Sample from $X" bar carries the CTA.

## Experiments and how to read them

| Experiment | Treatment | Control | Metric | Read on | Goal |
| --- | --- | --- | --- | --- | --- |
| Verdict-first titles + direct answer | 29 upgrade pages | 29 control pages below | GSC CTR and avg position per page, 14 days before vs after | Dec 11 (needs GSC export) | CTR 0.4% to 1.5%+ |
| New comparisons | 10 new /compare/ pages | none | GSC impressions/clicks on "vs" queries; Vercel views | Dec 11, Dec 27 | 100+ impressions in 4 weeks |
| Noindex thin pages | 111 pages out | kept pages | GSC indexed pages, crawl stats, impressions on kept pages | Dec 18-25 | impressions on kept pages up |
| Paying primary CTA | 23 switched pages | rest | /go/microperfumes clicks per page view; Rakuten report | weekly | first Rakuten commission |
| AI answers | /from/ tagging | n/a | `/from/*` pageviews by source; monthly 20-question spot check | weekly / monthly | first AI landing |

Control set (29 scent pages with a verdict and samples, untouched titles): roja-taif-aoud-edp, creed-white-amber-edp, versace-eros-energy-edp, frederic-malle-eau-de-magnolia-edp, roja-lost-in-paris-extrait, guerlain-lhomme-ideal-edp, maison-margiela-promenade-in-the-gardens-edt, tom-ford-grey-vetiver-parfum, ex-nihilo-electra-gaze-edp, roja-parfum-de-la-nuit-extrait, psychedelic-love-edp, mfk-aqua-celestia-cologne-forte-edp, giorgio-armani-acqua-di-gioia-edp, creed-love-in-black-edp, side-effect, mugler-alien-goddess-edp, portrait-of-a-lady, nishane-vain-and-naive-extrait, marc-jacobs-daisy-edt, mancera-tonka-cola-edp, donna-karan-cashmere-mist-edp, ylang-49-edp, kilian-incense-oud-edp, le-labo-vanille-44-edp, xerjoff-nio-edp, roja-bergdorf-goodman-pour-homme-edp, penhaligons-the-omniscient-mr-thompson-edp, valentino-uomo-born-in-roma-green-stravaganza-edt, kilian-eternal-oud-edp.

## Rolling out

If the upgrade set beats control on Dec 11, move more slugs into `searchPlan.upgradeSlugs` (or replace the per-slug check with "every page with a verdict") and rebuild. A noindexed page that gains a real in-stock price and notes is re-indexed automatically on the next build.
