import type { OcrLine, ProcessedPageLayout, SpatialEngineOptions } from "../types.js";
import type { CrossPageCandidatePair } from "./types.js";

const UNIVERSAL_CONTINUATION_KEYWORDS = [
  "and",
  "or",
  "for",
  "with",
  "of",
  "during",
  "including",
  "without",
  "to",
  "within",
  "at",
  "plus",
  "also",
  "featuring",
  "contains?",
];

/**
 * Evaluates candidate blocks at the bottom of Page N and top of Page N+1
 * to identify potential cross-page line items or continuations.
 */
export function findPageBoundaryCandidates<TLine extends OcrLine = OcrLine, TValue = number>(
  pageN: ProcessedPageLayout<TLine, TValue>,
  pageNPlusOne: ProcessedPageLayout<TLine, TValue>,
  options?: SpatialEngineOptions<TValue>,
): CrossPageCandidatePair<TLine>[] {
  const candidates: CrossPageCandidatePair<TLine>[] = [];

  const allBlocksN = [...pageN.itemBlocks, ...pageN.spanningBlocks, ...pageN.contextBlocks];
  const tailBlocks = allBlocksN.filter((b) => b.box.y + b.box.height >= 0.6 || b.box.y >= 0.7);
  if (tailBlocks.length === 0 && allBlocksN.length > 0) {
    const lowest = [...allBlocksN].sort(
      (a, b) => b.box.y + b.box.height - (a.box.y + a.box.height),
    )[0];
    if (lowest) tailBlocks.push(lowest);
  }

  const allBlocksN1 = [
    ...pageNPlusOne.itemBlocks,
    ...pageNPlusOne.spanningBlocks,
    ...pageNPlusOne.contextBlocks,
  ];
  const headBlocks = allBlocksN1.filter((b) => b.box.y <= 0.35);
  if (headBlocks.length === 0 && allBlocksN1.length > 0) {
    const highest = [...allBlocksN1].sort((a, b) => a.box.y - b.box.y)[0];
    if (highest) headBlocks.push(highest);
  }

  const combinedKeywords = [
    ...UNIVERSAL_CONTINUATION_KEYWORDS,
    ...(options?.continuationKeywords ?? []),
  ];
  const continuationRegex = new RegExp(`^\\s*[)\\]]?\\s*(?:${combinedKeywords.join("|")})\\b`, "i");

  for (const tail of tailBlocks) {
    for (const head of headBlocks) {
      const reasons: string[] = [];
      let score = 0;

      // Horizontal alignment / compatibility check
      const xOverlap = Math.max(
        0,
        Math.min(tail.box.x + tail.box.width, head.box.x + head.box.width) -
          Math.max(tail.box.x, head.box.x),
      );
      const isHorizontallyCompatible =
        xOverlap > 0.05 ||
        (tail.box.width > 0.45 && head.box.width > 0.45) ||
        Math.abs(tail.box.x - head.box.x) <= 0.25;

      if (!isHorizontallyCompatible) continue;

      const tailText = (tail.description ? `${tail.title} ${tail.description}` : tail.title).trim();
      const headText = (head.description ? `${head.title} ${head.description}` : head.title).trim();

      // 1. Punctuation Break at Tail
      const endsWithTerminal = /[.!?]\s*[*#†‡"')]*$/.test(tailText);
      const endsWithNonTerminal = /[,;:\-–—\\]\s*[*#†‡"')]*$/.test(tailText);
      const endsWithOpenParen = /[([]\s*$/.test(tailText);
      const endsWithConjunction =
        /\b(?:and|or|with|for|of|during|including|without|to|within|at)\s*$/i.test(tailText);

      if (endsWithOpenParen) {
        score += 45;
        reasons.push("Tail ends with unmatched open parenthesis/bracket");
      } else if (endsWithConjunction) {
        score += 40;
        reasons.push("Tail ends with trailing conjunction/preposition");
      } else if (endsWithNonTerminal) {
        score += 35;
        reasons.push("Tail ends with non-terminal punctuation (comma/semicolon/dash)");
      } else if (!endsWithTerminal) {
        score += 25;
        reasons.push("Tail ends abruptly without terminal punctuation");
      }

      // 2. Head Continuation Inception
      const startsWithCloseParen = /^\s*[)\]]/.test(headText);
      const startsWithLower = /^\s*[a-z]/.test(headText);
      const startsWithContinuationKeyword = continuationRegex.test(headText);
      const startsWithSubBullet = /^\s*(?:[A-Z0-9]\.|\*|-|–)\s+/i.test(headText);

      if (startsWithCloseParen) {
        score += 45;
        reasons.push("Head begins with closing parenthesis/bracket");
      }
      if (startsWithLower) {
        score += 40;
        reasons.push("Head begins with lowercase letter");
      }
      if (startsWithContinuationKeyword) {
        score += 35;
        reasons.push("Head starts with continuation keyword");
      }
      if (startsWithSubBullet) {
        score += 20;
        reasons.push("Head starts with sub-option bullet");
      }

      // 3. Price / Title Complementarity
      if (tail.price === null && head.price !== null) {
        score += 30;
        reasons.push("Tail has title without price while head carries the price");
      } else if (tail.price !== null && head.price === null) {
        score += 25;
        reasons.push("Tail is priced while head is an unpriced description fragment");
      } else if (head.kind === "lineItem" && head.price === null) {
        score += 20;
        reasons.push("Head was classified as lineItem but lacks a price");
      }

      // 4. Listing / Specification Initiation
      if (
        /\b(?:includes?|features?|contains?|specifications?|charge\s+for\s+.*includes?|charge\s+includes?)\b/i.test(
          tailText,
        )
      ) {
        score += 30;
        reasons.push("Tail initiates package inclusion listing");
      }

      // Negative Penalties
      if (
        endsWithTerminal &&
        /^[A-Z]/.test(headText) &&
        head.price !== null &&
        tail.price !== null
      ) {
        score -= 60;
        reasons.push("Both blocks are independently terminated and priced");
      }

      if (score >= 35) {
        candidates.push({
          pageN: { pageNumber: pageN.pageNumber, block: tail },
          pageNPlusOne: { pageNumber: pageNPlusOne.pageNumber, block: head },
          linguisticScore: score,
          reasons,
        });
      }
    }
  }

  return candidates;
}
