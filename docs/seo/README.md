# Verdict-first titles (Nov 23, 2026)

Google Search Console showed 672 impressions at 0.4% CTR, with many pages at positions 6-10. These files rewrite the title tag, meta description and first sentence of every "Is X worth it?" guide so the verdict comes first.

- `verdicts.tsv`: slug, short name, "yes if you love ..." phrase, "sample first if ..." phrase. Phrases use only notes on the guide's own list. No first-person testing claims.
- `overrides.json`: hand-written copy for the three gift-set guides.
- `verdict_titles.py <guides_dir> verdicts.tsv overrides.json <library/scents> <site/partners/microperfumes-offers.json>`: adds `seo_title` front matter (the generator uses it for the title tag and adds " | Blind Buy Guide" only when the total stays within 60 characters), rewrites `description` with live in-stock sample and bottle prices, and puts a "Safe blind buy? Only if you already love X; sample first if Y." sentence in front of `answer` and the body's first line. It skips files that already have `seo_title`.

New worth-it guides: add a row to `verdicts.tsv` and run the script on the new files before building. The H1 stays the question ("Is X worth it?") on purpose, since it matches the search query.

Title patterns, first that fits in 60 characters: `Is {short} worth it? Yes, if you love {like}`, then `{short} worth it? Yes, if you love {like}`, then `{short}: worth it if you love {like}`.
