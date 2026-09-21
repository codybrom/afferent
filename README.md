# afferent

> **af·fer·ent** (_adj._ /ˈæf.ər.ənt/) — Carrying sensory signals inward toward the central nervous system.

[![npm version](https://img.shields.io/npm/v/afferent.svg)](https://www.npmjs.com/package/afferent)
[![docs](https://img.shields.io/badge/docs-afferent.dev-blue.svg)](https://afferent.dev)
[![license](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**afferent** is a sensory layout engine for 2D documents. It reconstructs columns, horizontal baselines, line-item pairs, and reading order from raw OCR bounding boxes before downstream models or business logic touch them.

Deterministic 2D geometry handles 90%+ of layout recovery at sub-millisecond speeds. For ambiguous page breaks, **afferent** integrates with System 1 models like Jev to evaluate semantic continuations through micro-judgments.

- **Zero dependencies** — pure TypeScript, no native bindings.
- **Coordinate agnostic** — works with normalized (`0..1`) or pixel coordinates.
- **Domain presets** — built-in configurations for price lists, spec sheets, and inventory manifests.
- **System 1 native** — implements `noul`, `choice`, and `score` primitives.

## Install

```bash
npm install afferent
```

## Quick Start

```typescript
import { processPageLayout, type OcrLine } from "afferent";

const lines: OcrLine[] = [
  { id: 1, text: "Platform License (Annual)", x: 0.08, y: 0.22, width: 0.45, height: 0.02 },
  { id: 2, text: "$12,000", x: 0.82, y: 0.221, width: 0.1, height: 0.02 },
  {
    id: 3,
    text: "Includes unlimited seats and priority support.",
    x: 0.08,
    y: 0.245,
    width: 0.55,
    height: 0.02,
  },
];

const page = await processPageLayout(lines);

console.log(page.itemBlocks);
// [
//   {
//     id: 'item_1',
//     title: 'Platform License (Annual)',
//     description: 'Includes unlimited seats and priority support.',
//     value: 12000,
//     box: { x: 0.08, y: 0.22, width: 0.84, height: 0.045 },
//     lines: [...]
//   }
// ]
```

## How It Works

OCR engines return an unordered bag of bounding boxes: `[x, y, width, height, text]`. Reading them in naive stream order scrambles columns, detaches prices from titles, and cuts descriptions in half at page boundaries.

**afferent** recovers the layout in four passes:

1. **Split columns.** Horizontal projection histograms detect gutters to separate multi-column text from spanning headers and banners. Text from column A never bleeds into column B.
2. **Lock baselines.** Titles pair with right-aligned values (prices, SKUs, dates) that share the same horizontal baseline, regardless of whitespace width.
3. **Stitch blocks.** Wrapped titles, narrative paragraphs, and sub-bullets merge into unified item blocks with exact mathematical bounding boxes.
4. **Bridge page breaks.** Items split across pages are detected using dangling punctuation, lowercase starts, and layout continuity. Ambiguous boundaries query a System 1 model (such as Jev) to confirm semantic continuation.

## Documentation

For guides, presets, and full API documentation, visit **[afferent.dev](https://afferent.dev)**:

- [Getting Started](https://afferent.dev/guide/getting-started)
- [How It Works](https://afferent.dev/guide/how-it-works)
- [Domain Presets](https://afferent.dev/guide/presets)
- [Cross-Page Continuations](https://afferent.dev/guide/cross-page)
- [System 1 & Jev Integration](https://afferent.dev/guide/system-one)
- [API Reference](https://afferent.dev/api/)

## License

MIT © Cody Bromley
