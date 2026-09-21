# How It Works

OCR engines return an unordered bag of bounding boxes: `[x, y, width, height, text]`. Reading them in naive stream order scrambles columns, detaches prices from titles, and cuts descriptions in half at page boundaries.

**afferent** recovers the document layout in four passes:

## 1. Split Columns

Horizontal projection histograms detect empty gutters across the page. This isolates multi-column text bands from full-width spanning banners, section headers, and footers.

- Text from Column A never bleeds horizontally into Column B.
- Spanning elements (banners, disclaimers) are extracted into `spanningLines`.

## 2. Lock Baselines

Titles and labels are paired with right-aligned values (prices, SKUs, dates) sharing the same visual horizontal baseline (`|Δy| <= 0.012` by default).

- Handles wide whitespace gaps between label and value.
- Supports vertical layouts where a price sits directly below a title.
- Recovers same-line secondary attributes (e.g. per-unit suffixes).

## 3. Stitch Blocks

Within column boundaries, wrapped titles, narrative paragraphs, and sub-bullets merge into unified item blocks:

- Merges multi-line descriptions below a title based on vertical proximity.
- Recovers stub titles and splits colon-delimited narrative headers.
- Computes the exact mathematical union bounding box covering all constituent lines.

## 4. Bridge Page Breaks

When an item begins at the bottom of Page N and concludes at the top of Page N+1, `afferent` evaluates:

- Punctuation (dangling commas, missing terminal periods).
- Grammar & casing (lowercase starts on the new page, trailing conjunctions).
- Value complementarity (title on Page N, price on Page N+1).

Unambiguous continuations stitch automatically. Ambiguous boundaries can query a System 1 model (such as Jev) for semantic confirmation.
