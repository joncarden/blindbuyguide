# Pinterest creative test log

Try, learn, improve. Every creative test gets an entry here: what we changed, which pins carry it, what we read and when, and what we learned. Pin copy and images live in the batch folders; this file is the scoreboard.

## How we tell looks apart

- **Pinterest Analytics, per pin, is the source of truth.** Every pin in a test batch has a `look` field in its `pins.json` (`control`, `A`, `B`). Export pin-level analytics (Analytics > Overview > Top pins, or the CSV export), match each pin by its title + image to the row in `pins.json`, and sum by look.
- **Site analytics can't split looks.** Vercel Web Analytics on our free plan reports pathname and referrer only. UTM dimensions need Web Analytics Plus or Enterprise (the API answered "402 payment required" for `utmSource`/`utmContent` on Nov 23, 2026), and query strings don't appear in `requestPath`. So every look of a page uses the **exact same link**, with no tag. That also keeps one canonical URL per page (nothing to dedupe) and keeps the only variable the image.
- What Vercel can still show: total Pinterest referrals (`referrerHostname` = pinterest.com / pin.it) per landing page, and `/go/` shop-click pageviews on those pages. Use it as a sanity check on Pinterest's outbound-click numbers, not to pick a winner.
- If we ever upgrade to Web Analytics Plus, add `?utm_source=pinterest&utm_medium=organic&utm_content=<page>-<look>` to new test pins; the site's canonical tags already point to the clean URL.

## Metrics

Read at **day 21** and **day 45** after the last pin of a test is posted.

| Metric | Where | Formula |
|---|---|---|
| Impressions | Pinterest Analytics | |
| Saves | Pinterest Analytics | |
| Outbound clicks | Pinterest Analytics | |
| Save rate | | saves / impressions |
| Click rate (outbound CTR) | | outbound clicks / impressions |
| Pinterest sessions on the landing page | Vercel, referrer pinterest.com or pin.it | sanity check only |

Primary metric is **outbound click rate**; saves are the tiebreaker (Pinterest distributes saved pins longer).

## Decision rule

- Don't call a winner until each look has about **1,000 impressions**, summed over its pins. Before that, the numbers are noise.
- Winner = highest outbound click rate. If two looks are within 20% of each other on click rate, pick the higher save rate.
- After a winner: **70% of new pins use the winning look, 30% are new experiments** (a new look, or one variable changed on the winner: headline, colour, CTA wording, photo).
- If no look reaches ~1,000 impressions by day 45, log that, keep posting the batch's pages in all looks, and read again at day 90.

---

## Test 1: bold looks vs the cream template (batch 4)

- **Prepared:** Nov 23, 2026. Pins and copy: [batch-4/](batch-4/README.md).
- **Hypothesis:** our cream, thin-serif, cutout-bottle pins with lots of small text are unreadable at feed size (~236 px wide) and blend into every other beauty pin. Simpler, higher-contrast, more colourful pins with 10 words or fewer will earn a higher outbound click rate and save rate. Look A (a real photo of the notes) should win on saves; Look B (one huge verdict) should win on clicks.
- **Design:** 4 pages × 3 looks = 12 pins. For each page, title, description, board and link are identical across looks; only the image changes. Posted in a rotating order so each day has one pin of each look.
- **Looks:**
  - **Control:** the existing cream template (studio bottle photo, Cormorant serif, small facts table).
  - **A, ingredient photo:** full-bleed CC0 / public-domain photo of a key note (no bottle, no logo), big serif headline naming the notes, the fragrance name, a pill CTA, the domain.
  - **B, verdict poster:** solid bold colour chosen by verdict (green = safe blind buy, oxblood = don't blind buy, hot pink = sample first, tobacco = test the pair), huge condensed verdict, fragrance name, bottle price vs sample price, pill CTA.

### Pins

| Page | Landing page | Board | Control | Look A | Look B |
|---|---|---|---|---|---|
| Tobacco Vanille + Oud Wood layering | /guides/perfume-layering-combinations/ | Winter Perfumes | 33 | 34 | 35 |
| Baccarat Rouge 540 notes | /scents/baccarat-rouge-540-edp/ | Perfume Note Pyramids | 36 | 37 | 38 |
| Ombré Leather, safe blind buy | /guides/safe-blind-buy-perfumes/ | Designer Perfumes | 39 | 40 | 41 |
| Delina, worth it? | /guides/is-delina-edp-worth-it/ | Niche Perfumes | 42 | 43 | 44 |

Posted on: _(Jon: add the date you posted each pin)_

### Results, day 21 (due 21 days after the last pin is posted)

| Look | Pins | Impressions | Saves | Outbound clicks | Save rate | Click rate |
|---|---|---|---|---|---|---|
| Control | 33, 36, 39, 42 | | | | | |
| A, ingredient photo | 34, 37, 40, 43 | | | | | |
| B, verdict poster | 35, 38, 41, 44 | | | | | |

### Results, day 45

| Look | Pins | Impressions | Saves | Outbound clicks | Save rate | Click rate |
|---|---|---|---|---|---|---|
| Control | 33, 36, 39, 42 | | | | | |
| A, ingredient photo | 34, 37, 40, 43 | | | | | |
| B, verdict poster | 35, 38, 41, 44 | | | | | |

Per-page breakdown (fill in if a page's looks disagree with the overall result):

| Page | Control CTR | A CTR | B CTR | Notes |
|---|---|---|---|---|
| Layering | | | | |
| BR540 notes | | | | |
| Ombré Leather | | | | |
| Delina | | | | |

### Decision

_(after ~1,000 impressions per look)_

---

## Learnings

Running list. One line each, dated, with the test it came from. Keep what generalises ("pins with a price comparison get more clicks"), not one-offs.

- _(none yet)_

## Next experiments (queue)

Ideas for the 30% slot once Test 1 has a winner:

1. Winner look with the headline as a question ("Safe to blind buy?") vs a statement ("Safe blind buy").
2. Look B colour: verdict-coded colour vs one fixed brand colour for every verdict.
3. Look A with the price line added vs without.
4. Same look, different landing type: worth-it guide vs scent page for the same fragrance.
5. Video pin (5 to 8 s slow pan over the ingredient photo) vs the static Look A.
