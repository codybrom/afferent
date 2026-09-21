import type {
  OcrLine,
  ProcessedPageLayout,
  StitchedItemBlock,
  SpatialEngineOptions,
} from "./types.js";
import { mergeIsolatedCurrencySymbols } from "./geometry/currency.js";
import { clusterColumns } from "./geometry/columns.js";
import { pairHorizontalValues } from "./geometry/pairing.js";
import { stitchItemBlocks } from "./geometry/stitching.js";
import { mergeBoundingBoxes } from "./geometry/bounding-box.js";
import { findPageBoundaryCandidates } from "./continuations/boundary-detector.js";
import { stitchCrossPageItemBlocks } from "./continuations/stitching.js";
import type { CrossPageCandidatePair } from "./continuations/types.js";
import {
  createContinuationEvaluator,
  type ContinuationEvaluator,
  type SystemOneClient,
  type SystemOneEvaluateFn,
} from "./jev/evaluator.js";

/**
 * Recovers 2D spatial layout for an entire page of OCR text lines:
 * 1. Merges detached currency / value symbols
 * 2. Clusters columns & extracts spanning header/footer banners
 * 3. Pairs horizontal price/value lines on baselines
 * 4. Stitches multi-line items & descriptions
 * 5. Isolates unabsorbed text as context blocks (section headers, notes)
 */
export async function processPageLayout<TLine extends OcrLine = OcrLine, TValue = number>(
  ocrLines: TLine[],
  options?: SpatialEngineOptions<TValue>,
  pageNumber = 1,
): Promise<ProcessedPageLayout<TLine, TValue>> {
  const normalizedLines = mergeIsolatedCurrencySymbols(
    ocrLines,
    options?.currencySymbols,
  ) as TLine[];
  const { spanningLines, columns } = clusterColumns(normalizedLines, options);
  const itemBlocks: StitchedItemBlock<TLine, TValue>[] = [];
  const contextBlocks: StitchedItemBlock<TLine, TValue>[] = [];
  const spanningBlocks: StitchedItemBlock<TLine, TValue>[] = [];

  // Process spanning lines (header banners, disclaimers)
  if (spanningLines.length > 0) {
    const sortedSpanning = [...spanningLines].sort((a, b) => a.y - b.y);
    let currentSpanGroup: TLine[] = [];
    const spanGroups: TLine[][] = [];

    for (const line of sortedSpanning) {
      if (currentSpanGroup.length === 0) {
        currentSpanGroup.push(line);
      } else {
        const prev = currentSpanGroup[currentSpanGroup.length - 1];
        if (prev && line.y - (prev.y + prev.height) <= 0.08) {
          currentSpanGroup.push(line);
        } else {
          spanGroups.push(currentSpanGroup);
          currentSpanGroup = [line];
        }
      }
    }
    if (currentSpanGroup.length > 0) {
      spanGroups.push(currentSpanGroup);
    }

    for (const group of spanGroups) {
      const first = group[0];
      const box = mergeBoundingBoxes(group, "Page Header / Disclaimer");
      if (first && box) {
        spanningBlocks.push({
          id: `span_${String(first.id)}`,
          title: first.text,
          description:
            group
              .slice(1)
              .map((l) => l.text)
              .join(" ") || null,
          price: null,
          maximumPrice: null,
          rawPriceText: null,
          isPriceRange: false,
          kind: "context",
          contextCategory: "sectionHeader",
          lines: group,
          box,
        });
      }
    }
  }

  // Process each column independently
  for (const col of columns) {
    const { anchoredPairs, unpairedLines } = pairHorizontalValues(col.lines, options);
    const colItemBlocks = await stitchItemBlocks(col.lines, anchoredPairs, options);
    itemBlocks.push(...colItemBlocks);

    // Unpaired lines that were not absorbed into item blocks are context (section headers, notes)
    const usedLineIds = new Set(colItemBlocks.flatMap((b) => b.lines.map((l) => l.id)));
    const leftoverLines = unpairedLines.filter((l) => !usedLineIds.has(l.id));

    // Group consecutive leftover lines into context blocks
    let currentContextGroup: TLine[] = [];
    for (const line of leftoverLines) {
      if (currentContextGroup.length === 0) {
        currentContextGroup.push(line);
      } else {
        const prev = currentContextGroup[currentContextGroup.length - 1];
        if (prev && line.y - (prev.y + prev.height) <= 0.035) {
          currentContextGroup.push(line);
        } else {
          const firstInGroup = currentContextGroup[0];
          if (firstInGroup) {
            const cBox = mergeBoundingBoxes(currentContextGroup, firstInGroup.text);
            if (cBox) {
              contextBlocks.push({
                id: `ctx_${String(firstInGroup.id)}`,
                title: firstInGroup.text,
                description:
                  currentContextGroup
                    .slice(1)
                    .map((l) => l.text)
                    .join(" ") || null,
                price: null,
                maximumPrice: null,
                rawPriceText: null,
                isPriceRange: false,
                kind: "context",
                contextCategory: "sectionHeader",
                lines: currentContextGroup,
                box: cBox,
              });
            }
          }
          currentContextGroup = [line];
        }
      }
    }

    if (currentContextGroup.length > 0) {
      const firstInGroup = currentContextGroup[0];
      if (firstInGroup) {
        const cBox = mergeBoundingBoxes(currentContextGroup, firstInGroup.text);
        if (cBox) {
          contextBlocks.push({
            id: `ctx_${String(firstInGroup.id)}`,
            title: firstInGroup.text,
            description:
              currentContextGroup
                .slice(1)
                .map((l) => l.text)
                .join(" ") || null,
            price: null,
            maximumPrice: null,
            rawPriceText: null,
            isPriceRange: false,
            kind: "context",
            contextCategory: "sectionHeader",
            lines: currentContextGroup,
            box: cBox,
          });
        }
      }
    }
  }

  return {
    pageNumber,
    columns,
    spanningBlocks,
    itemBlocks,
    contextBlocks,
  };
}

