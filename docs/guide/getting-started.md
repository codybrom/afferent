# Getting Started

## Installation

Install `afferent` using your preferred package manager:

::: code-group

```bash [npm]
npm install afferent
```

```bash [pnpm]
pnpm add afferent
```

```bash [yarn]
yarn add afferent
```

:::

## Basic Usage

Pass an array of OCR lines with coordinates `[x, y, width, height, text]` to `processPageLayout`:

```typescript
import { processPageLayout, type OcrLine } from "afferent";

// Coordinates can be normalized (0..1) or pixel values
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
```

### Result Structure

`processPageLayout` returns a `ProcessedPageLayout` object containing:

- **`itemBlocks`**: Array of `StitchedItemBlock` items, each with `title`, `description`, `value`, `price`, `box` (bounding box union), and constituent `lines`.
- **`columns`**: Discovered column bands on the page.
- **`spanningLines`**: Full-width headers, footers, or disclaimer banners that span across columns.
- **`unassignedLines`**: Standalone lines not associated with any line-item block.
