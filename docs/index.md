---
layout: page
sidebar: false
aside: false
---

<div class="af-home">

<section class="af-hero">
  <h1 class="af-hero-title">afferent</h1>
  <p class="af-hero-tagline">Recover columns, baselines, and reading order from raw OCR bounding boxes.</p>
  <div class="af-hero-actions">
    <a href="/guide/getting-started" class="af-btn af-btn-solid">Get started &rarr;</a>
    <code class="af-cmd">npm install afferent</code>
  </div>
</section>

<StageRow />

<div class="af-section-header">
  <span class="f1 fw8 tracked ttu">QUICK START</span>
</div>

<div class="af-code-wrap vp-doc">

```ts
import { processPageLayout, stitchCrossPageDocument } from "afferent";

// 1. Process 2D page geometry (columns, horizontal baselines, line clusters)
const layout = await processPageLayout(ocrLines);

// 2. Stitch ambiguous cross-page boundaries (with optional System 1 semantic resolution)
const pages = await stitchCrossPageDocument([page1, page2], client);
```

</div>

</div>
