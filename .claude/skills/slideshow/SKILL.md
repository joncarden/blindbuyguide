---
name: slideshow
description: Build a TikTok (1080x1920) and Instagram (1080x1350) photo slideshow for Blind Buy Guide from one scent slug plus three answers (angle, audience, call to action), using only real site prices, verdicts and studio bottle photos. Outputs 12 ranked hooks, a 6-8 slide deck in 4 looks, an optional reference-matched look, and captions with hashtags.
---

# Slideshow skill (TikTok + Instagram)

Generator: `tools/slideshows/slideshow.mjs` (Node + the preinstalled Playwright, no other deps).
Read `docs/social/tiktok-playbook.md` and `docs/social/swipe-file.md` first (repo CLAUDE.md rule). Voice: `/mnt/project-files/launch-kit/00-voice-guide.md` when available.

## 1. Ask the 3 quick questions (skip any the request already answers)

1. **Angle**
   - `verdict`: should you blind buy X? (bottle, notes, price per ml, site tip, verdict)
   - `alternatives`: love X? sample its housemates next. **This is what a "dupe" request becomes.** We never do dupes, clones, "smells like" or cheaper-alternative posts; housemates are luxury vs luxury, linked by the notes the site lists.
   - `sample`: the smart way to sample X (sample sizes, the % math, how to test). **This is what a "cheapest sample" request becomes.** Never say cheap/cheapest/budget.
   - `seasonal`: sample X before winter / the holidays / fall / spring / summer (`--season`). Only builds if X's listed notes support the season.
   - `guess`: guess the price, 3-5 bottles from one house (`--lineup a,b,c,d`, or auto-picks housemates)
   - `versus`: which costs more per ml? pairs (`--rounds a:b,c:d,e:f`)
   The script reroutes `dupe`, `cheapest-sample`, `budget` etc. and records a note in check.txt. Tell the user when that happened.
2. **Audience**: `signature`, `gift`, `first-niche`, `collector`, or free text.
3. **Call to action**: `guide` (the scent's worth-it guide, or the house guide for a guess deck), `price-book`, `quiz`, `comment`, `save`.

## 2. Run it

```
node tools/slideshows/slideshow.mjs --slug delina-edp --angle verdict --audience gift --cta guide --out /tmp/out
node tools/slideshows/slideshow.mjs --brief tools/slideshows/briefs/01-parfums-de-marly.json --out /mnt/project-files/social/<batch>/
```
Useful flags: `--hooks-only` (just hooks + captions + checks), `--hook "..."` (use hook #2 or #3 instead of #1), `--looks editorial,native`, `--formats tiktok`.
A brief file is the same inputs as JSON (`id, slug, angle, audience, cta, season, lineup, rounds, hook, looks, formats, ref`). Save briefs for anything we post in `tools/slideshows/briefs/`.

## 3. Match a reference post (optional)

Look at the reference image yourself, then pass what you see:
```
--ref ref.png --ref-font serif|sans|mono --ref-align left|center --ref-pos top|center|bottom [--ref-label] [--ref-upper] [--ref-photo full|framed]
```
The script pulls the palette (background, ink, accent) from the image; the flags carry layout (font family, alignment, text position, boxed labels, all caps, full-bleed photo). Renders as an extra look named `ref`. We copy the style, never the other account's photos, words or audio.

## 4. What comes out (per deck folder)

- `hooks.md`: 12 hooks, scored and ranked, top 3 starred (from 3 different hook families, so posting the same slides with each hook is a real test). The deck uses #1.
- `tiktok/<look>/slide-NN.png` (1080x1920, text kept out of TikTok's caption and side-rail zones) and `instagram/<look>/slide-NN.png` (1080x1350). Looks: `editorial` (site look), `cover` (magazine), `ledger` (price receipt), `native` (TikTok text boxes), plus `ref`.
- `contact-tiktok.jpg`, `contact-instagram.jpg`: every look on one review sheet.
- `caption-tiktok.txt` (6 hashtags), `caption-instagram.txt` (10 hashtags).
- `facts.json`: every number used and where it came from. `check.txt`: results of the checks below.

## 5. Rules the script enforces (and you must not work around)

- Every price, size, retailer, sample price and verdict comes from `data/scents.json` (in-stock USD offers only). The build fails if any `$` figure in the copy isn't a site price, or if the scent has no in-stock price.
- Bottle photos only from `images/studio/` and never a name card (detected automatically; such scents show text only and get a note).
- Banned words fail the build: dupe, clone, cheap(er/est), budget, steal, bargain, smells like, smells expensive, luxurious, sensual, journey, intoxicating, elixir, must-have, iconic, affordable. Names that contain one (e.g. a product called "Elixir") are exempt.
- No fake experience: we never say we smelled, wore or tested anything.
- Affiliate disclosure on the last slide and in both captions; prices are dated on the slides.
- Never post anywhere. Decks go to Jon for review; he posts by hand.

## 6. Before handing over

Open the contact sheets and read every slide at phone size: photo matches the line, text readable, nothing cut off, nothing off-brand. Prices expire about 14 days after the "checked" date; re-run the brief on posting day (the data refreshes weekly).
