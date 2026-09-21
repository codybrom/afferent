import type { OcrLine, ProcessedPageLayout } from "../types.js";
import type { CrossPageCandidatePair } from "./types.js";
import { isStandalonePriceLine } from "../geometry/currency.js";

/**
 * Stitches cross-page candidate pairs in-place across two page layouts.
 * - Enriches Page N tail block with stitched title, price, description, and constituent lines.
 * - Reclassifies Page N+1 head block as a linked context continuation block.
 */
export function stitchCrossPageItemBlocks<TLine extends OcrLine = OcrLine, TValue = unknown>(
  pageN: ProcessedPageLayout<TLine, TValue>,
  pageNPlusOne: ProcessedPageLayout<TLine, TValue>,
  pairs: CrossPageCandidatePair<TLine, TValue>[],
): void {
  const stitchedHeadIds = new Set<string>();

  for (const pair of pairs) {
    const tail = pair.pageN.block;
    const head = pair.pageNPlusOne.block;

    if (stitchedHeadIds.has(head.id)) continue;
    stitchedHeadIds.add(head.id);

    // 1. Title combination if title-price split
    let unifiedTitle = tail.title;
    if (tail.price === null && head.price !== null) {
      const cleanedHeadTitle = head.title.replace(/^[\s)\]]+/, "").trim();
      if (cleanedHeadTitle.length > 0 && !isStandalonePriceLine(head.title)) {
        unifiedTitle = `${tail.title} ${cleanedHeadTitle}`.trim();
      }
    }

    // 2. Price combination
    const unifiedPrice = tail.price ?? head.price;
    const unifiedMaxPrice = tail.maximumPrice ?? head.maximumPrice;
    const unifiedRawPrice = tail.rawPriceText ?? head.rawPriceText;
    const unifiedIsRange = tail.isPriceRange || head.isPriceRange;

    // 3. Description stitching
    let unifiedDescription: string | null;
    const headDesc = head.description || "";
    const headTitleIsDesc = tail.price !== null || head.price === null;
    const headContent = headTitleIsDesc ? `${head.title} ${headDesc}`.trim() : headDesc.trim();

    if (tail.description && headContent) {
      unifiedDescription = `${tail.description} ${headContent}`.trim();
    } else if (headContent) {
      unifiedDescription = headContent;
    } else {
      unifiedDescription = tail.description;
    }

    // 4. Update Tail Block on Page N
    tail.title = unifiedTitle;
    tail.price = unifiedPrice;
    tail.maximumPrice = unifiedMaxPrice;
    tail.rawPriceText = unifiedRawPrice;
    tail.isPriceRange = unifiedIsRange;
    tail.description = unifiedDescription;
    tail.lines = [...tail.lines, ...head.lines];
    tail.hasContinuation = true;
    tail.continuedOnPage = pageNPlusOne.pageNumber;

    // 5. Reclassify Head Block on Page N+1 as linked continuation
    head.kind = "context";
    head.contextCategory = "continuation";
    head.continuationOf = tail.id;
    head.continuationFromPage = pageN.pageNumber;

    // Move head from itemBlocks to contextBlocks on Page N+1 if present
    const itemIdx = pageNPlusOne.itemBlocks.findIndex((b) => b.id === head.id);
    if (itemIdx >= 0) {
      pageNPlusOne.itemBlocks.splice(itemIdx, 1);
      if (!pageNPlusOne.contextBlocks.some((b) => b.id === head.id)) {
        pageNPlusOne.contextBlocks.push(head);
      }
    }
  }
}
