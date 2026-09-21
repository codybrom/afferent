import type {
  OcrLine,
  AnchoredItemPair,
  StitchedItemBlock,
  SpatialEngineOptions,
} from "../types.js";
import { mergeBoundingBoxes } from "./bounding-box.js";

const DEFAULT_HEADER_REGEX = /^[I|V|X]+\.\s+[A-Z\s]+$/;

/**
 * Stitches multi-line descriptions and titles using spatial proximity and semantic autoformat rules.
 */
export async function stitchItemBlocks<TLine extends OcrLine = OcrLine, TValue = number>(
  columnLines: TLine[],
  anchoredPairs: AnchoredItemPair<TLine, TValue>[],
  options?: SpatialEngineOptions<TValue>,
): Promise<StitchedItemBlock<TLine, TValue>[]> {
  if (columnLines.length === 0) return [];

  const blocks: StitchedItemBlock<TLine, TValue>[] = [];
  const sortedPairs = [...anchoredPairs].sort((a, b) => a.titleLine.y - b.titleLine.y);
  const allAnchoredLineIds = new Set<unknown>();
  for (const p of anchoredPairs) {
    allAnchoredLineIds.add(p.titleLine.id);
    if (p.priceLine) allAnchoredLineIds.add(p.priceLine.id);
    if (p.sameLineAttributes) {
      for (const a of p.sameLineAttributes) allAnchoredLineIds.add(a.id);
    }
  }

  const maxVertDist = options?.maxLineVerticalDistance ?? 0.045;
  const headerPatterns = options?.sectionHeaderPatterns ?? [];

  // Map lines to their anchor
  for (let i = 0; i < sortedPairs.length; i++) {
    const pair = sortedPairs[i];
    if (!pair) continue;
    const nextPair = sortedPairs[i + 1];
    const lowerBoundY = nextPair ? nextPair.titleLine.y : 1.0;

    const associatedLines: TLine[] = [pair.titleLine];
    if (pair.priceLine && pair.priceLine.id !== pair.titleLine.id) {
      associatedLines.push(pair.priceLine);
    }
    if (pair.sameLineAttributes) {
      associatedLines.push(...pair.sameLineAttributes);
    }

    // Find lines sitting between this anchor and the next anchor in this column
    const candidates = columnLines.filter(
      (l) => l.y > pair.titleLine.y && l.y < lowerBoundY && !allAnchoredLineIds.has(l.id),
    );

    const descriptionLines: TLine[] = pair.sameLineAttributes ? [...pair.sameLineAttributes] : [];

    for (const cand of candidates) {
      const trimmed = cand.text.trim();
      // Check if candidate is a section header or disclaimer
      const isHeaderLike =
        DEFAULT_HEADER_REGEX.test(trimmed) ||
        headerPatterns.some((pattern) => pattern.test(trimmed));

      if (isHeaderLike) {
        break; // do not absorb section headers into description
      }

      // Proximity check: line should follow previous line vertically
      const prevLine =
        descriptionLines.length > 0
          ? descriptionLines[descriptionLines.length - 1]
          : pair.titleLine;
      const vertDistance = prevLine ? cand.y - (prevLine.y + prevLine.height) : 0;

      if (vertDistance <= maxVertDist) {
        descriptionLines.push(cand);
      }
    }

    associatedLines.push(...descriptionLines);

    // Clean title text: strip embedded price/value if present
    let cleanTitle = pair.titleLine.text;
    const valueTextToStrip = pair.rawValueText || pair.priceText;
    if (valueTextToStrip && cleanTitle.includes(valueTextToStrip)) {
      cleanTitle = cleanTitle.replace(valueTextToStrip, "");
    }
    cleanTitle = cleanTitle
      .replace(/^[\s.,;:–—/-]+/, "")
      .replace(/[\s.,;:–—/-]+$/, "")
      .trim();
    // Clean leading unit stubs left after prefix price stripping
    cleanTitle = cleanTitle.replace(
      /^\s*(?:\/\s*[a-zA-Z]+|\(per\s+\d+\)|per\s+[a-zA-Z]+)\s+([A-Z])/i,
      "$1",
    );
    if (!cleanTitle) {
      cleanTitle = pair.titleLine.text.trim() || "Item";
    }

    // 1. Recover stub titles (e.g. "from", "starts at", "ranges from") by checking for unanchored header directly above
    const isStub =
      /^(?:from|starts?\s+at|starting\s+(?:at|from)|ranges?\s+from|to|between)$/i.test(
        cleanTitle,
      ) || cleanTitle.length <= 4;
    if (isStub) {
      const prevHeader = columnLines
        .filter(
          (l) =>
            l.y < pair.titleLine.y &&
            pair.titleLine.y - (l.y + l.height) <= 0.035 &&
            !sortedPairs.some((p) => p.titleLine.id === l.id),
        )
        .sort((a, b) => b.y - a.y)[0];

      if (prevHeader && prevHeader.text.trim().length > 3) {
        cleanTitle = prevHeader.text.replace(/[:\s]+$/, "").trim();
        if (!associatedLines.some((l) => l.id === prevHeader.id)) {
          associatedLines.unshift(prevHeader);
        }
      }
    }

    // 2. Split run-on narrative titles containing a colon (e.g. "TITLE: Description narrative...")
    if (cleanTitle.includes(":") && cleanTitle.length > 35) {
      const colonIdx = cleanTitle.indexOf(":");
      const potentialTitle = cleanTitle.slice(0, colonIdx).trim();
      const narrativeAfterColon = cleanTitle.slice(colonIdx + 1).trim();
      if (potentialTitle.length >= 4 && narrativeAfterColon.length > 0) {
        cleanTitle = potentialTitle;
        descriptionLines.unshift({
          id: `split_${String(pair.titleLine.id)}` as unknown as TLine["id"],
          text: narrativeAfterColon,
          x: pair.titleLine.x,
          y: pair.titleLine.y,
          width: pair.titleLine.width,
          height: pair.titleLine.height,
        } as TLine);
      }
    }

    const descriptionText =
      descriptionLines.length > 0 ? descriptionLines.map((l) => l.text.trim()).join(" ") : null;

    const box = mergeBoundingBoxes(associatedLines, cleanTitle);
    if (box) {
      blocks.push({
        id: `item_${String(pair.titleLine.id)}`,
        title: cleanTitle,
        description: descriptionText,
        price: pair.priceValue,
        maximumPrice: pair.priceMax,
        rawPriceText: pair.priceText,
        value: pair.value,
        rawValueText: pair.rawValueText,
        isPriceRange: pair.isRange,
        kind: "lineItem",
        lines: associatedLines,
        box,
      });
    }
  }

  return blocks;
}
