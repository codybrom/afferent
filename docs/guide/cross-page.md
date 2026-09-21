# Cross-Page Continuation

When documents span multiple pages, table rows or line items frequently get sliced across physical page breaks. For example, a title might appear at the bottom of Page 1, while its narrative description or price appears at the top of Page 2.

## Stitching Multi-Page Documents

Use `stitchCrossPageDocument` to link and merge cross-page offerings across an array of processed pages:

```typescript
import { processPageLayout, stitchCrossPageDocument } from "afferent";

// Process individual pages
const page1 = await processPageLayout(page1Lines, undefined, 1);
const page2 = await processPageLayout(page2Lines, undefined, 2);

// Stitch across page breaks using built-in linguistic heuristics
const stitchedPages = await stitchCrossPageDocument([page1, page2]);
```

### What Happens During Stitching

1. **Page N Tail Block**: Enriched in-place with the stitched title, unified description, combined price/value, and expanded bounding box.
2. **Page N+1 Head Block**: Reclassified as a linked continuation context block (`contextType: 'continuation'`), preventing duplicate downstream extraction.

## Low-Level Continuation Primitives

If you want fine-grained control over candidate detection and stitching:

```typescript
import { findPageBoundaryCandidates, stitchCrossPageItemBlocks } from "afferent";

// 1. Identify candidate splits between adjacent pages
const candidates = findPageBoundaryCandidates(page1, page2);

for (const candidate of candidates) {
  console.log(`Linguistic score: ${candidate.linguisticScore}`);
  console.log(`Signals: ${candidate.reasons.join(", ")}`);
}

// 2. Select confirmed candidates and stitch in-place
const confirmedPairs = candidates.filter((c) => c.linguisticScore >= 70);
stitchCrossPageItemBlocks(page1, page2, confirmedPairs);
```
