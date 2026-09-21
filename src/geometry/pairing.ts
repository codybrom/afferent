import type { OcrLine, AnchoredItemPair, SpatialEngineOptions, ExtractedValue } from "../types.js";
import { isStandalonePriceLine, parsePriceFromText, defaultPriceValueMatcher } from "./currency.js";

const EMBEDDED_PRICE_REGEX =
  /\$\s?\d[\d,]*(?:\.\d{2})?(?:\s*\/\s*[a-zA-Z]+)?|\b\d[\d,]*\.\d{2}\b|\b(?:included|no\s+charge|n\/c|free)\b/i;

/**
 * Pairs horizontal price or value lines with their corresponding title lines (|Δy| <= threshold).
 * Supports custom valueMatcher or defaults to standard currency pricing.
 */
export function pairHorizontalValues<TLine extends OcrLine = OcrLine, TValue = number>(
  lines: TLine[],
  options?: SpatialEngineOptions<TValue>,
): {
  anchoredPairs: AnchoredItemPair<TLine, TValue>[];
  unpairedLines: TLine[];
} {
  const baselineDeltaY = options?.horizontalDeltaY ?? 0.012;
  const maxRowDeltaY = baselineDeltaY + 0.003; // 0.015 by default

  const matcher =
    options?.valueMatcher ??
    (defaultPriceValueMatcher as unknown as (line: OcrLine) => ExtractedValue<TValue> | null);

  const isStandaloneValue = (l: TLine): boolean => {
    if (options?.valueMatcher) {
      return options.valueMatcher(l) !== null;
    }
    return isStandalonePriceLine(l.text);
  };

  const anchoredPairs: AnchoredItemPair<TLine, TValue>[] = [];
  const valueLines = lines.filter(isStandaloneValue);
  const nonValueLines = lines.filter((l) => !isStandaloneValue(l));

  const usedValueIds = new Set<unknown>();
  const usedTitleIds = new Set<unknown>();

  // Helper to extract value metadata from a line
  const extractLineValue = (
    l: TLine,
  ): {
    rawText: string | null;
    val: TValue | null;
    isRange: boolean;
    maxVal: TValue | null;
    priceNum: number | null;
    priceMaxNum: number | null;
  } => {
    const match = matcher(l);
    if (match) {
      const pNum = typeof match.value === "number" ? match.value : null;
      const pMax = typeof match.maxValue === "number" ? match.maxValue : null;
      return {
        rawText: match.rawText,
        val: match.value,
        isRange: match.isRange ?? false,
        maxVal: match.maxValue ?? null,
        priceNum: pNum,
        priceMaxNum: pMax,
      };
    }
    const parsed = parsePriceFromText(l.text);
    return {
      rawText: parsed.rawPriceText,
      val: parsed.price as unknown as TValue | null,
      isRange: parsed.isRange,
      maxVal: parsed.maximumPrice as unknown as TValue | null,
      priceNum: parsed.price,
      priceMaxNum: parsed.maximumPrice,
    };
  };

  // 1. Check for standalone value lines pairing with title lines on the same horizontal baseline
  const sortedValueLines = [...valueLines].sort((a, b) => a.y - b.y || a.x - b.x);

  for (const valueLine of sortedValueLines) {
    if (usedValueIds.has(valueLine.id)) continue;

    // Find non-value candidates on this horizontal baseline (|Δy| <= maxRowDeltaY)
    const rowCandidates = nonValueLines.filter((c) => {
      if (usedTitleIds.has(c.id)) return false;
      return Math.abs(c.y - valueLine.y) <= maxRowDeltaY;
    });

    if (rowCandidates.length === 0) continue;

    // Find all values sharing this horizontal row
    const rowValues = valueLines.filter((p) => Math.abs(p.y - valueLine.y) <= baselineDeltaY);

    // A candidate is valid for valueLine if no other value on the baseline lies horizontally between them
    const validCandidates = rowCandidates.filter((c) => {
      const minX = Math.min(c.x, valueLine.x);
      const maxX = Math.max(c.x, valueLine.x);
      const hasInterveningValue = rowValues.some((otherV) => {
        if (otherV.id === valueLine.id) return false;
        return otherV.x > minX + 0.02 && otherV.x < maxX - 0.02;
      });
      return !hasInterveningValue;
    });

    if (validCandidates.length === 0) continue;

    // Prefer candidates to the left of valueLine (standard LTR), fallback to all valid candidates (reverse layout)
    const leftCandidates = validCandidates.filter((c) => c.x <= valueLine.x + 0.05);
    const candidatePool = leftCandidates.length > 0 ? leftCandidates : validCandidates;

    // Find the best candidate baseline alignment
    let bestCandidate = candidatePool[0];
    let minDeltaY = maxRowDeltaY;
    for (const candidate of candidatePool) {
      const deltaY = Math.abs(candidate.y - valueLine.y);
      if (deltaY < minDeltaY) {
        minDeltaY = deltaY;
        bestCandidate = candidate;
      }
    }

    if (!bestCandidate) continue;

    // Find all candidates sharing this row within the candidate pool
    const baselineCandidates = candidatePool.filter(
      (c) => Math.abs(c.y - bestCandidate.y) <= 0.004,
    );
    if (!baselineCandidates.some((c) => c.id === bestCandidate.id)) {
      baselineCandidates.push(bestCandidate);
    }

    // Sort candidates from left to right
    baselineCandidates.sort((a, b) => a.x - b.x);

    // Select primary title (filter out stubs like "Add", "Min fee", "options available" if others exist)
    const nonStubCandidates = baselineCandidates.filter(
      (c) =>
        !/^(?:add|min(?:imum)?\s+fee|minimum|options?\s+available|.*color\s+options.*)$/i.test(
          c.text.trim(),
        ),
    );
    const primaryTitle =
      (nonStubCandidates.length > 0 ? nonStubCandidates[0] : baselineCandidates[0]) ??
      bestCandidate;
    const sameLineAttributes = baselineCandidates.filter((c) => c.id !== primaryTitle.id);

    const extracted = extractLineValue(valueLine);
    anchoredPairs.push({
      titleLine: primaryTitle,
      priceLine: valueLine,
      valueLine,
      priceText: extracted.rawText,
      rawValueText: extracted.rawText,
      priceValue: extracted.priceNum,
      value: extracted.val,
      isRange: extracted.isRange,
      priceMin: extracted.priceNum,
      priceMax: extracted.priceMaxNum,
      deltaY: Math.abs(primaryTitle.y - valueLine.y),
      sameLineAttributes: sameLineAttributes.length > 0 ? sameLineAttributes : undefined,
    });
    usedValueIds.add(valueLine.id);
    usedTitleIds.add(primaryTitle.id);
    for (const attr of sameLineAttributes) {
      usedTitleIds.add(attr.id);
    }
  }

  // 2. Check remaining unused value lines for a title line sitting directly above them (vertical layout)
  for (const valueLine of valueLines) {
    if (usedValueIds.has(valueLine.id)) continue;
    let closestTitleAbove: TLine | null = null;
    let minDeltaY = 0.035;

    for (const candidate of nonValueLines) {
      if (usedTitleIds.has(candidate.id)) continue;
      if (
        candidate.y < valueLine.y &&
        valueLine.y - (candidate.y + candidate.height) <= minDeltaY
      ) {
        const deltaY = valueLine.y - (candidate.y + candidate.height);
        if (deltaY < minDeltaY) {
          minDeltaY = deltaY;
          closestTitleAbove = candidate;
        }
      }
    }

    if (closestTitleAbove) {
      const extracted = extractLineValue(valueLine);
      anchoredPairs.push({
        titleLine: closestTitleAbove,
        priceLine: valueLine,
        valueLine,
        priceText: extracted.rawText,
        rawValueText: extracted.rawText,
        priceValue: extracted.priceNum,
        value: extracted.val,
        isRange: extracted.isRange,
        priceMin: extracted.priceNum,
        priceMax: extracted.priceMaxNum,
        deltaY: minDeltaY,
      });
      usedValueIds.add(valueLine.id);
      usedTitleIds.add(closestTitleAbove.id);
    }
  }

  // 3. Check remaining non-value lines for embedded values on the line itself
  for (const line of nonValueLines) {
    if (usedTitleIds.has(line.id)) continue;
    if (options?.valueMatcher) {
      const match = options.valueMatcher(line);
      if (match) {
        const pNum = typeof match.value === "number" ? match.value : null;
        anchoredPairs.push({
          titleLine: line,
          priceLine: null,
          valueLine: null,
          priceText: match.rawText,
          rawValueText: match.rawText,
          priceValue: pNum,
          value: match.value,
          isRange: match.isRange ?? false,
          priceMin: pNum,
          priceMax: typeof match.maxValue === "number" ? match.maxValue : null,
          deltaY: 0,
        });
        usedTitleIds.add(line.id);
      }
    } else if (EMBEDDED_PRICE_REGEX.test(line.text)) {
      const parsed = parsePriceFromText(line.text);
      if (parsed.price !== null || parsed.rawPriceText) {
        anchoredPairs.push({
          titleLine: line,
          priceLine: null,
          valueLine: null,
          priceText: parsed.rawPriceText,
          rawValueText: parsed.rawPriceText,
          priceValue: parsed.price,
          value: parsed.price as unknown as TValue,
          isRange: parsed.isRange,
          priceMin: parsed.price,
          priceMax: parsed.maximumPrice,
          deltaY: 0,
        });
        usedTitleIds.add(line.id);
      }
    }
  }

  const unpairedLines = lines.filter((l) => !usedTitleIds.has(l.id) && !usedValueIds.has(l.id));

  // Sort pairs top-to-bottom
  anchoredPairs.sort((a, b) => a.titleLine.y - b.titleLine.y);

  return {
    anchoredPairs,
    unpairedLines: unpairedLines.sort((a, b) => a.y - b.y),
  };
}

/**
 * Pairs horizontal price lines with their corresponding title lines.
 * Backwards-compatible alias for pairHorizontalValues.
 */
export function pairHorizontalPriceLines<TLine extends OcrLine = OcrLine>(
  lines: TLine[],
  options?: SpatialEngineOptions,
): {
  anchoredPairs: AnchoredItemPair<TLine>[];
  unpairedLines: TLine[];
} {
  return pairHorizontalValues<TLine, number>(lines, options);
}
