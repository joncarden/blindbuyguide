# New guides (Nov 18, 2026)

Sources for /guides/safe-blind-buy-perfumes/ and /guides/perfume-layering-combinations/, plus a one-line link added to should-you-blind-buy-niche-fragrance.md.

After merge, sync the shared generator so a full rebuild keeps these pages:
1. Copy the three .md files into /mnt/project-files/content/guides/.
2. Apply guides-index-know.patch to /mnt/project-files/site/build.redesign.mjs (adds both guides to the guides hub "Good to know" list).
3. Sitemap and llms.txt entries were added by hand on main; a rebuild regenerates them.
