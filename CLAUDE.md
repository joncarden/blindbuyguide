# CLAUDE.md

## Social slideshows

Any TikTok or Instagram carousel slideshow work starts from `docs/social/tiktok-playbook.md` plus `docs/social/swipe-file.md`. Read both before drafting hooks, slides or captions. Build decks with the slideshow skill (`.claude/skills/slideshow/SKILL.md`, generator `tools/slideshows/slideshow.mjs`): real site prices and studio bottle photos only, never post without Jon's review.

## Pinterest

Any Pinterest work (boards, pins, descriptions, scheduling) starts from `docs/social/pinterest-playbook.md` plus `docs/social/swipe-file.md`. Pin images are rendered from real site data and studio bottle photos by `tools/pinterest/render.mjs`; see `docs/social/pinterest/batch-1/README.md` for the format. Every pin links to a specific existing page on https://www.blindbuyguide.com. Never post to Pinterest without Jon's review.

`docs/` is excluded from the public site via `.vercelignore`; keep it that way.
