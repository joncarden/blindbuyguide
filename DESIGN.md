# Blind Buy Guide Design System

This document records the core design decisions for the Blind Buy Guide site, ensuring consistency and preventing the reintroduction of common AI design patterns.

## Color Palette

```css
--bg: #f6f2ea      /* Warm cream paper background - deliberate choice */
--ink: #17140f     /* Warm brown ink (16.45:1 contrast on bg) */
--muted: #6b6259   /* Muted text (5.35:1 on bg) */
--accent: #7a5b2e  /* Warm brown accent (5.59:1 on bg) */
--card: #fbf9f4    /* Off-white card background */
--line: #ddd4c4    /* Subtle borders */
```

**Note:** The cream `#f6f2ea` background is an intentional paper/parchment choice that complements the fragrance photography and warm accent palette. It is NOT a default "tasteful AI surface" — it's a brand decision.

## Typography

### Typefaces
- **Display/headings:** `'Cormorant Garamond', 'Playfair Display', Georgia, serif`
- **Body:** `Georgia, 'Times New Roman', serif`
- **UI/labels:** `system-ui, -apple-system, 'Helvetica Neue', sans-serif`

### Type Scale & Hierarchy
- Multi-line headings and ledes: `line-height: 1.35` or greater
- Body text: `line-height: 1.5–1.7`
- Headings: `text-wrap: balance` for h1/h2, `text-wrap: pretty` for all
- Ensure visual hierarchy with ≥1.25× size steps between heading levels and stat figures

## UI Text Standards

### Legibility Floor
- **Minimum functional text size:** 13px (14px preferred for mobile UI)
- **Caption text:** 13–14px at all breakpoints
- **No 10–12px text** anywhere on functional UI elements

### Touch Targets
- **Minimum hit area:** 44×44px for all interactive elements
- Navigation links: adequate padding to meet 44px height
- A–Z index links: 44×44px minimum
- Buttons: ≥44px height, ≥14px text on mobile

## Spacing & Layout

### Card System
- **Product cards (`.pcard`):** 16px consistent inset on text block (12px minimum on small screens)
- **Card grid gap:** 24px desktop, 16px mobile
- **No padding:0 on bordered cards** — top photo bleed is fine, but text needs inset

### Leading
No tight line-height on:
- `.moods a`: 1.35 minimum
- `.pcard strong`: 1.35 minimum
- Multi-line headings: 1.35 minimum
- Body stays 1.5–1.7

## Typography Details

### Letter Spacing
- **Remove tracking from body-length text:** captions, labels, any sentence-length content should have `letter-spacing: 0`
- **Keep 0.12–0.16em tracking ONLY on:** short standalone uppercase labels (`.stats span`, `.lstats dt`, button text)
- **Never track** `.lcap`, `figcaption`, or any paragraph text

### No Eyebrow Kickers
- **Never place tracked uppercase labels directly above h1/h2**
- If words carry essential info (house name, concentration, etc.), move them into:
  - A normal-case byline under the heading
  - A regular sentence in the lede
  - A breadcrumb or metadata line
- Reserve wide tracking for short, standalone caps labels only

## Visual Patterns to Avoid

### No Side-Tab Borders
- **No `border-left: 3px solid` callouts** on verdict or watch boxes
- Use typographic emphasis instead:
  - Bold lead-in text
  - Full 1px border or subtle background change
  - Consistent padding on all sides (14–16px)

### No Flush Cards
- Product cards with photos can bleed the image to the top edge
- Text must have consistent inset (16px)
- Avoid `padding: 0` on the bordered card wrapper itself

## Accessibility

### Focus Styles
```css
:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 3px;
}
```
Apply to all interactive elements: links, buttons, inputs, summary.

### Placeholder Contrast
- Search and form placeholders: `#6b6259` minimum (passes 4.5:1 on card backgrounds)
- Never use `#757575` or lighter grays on `#fbf9f4` backgrounds

### Alt Text
- All bottle images have descriptive alt text
- Decorative cover images in modals: descriptive alt, never empty

## Intentional Exceptions

### The Price Book Shadow
The hard-offset shadow on the Price Book cover is intentional:
```css
box-shadow: 10px 12px 0 color-mix(in srgb, var(--accent) 35%, transparent);
```
This is NOT a default soft card shadow — it's a deliberate hard offset that complements the paper feel.

---

**Recorded:** November 2026  
**Purpose:** Prevent regression to generic AI design patterns while preserving the site's specific, editorial character.
