# Slideshows (TikTok + Instagram)

One scent slug + 3 answers (angle, audience, call to action) -> 12 ranked hooks, a 6-8 slide deck as 1080x1920 (TikTok) and 1080x1350 (Instagram) PNGs in 4 looks, an optional reference-matched look, captions and hashtags. Real site data only.

Workflow and rules: [`.claude/skills/slideshow/SKILL.md`](../../.claude/skills/slideshow/SKILL.md).

```
node tools/slideshows/slideshow.mjs --slug delina-edp --angle verdict --audience gift --cta guide --out /tmp/out
node tools/slideshows/slideshow.mjs --brief tools/slideshows/briefs/05-higher-or-lower.json --out /tmp/out
node tools/slideshows/slideshow.mjs --help
```

- `slideshow.mjs`: CLI and pipeline (inputs, photo inspection, checks, output files).
- `lib/data.mjs`: facts from `data/scents.json` (headline bottle, samples, per ml, notes, verdict, landing page).
- `lib/copy.mjs`: angles, hooks + scoring, slide plans, captions, banned-word / fake-experience / price checks.
- `lib/render.mjs`: the 4 looks, reference style, Playwright rendering, contact sheets.
- `briefs/`: saved inputs for decks we made (01-05 = the first TikTok batch, regenerated 2026-11-20).

Fonts: Cormorant Garamond from `tools/pinterest/fonts`; Inter and JetBrains Mono when installed (falls back to DejaVu).
Output defaults to `tools/slideshows/out/` (git-ignored). `tools/` and `.claude/` are excluded from the public site.
