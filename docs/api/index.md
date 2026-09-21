# API Reference

## Top-Level Orchestration

### `processPageLayout`

Runs column clustering, horizontal baseline pairing, and line-item block stitching on a single page.

```typescript
function processPageLayout<TLine extends OcrLine = OcrLine, TValue = unknown>(
  ocrLines: TLine[],
  options?: SpatialEngineOptions<TValue>,
  pageNumber?: number,
): Promise<ProcessedPageLayout<TLine, TValue>>;
```

### `stitchCrossPageDocument`

Stitches candidate split items across consecutive pages using heuristics or an optional System 1 client.

```typescript
function stitchCrossPageDocument<TLine extends OcrLine = OcrLine, TValue = unknown>(
  pages: ProcessedPageLayout<TLine, TValue>[],
  clientOrFn?: SystemOneClient | SystemOneEvaluateFn,
  options?: SpatialEngineOptions<TValue>,
): Promise<ProcessedPageLayout<TLine, TValue>[]>;
```

## Geometry Primitives

### `clusterColumns`

Splits lines into column bands via horizontal projection histograms. Spanning lines (banners, full-width headers) are separated into `spanningLines`.

```typescript
function clusterColumns<TLine extends OcrLine = OcrLine>(
  ocrLines: TLine[],
  options?: SpatialEngineOptions<unknown>,
): {
  spanningLines: TLine[];
  columns: ColumnBand<TLine>[];
};
```

### `pairHorizontalPriceLines`

Pairs title lines with right-aligned currency lines sharing a horizontal visual baseline.

```typescript
function pairHorizontalPriceLines<TLine extends OcrLine = OcrLine>(
  lines: TLine[],
  options?: SpatialEngineOptions<number>,
): AnchoredItemPair<TLine, number>[];
```

### `pairHorizontalValues`

Generic baseline pairing supporting custom value extractors.

```typescript
function pairHorizontalValues<TLine extends OcrLine = OcrLine, TValue = unknown>(
  lines: TLine[],
  matcher?: (text: string) => ExtractedValue<TValue> | null,
  options?: SpatialEngineOptions<TValue>,
): AnchoredItemPair<TLine, TValue>[];
```

### `stitchItemBlocks`

Merges multi-line descriptions and titles within column boundaries into discrete blocks with unified bounding boxes.

```typescript
function stitchItemBlocks<TLine extends OcrLine = OcrLine, TValue = unknown>(
  columnLines: TLine[],
  pairs: AnchoredItemPair<TLine, TValue>[],
  options?: SpatialEngineOptions<TValue>,
): StitchedItemBlock<TLine, TValue>[];
```

### `mergeBoundingBoxes`

Computes the mathematical union bounding box over multiple lines.

```typescript
function mergeBoundingBoxes(lines: OcrLine[], label?: string): BoundingBox;
```

### `mergeIsolatedCurrencySymbols`

Merges detached currency symbols (`$`, `USD`, `€`) with adjacent numeric digits.

```typescript
function mergeIsolatedCurrencySymbols<TLine extends OcrLine = OcrLine>(
  lines: TLine[],
  symbols?: string[],
): TLine[];
```

## Cross-Page Continuation

### `findPageBoundaryCandidates`

Identifies potential split items between contiguous pages and scores them with linguistic heuristics.

```typescript
function findPageBoundaryCandidates<TLine extends OcrLine = OcrLine, TValue = unknown>(
  pageN: ProcessedPageLayout<TLine, TValue>,
  pageNPlusOne: ProcessedPageLayout<TLine, TValue>,
  options?: SpatialEngineOptions<TValue>,
): CrossPageCandidatePair<TLine, TValue>[];
```

### `stitchCrossPageItemBlocks`

Performs in-place enrichment of Page N tail blocks and reclassifies Page N+1 head blocks as continuation context.

```typescript
function stitchCrossPageItemBlocks<TLine extends OcrLine = OcrLine, TValue = unknown>(
  pageN: ProcessedPageLayout<TLine, TValue>,
  pageNPlusOne: ProcessedPageLayout<TLine, TValue>,
  pairs: CrossPageCandidatePair<TLine, TValue>[],
): void;
```

## System 1 & Jev Primitives

### `noul`

Creates a calibrated probability `[0.0 - 1.0]` System 1 question.

```typescript
function noul(
  instructions: string | Record<string, unknown> | unknown[],
  criteria?: {
    true?: string | Record<string, unknown>;
    false?: string | Record<string, unknown>;
  },
): NoulQuestion;
```

### `choice`

Creates a multi-class categorical System 1 question.

```typescript
function choice(
  instructions: string | Record<string, unknown> | unknown[],
  criteria: Record<string, string | Record<string, unknown> | unknown[] | null>,
): ChoiceQuestion;
```

### `score`

Creates an ordinal scale System 1 question.

```typescript
function score(
  instructions: string | Record<string, unknown> | unknown[],
  criteria: Array<string | Record<string, unknown> | unknown[]>,
): ScoreQuestion;
```

### `buildContinuationRequest`

Builds the structured `SystemOneRequest` payload for candidate boundaries.

```typescript
function buildContinuationRequest(
  candidate: CrossPageCandidatePair,
  options?: SpatialEngineOptions<unknown>,
): SystemOneRequest;
```

### `createContinuationEvaluator`

Wraps a TypeSafe client or custom function into an automated continuation evaluator.

```typescript
function createContinuationEvaluator(
  clientOrFn: SystemOneClient | SystemOneEvaluateFn,
  options?: SpatialEngineOptions<unknown>,
): ContinuationEvaluator;
```

## Core Types

### `OcrLine`

```typescript
interface OcrLine {
  id: string | number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}
```

### `BoundingBox`

```typescript
interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

### `StitchedItemBlock`

```typescript
interface StitchedItemBlock<TLine = OcrLine, TValue = number> {
  id: string;
  title: string;
  description: string | null;
  value: TValue | null;
  price: number | null;
  isPriceRange?: boolean;
  box: BoundingBox;
  lines: TLine[];
  contextType?: "offering" | "continuation";
}
```

### `ProcessedPageLayout`

```typescript
interface ProcessedPageLayout<TLine = OcrLine, TValue = unknown> {
  pageNumber: number;
  columns: ColumnBand<TLine>[];
  itemBlocks: StitchedItemBlock<TLine, TValue>[];
  spanningLines: TLine[];
  unassignedLines: TLine[];
}
```