/**
 * Stitches cross-page items across multi-page documents.
 * Analyzes consecutive page boundaries, optionally evaluates candidate continuations via Jev,
 * and stitches items in-place.
 */
export async function stitchCrossPageDocument<TLine extends OcrLine = OcrLine, TValue = number>(
  pages: ProcessedPageLayout<TLine, TValue>[],
  evaluatorOrClient?: ContinuationEvaluator | SystemOneClient | SystemOneEvaluateFn,
  options?: SpatialEngineOptions<TValue>,
): Promise<ProcessedPageLayout<TLine, TValue>[]> {
  if (pages.length <= 1) return pages;

  let evaluator: ContinuationEvaluator | undefined;
  if (evaluatorOrClient) {
    if (typeof evaluatorOrClient === "function") {
      // If it's a direct ContinuationEvaluator (accepts candidate) or SystemOneEvaluateFn (accepts request)
      evaluator =
        evaluatorOrClient.length === 1
          ? (evaluatorOrClient as ContinuationEvaluator)
          : createContinuationEvaluator(evaluatorOrClient as SystemOneEvaluateFn, options);
    } else {
      evaluator = createContinuationEvaluator(evaluatorOrClient, options);
    }
  }

  const sortedPages = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);

  for (let i = 0; i < sortedPages.length - 1; i++) {
    const curPage = sortedPages[i];
    const nextPage = sortedPages[i + 1];
    if (!curPage || !nextPage) continue;

    // Only process contiguous page pairs
    if (nextPage.pageNumber !== curPage.pageNumber + 1) continue;

    const candidates = findPageBoundaryCandidates(curPage, nextPage, options);
    const confirmedPairs: CrossPageCandidatePair<TLine>[] = [];

    for (const cand of candidates) {
      // Fast-path: clear syntactic indicators (e.g. score >= 70)
      if (cand.linguisticScore >= 70) {
        confirmedPairs.push(cand);
        continue;
      }

      // Semantic verification via Jev System One if an evaluator was provided
      if (evaluator) {
        const evalRes = await evaluator(cand);
        if (evalRes.isContinuation) {
          confirmedPairs.push(cand);
        }
      }
    }

    if (confirmedPairs.length > 0) {
      stitchCrossPageItemBlocks(curPage, nextPage, confirmedPairs);
    }
  }

  return sortedPages;
}
