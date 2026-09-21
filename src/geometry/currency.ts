import type { OcrLine, ExtractedValue } from "../types.js";

const STANDALONE_PRICE_REGEX =
  /^\s*(?:(?:from|starts?\s+at|starting\s+at|as\s+low\s+as)\s+)?(?:\$\s?\d[\d,]*(?:\.\d{2})?|\d[\d,]*\.\d{2})(?:\s*(?:to|-|–)\s*\$?\s?\d[\d,]*(?:\.\d{2})?)?(?:\s*(?:and\s+up|&\s*up|\/\s*[a-zA-Z]+|per\s+[a-zA-Z]+|\(?plus\b[^\n)]*\)?|\(?each\)?))?\s*[*#†‡.]*\s*$/i;

const PRICE_RANGE_REGEX =
  /(?:\$\s?(\d[\d,]*)(?:\.\d{2})?|(\d[\d,]*\.\d{2}))\s*(?:to|-|–)\s*\$?\s?(\d[\d,]*)(?:\.\d{2})?/i;

/**
 * Checks whether a line ends with terminal punctuation (. ! ? : ;).
 */
export function endsWithTerminalPunctuation(text: string): boolean {
  return /[.!?:;…]["')\]]*$/.test(text.trim());
}

/**
 * Checks whether a line text is primarily a standalone price or free/included indicator.
 */
export function isStandalonePriceLine(text: string): boolean {
  const trimmed = text.trim();
  if (STANDALONE_PRICE_REGEX.test(trimmed)) return true;
  if (/^(?:\(?included\)?|\(?no\s+charge\)?|n\/c|free)$/i.test(trimmed)) return true;
  return false;
}

/**
 * Extracts numeric prices or price ranges from text.
 */
export function parsePriceFromText(text: string): {
  price: number | null;
  maximumPrice: number | null;
  isRange: boolean;
  rawPriceText: string | null;
} {
  const rangeMatch = text.match(PRICE_RANGE_REGEX);
  if (rangeMatch) {
    const rawMin = (rangeMatch[1] || rangeMatch[2] || "").replace(/,/g, "");
    const rawMax = (rangeMatch[3] || "").replace(/,/g, "");
    const min = Number(rawMin);
    const max = Number(rawMax);
    if (!isNaN(min) && !isNaN(max)) {
      return {
        price: min,
        maximumPrice: max,
        isRange: true,
        rawPriceText: rangeMatch[0].trim(),
      };
    }
  }

  // "Included" or "No Charge" represents 0 only if standalone or at line end,
  // not if inside an explanatory sentence (e.g. "This fee is already included in our charges").
  const isStandaloneIncluded =
    /(?:^|[\s([{-–—:])(?:included|no\s+charge|n\/c|free)[\s)\]}*#†‡]*$/i.test(text.trim()) &&
    !/\b(?:already|is|are|will\s+be)\s+included\s+in\b/i.test(text) &&
    !/\b(?:free\s+of\s+charge)\b/i.test(text);

  if (isStandaloneIncluded) {
    const incMatch = text.match(/\b(?:included|no\s+charge|n\/c|free)\b/i);
    return {
      price: 0,
      maximumPrice: null,
      isRange: false,
      rawPriceText: incMatch ? incMatch[0] : "Included",
    };
  }

  const priceMatch = text.match(/(?:\$\s?(\d[\d,]*)(?:\.\d{2})?|^\s*(\d[\d,]*)\.\d{2}\s*[*#†‡]*$)/);
  if (priceMatch) {
    const rawDigits = (priceMatch[1] || priceMatch[2] || "").replace(/,/g, "");
    const num = Number(rawDigits);
    if (!isNaN(num)) {
      return {
        price: num,
        maximumPrice: null,
        isRange: false,
        rawPriceText: priceMatch[0].trim(),
      };
    }
  }

  return {
    price: null,
    maximumPrice: null,
    isRange: false,
    rawPriceText: null,
  };
}

/**
 * Merges isolated currency symbols ('$', 'USD', '€', '£') on a horizontal baseline with adjacent numbers.
 */
export function mergeIsolatedCurrencySymbols(
  ocrLines: OcrLine[],
  currencySymbols = ["$", "USD", "€", "£"],
): OcrLine[] {
  const symbolSet = new Set(currencySymbols.map((s) => s.toUpperCase()));
  const currencyLines = ocrLines.filter((l) => symbolSet.has(l.text.trim().toUpperCase()));
  if (currencyLines.length === 0) return ocrLines;

  const mergedIds = new Set<number | string>();
  const updated = [...ocrLines];

  for (const c of currencyLines) {
    const candidate = updated.find(
      (l) =>
        l.id !== c.id &&
        !mergedIds.has(l.id) &&
        Math.abs(l.y - c.y) <= 0.015 &&
        l.x >= c.x &&
        l.x - (c.x + c.width) <= 0.15 &&
        /^\d/.test(l.text.trim()),
    );
    if (candidate) {
      const sym = c.text.trim();
      candidate.text = `${sym}${candidate.text.trim()}`;
      candidate.width = candidate.x + candidate.width - c.x;
      candidate.x = c.x;
      mergedIds.add(c.id);
    }
  }

  return updated.filter((l) => !mergedIds.has(l.id));
}

/**
 * Default price value matcher wrapping parsePriceFromText.
 */
export function defaultPriceValueMatcher(line: OcrLine): ExtractedValue<number> | null {
  const parsed = parsePriceFromText(line.text);
  if (parsed.price === null || parsed.rawPriceText === null) {
    return null;
  }
  return {
    rawText: parsed.rawPriceText,
    value: parsed.price,
    isRange: parsed.isRange,
    maxValue: parsed.maximumPrice ?? undefined,
  };
}
