# Field plates

Shared visual explanation layer for the Hook the Horizon fleet.

**This directory is byte-identical in all seven application repositories.** The
canonical copy is the one in `field-ops-desk`. Edit it here, run
`node scripts/sync-fleet-shared.mjs`, and commit in each repo. A local edit
made in a sibling repo will be overwritten the next time anybody syncs.

## Why it is shared

Seven instruments were explaining the same fishing problem in seven visual
languages, and six of them were explaining it in paragraphs. A seam means the
same thing in Waterways as it does in Field Ops, so it should be drawn by the
same code — otherwise the fleet teaches a reader a diagram convention in one
app and breaks it in the next.

## What is in it

| Module | Plate | The question it answers |
|---|---|---|
| `water-section` | `WaterSectionPlate` | What kind of water is this, and which parts of it hold fish? |
| `presentation-path` | `PresentationPathPlate` | What does the bait or fly actually have to *do*? |
| `system-chain` | `SystemChainPlate` | Where does this whole setup give out first? |
| `rig-schematic` | `RigSchematicPlate` | How are the components arranged, and at what spacing? |
| `load-path` | `LoadPathPlate` | Where does load travel through a connection — and does it slip or break? |
| `forage-silhouette` | `ForageSilhouettePlate` | What am I looking at, at what size, and how sure is that? |
| `season-band` | `SeasonBandPlate` | What is this fish doing through the year, and what temperature drives it? |
| `kit` | primitives | Everything the plates are drawn from. |

## House rules

1. **Inline SVG, viewBox, no fixed pixel size.** One asset scales to a 390px
   phone and prints without a raster.
2. **Colour through CSS custom properties, with fallbacks.** Four of the seven
   apps never defined `--brass`. A plate has to be legible in those too, and
   follow the theme in the ones that did.
3. **No dependency beyond React.** No icon library, no Tailwind class names,
   no app-specific types. A plate that needs app types is composed in the app
   from these primitives.
4. **Wording lives in the legend, not inside the drawing.** A long label can
   then never collide with the diagram or overflow the viewBox.
5. **A plate that repeats the paragraph beside it should not exist.** The
   drawing has to explain something faster or better than the text, or it is
   decoration.
6. **Unknowns are drawn, not hidden.** A specimen the app is unsure of is
   drawn dashed and labelled unsure. `Plate` has an `unknown` slot that never
   folds away behind a tap, because an unknown hidden behind a tap reads as an
   answer that does not exist.

## Adopting it in an app

```tsx
import { WaterSectionPlate } from "@/lib/field-plates";
```

The barrel imports the stylesheet, so there is no separate CSS wiring. If the
app has its own tokens, override the `--hthp-*` layer once at the root and
every plate follows:

```css
:root {
  --hthp-accent: var(--my-accent);
  --hthp-line: var(--my-border);
}
```

Set `data-hthp-field="on"` above the plates for field mode: larger type,
higher contrast, muted text promoted to full ink.
