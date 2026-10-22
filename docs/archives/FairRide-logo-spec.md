# FairRide logo — 12b "Swept plume"

Machine-readable spec. All geometry is literal. Feed this whole file to an
agent and it can rebuild the mark exactly.

## Concept
A tilted bowl whose steam is swept backwards over the rim, because the bowl is
travelling. Food and delivery in one connected shape — no speed lines, no
vehicle, nothing floating loose.

## Colors
| Role | Hex |
|---|---|
| Iris (brand / icon background) | `#3B2FB5` |
| Lime (mark on iris) | `#C8F03C` |
| Ink (wordmark on light) | `#14121F` |

Rules: lime ONLY on iris (lime on white fails contrast). On light surfaces the
mark is drawn in iris. On photos or dark grounds, white.

## Wordmark
`fairide` — Bricolage Grotesque, weight 700–800, all lowercase,
`letter-spacing: -0.03em`, `line-height: 1`, optical sizing on.

This is a logotype face and is loaded for this one word only; the rest of the
interface is Space Grotesk. (The original draft of this spec set the wordmark in
Space Grotesk too — superseded, founder's call.)

## Horizontal lockup
mark (height = 1.3 × cap height of wordmark) + gap of 0.35 × wordmark size + wordmark.
At 34 px type the mark is 44 px and the gap 12 px. Clear space on all sides =
one bowl radius.

## Full mark SVG (96 × 96 viewBox)
Replace `CURRENT` with `#C8F03C` on iris, `#3B2FB5` on light, `#FFFFFF` on dark.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" fill="none">
  <path d="M52 40 C46 26 30 24 16 28" stroke="CURRENT" stroke-width="6" stroke-linecap="round"/>
  <path d="M66 38 C62 20 42 14 24 15" stroke="CURRENT" stroke-width="6" stroke-linecap="round" opacity="0.78"/>
  <path d="M76 42 C76 33 68 27 58 25" stroke="CURRENT" stroke-width="6" stroke-linecap="round" opacity="0.55"/>
  <g transform="rotate(-11 54 58)">
    <path d="M26 58 A27 27 0 0 0 80 58 Z" fill="CURRENT"/>
    <path d="M21 58 H85" stroke="CURRENT" stroke-width="7" stroke-linecap="round"/>
  </g>
</svg>
```

Geometry notes: bowl body is a half-disc r = 27 centred at (53, 58); the rim is a
7-unit bar from x 21 to 85 at y 58; the whole bowl group is rotated −11° about
(54, 58). The three plume strokes descend in opacity 1 / 0.78 / 0.55 so the
steam fades as it trails back.

## App icon (132 × 132, radius 24% = 32)
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 132 132" width="132" height="132">
  <rect width="132" height="132" rx="32" fill="#3B2FB5"/>
  <g transform="translate(22 22) scale(0.9167)" fill="none">
    <!-- the five paths above, in #C8F03C -->
  </g>
</svg>
```
Mark occupies 88 / 132 = 67% of the tile width.

## Small-size / favicon mark (≤ 32 px)
Two plume strokes drop out, weights go up. This is the ONLY approved
simplification.
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <rect width="96" height="96" rx="24" fill="#3B2FB5"/>
  <g transform="translate(48 50) scale(0.84) translate(-48 -48)" fill="none">
    <path d="M58 44 C52 26 30 20 12 24" stroke="#C8F03C" stroke-width="9" stroke-linecap="round"/>
    <path d="M18 64 A32 32 0 0 0 82 64 Z" fill="#C8F03C"/>
    <path d="M12 64 H88" stroke="#C8F03C" stroke-width="9" stroke-linecap="round"/>
  </g>
</svg>
```

## Don'ts
- No gradients, shadows, or outlines around the tile.
- Never add speed lines, a bicycle, or a fork — the plume is the motion cue.
- Never rotate the bowl past −11° or flip the plume to the right.
- Never recolour the plume separately from the bowl.
- Never place lime on white or cream.

## Files
- `fairide-mark-lime.svg` / `-iris` / `-white` — mark only, transparent
- `fairide-icon.svg` — rounded iris app-icon tile
- `fairide-favicon.svg` — simplified, for ≤ 32 px
- `png/fairide-icon-1024|512|192.png` — app icon
- `png/fairide-mark-lime|iris|white-1024.png` — transparent mark
- `png/fairide-apple-touch-180.png`, `png/fairide-favicon-64|32|16.png`

## HTML head snippet
```html
<link rel="icon" href="/fairide-favicon.svg" type="image/svg+xml">
<link rel="icon" href="/fairide-favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/fairide-apple-touch-180.png">
<meta name="theme-color" content="#3B2FB5">
```
