# System 1 & Jev

Pure 2D geometry solves 90%+ of layout problems. But page breaks present cases of genuine semantic ambiguity:

- Is an unpriced sentence at the top of Page 2 the continuation of Page 1's final item, or an independent disclaimer?
- Is a bullet point a continuation of a package options tier, or a new product offering?

Passing entire high-resolution documents to multimodal LLMs is slow, costly, and error-prone. Instead, **afferent** delegates ambiguous boundary splits to Jev and System 1 micro-judgments.

## Evaluating Ambiguous Boundaries

Pass any client implementing the `SystemOneClient` interface (or `@typesafe-ai/sdk`'s `TypeSafeClient`) to `stitchCrossPageDocument`:

```typescript
import { processPageLayout, stitchCrossPageDocument } from "afferent";
import { TypeSafeClient } from "@typesafe-ai/sdk";

const page1 = await processPageLayout(page1Lines, undefined, 1);
const page2 = await processPageLayout(page2Lines, undefined, 2);

const client = new TypeSafeClient();

// High-confidence boundaries (score >= 70) stitch automatically.
// Ambiguous boundaries (35 <= score < 70) query Jev for semantic confirmation.
const stitchedPages = await stitchCrossPageDocument([page1, page2], client);
```

## System 1 Primitives

`afferent` exports the core primitive builders used to construct typed System 1 judgment questions:

### `noul` (Probability)

Evaluates the calibrated probability `[0.0 - 1.0]` of a condition being true:

```typescript
import { noul } from "afferent";

const isContinuation = noul("Does the text at the top of page N+1 continue the item from page N?", {
  true: "Incomplete sentence fragment or attribute belonging to preceding item",
  false: "Distinct independent offering or section header",
});
```

### `choice` (Categorization)

Selects a discrete category from defined criteria options, returning per-class probabilities:

```typescript
import { choice } from "afferent";

const continuationType = choice("What type of cross-page continuation is this?", {
  descriptionContinuation: "Narrative description or specs continue across the break",
  titlePriceSplit: "Title started on page N; value/price is on page N+1",
  packageOptionsSplit: "Package sub-options or attribute list continues",
  none: "Not a continuation",
});
```

### `score` (Ordinal Scale)

Evaluates position along an ordered scale:

```typescript
import { score } from "afferent";

const layoutConfidence = score("Rate the document layout regularity", [
  "Chaotic or corrupt text placement",
  "Partially misaligned columns or skewed baselines",
  "Regular, well-aligned tabular structure",
]);
```

## Inspecting Continuation Requests

You can inspect the exact payload sent to System 1 using `buildContinuationRequest`:

```typescript
import { findPageBoundaryCandidates, buildContinuationRequest } from "afferent";

const [candidate] = findPageBoundaryCandidates(page1, page2);
if (candidate) {
  const request = buildContinuationRequest(candidate, {
    documentContext: "commercial equipment catalog",
  });

  console.log(request.state);
  // {
  //   document_type: 'commercial equipment catalog',
  //   page_n_tail_text: 'Model X-200 Milling Machine with optional...',
  //   page_n1_head_text: 'coolant pump and extended bed. $48,500',
  //   ...
  // }
}
```
