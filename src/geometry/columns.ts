import type { OcrLine, ColumnBand, SpatialEngineOptions } from "../types.js";
import { parsePriceFromText, isStandalonePriceLine } from "./currency.js";

/**
 * Clusters OCR lines on a page into column bands via horizontal gutter histogram analysis.
 * Spanning lines (banners, full-width headers/disclaimers) are separated into spanningLines.
 */
export function clusterColumns<TLine extends OcrLine = OcrLine>(
  ocrLines: TLine[],
  _options?: SpatialEngineOptions<unknown>,
): {
  spanningLines: TLine[];
  columns: ColumnBand<TLine>[];
} {
  if (ocrLines.length === 0) {
    return { spanningLines: [], columns: [] };
  }

  const spanningLines: TLine[] = [];
  const contentLines: TLine[] = [];

  // 1. Separate full-width spanning lines (headers, large banners, footer disclaimers)
  for (const line of ocrLines) {
    const hasPrice =
      parsePriceFromText(line.text).price !== null || isStandalonePriceLine(line.text);
    if (
      !hasPrice &&
      ((line.y < 0.15 && line.width > 0.45) ||
        (line.y > 0.85 && line.width > 0.5) ||
        (line.width >= 0.7 && line.y < 0.18))
    ) {
      spanningLines.push(line);
    } else {
      contentLines.push(line);
    }
  }

  if (contentLines.length === 0) {
    return {
      spanningLines: spanningLines.sort((a, b) => a.y - b.y),
      columns: [],
    };
  }

  // 2. Discover column boundaries using horizontal gutter analysis
  const samples: Array<{ x: number; count: number }> = [];
  for (let x = 0.2; x <= 0.8; x += 0.01) {
    const active = contentLines.filter((l) => l.x <= x && l.x + l.width >= x).length;
    samples.push({ x: Number(x.toFixed(3)), count: active });
  }

  function isNonPriceContentLine(line: TLine): boolean {
    const trimmed = line.text.trim();
    if (trimmed.length <= 3) return false;
    if (isStandalonePriceLine(trimmed)) return false;
    if (/^\s*\$?\s*[\d,]+(?:\.\d{2})?\s*[*#†‡]*$/.test(trimmed)) return false;
    if (/^\s*(?:Included|No Charge|N\/C|Free|Market Value)\s*$/i.test(trimmed)) return false;
    return true;
  }

  const gutterX: Array<{ x: number; count: number }> = [];
  for (let i = 2; i < samples.length - 2; i++) {
    const curr = samples[i];
    if (curr && curr.count <= 6) {
      const leftSlice = samples.slice(Math.max(0, i - 15), i);
      const rightSlice = samples.slice(i + 1, Math.min(samples.length, i + 16));
      const leftMax = leftSlice.length > 0 ? Math.max(...leftSlice.map((s) => s.count)) : 0;
      const rightMax = rightSlice.length > 0 ? Math.max(...rightSlice.map((s) => s.count)) : 0;
      if (leftMax >= 10 && rightMax >= 10) {
        const leftTextCount = contentLines.filter(
          (l) => l.x + l.width <= curr.x + 0.02 && isNonPriceContentLine(l),
        ).length;
        const rightTextCount = contentLines.filter(
          (l) => l.x >= curr.x - 0.02 && isNonPriceContentLine(l),
        ).length;
        const leftPriceCount = contentLines.filter(
          (l) =>
            l.x + l.width <= curr.x + 0.05 &&
            (isStandalonePriceLine(l.text) || parsePriceFromText(l.text).price !== null),
        ).length;
        const rightPriceCount = contentLines.filter(
          (l) =>
            l.x >= curr.x - 0.05 &&
            (isStandalonePriceLine(l.text) || parsePriceFromText(l.text).price !== null),
        ).length;
        if (
          leftTextCount >= 8 &&
          rightTextCount >= 8 &&
          leftPriceCount >= 1 &&
          rightPriceCount >= 1
        ) {
          gutterX.push(curr);
        }
      }
    }
  }

  // Cluster adjacent gutter sample points into single split points
  const splitPoints: number[] = [];
  let cur: Array<{ x: number; count: number }> = [];
  for (const g of gutterX) {
    if (cur.length === 0) {
      cur.push(g);
    } else {
      const prev = cur[cur.length - 1];
      if (prev && Math.abs(g.x - prev.x) <= 0.03) {
        cur.push(g);
      } else {
        cur.sort((a, b) => a.count - b.count);
        const best = cur[0];
        if (best) splitPoints.push(best.x);
        cur = [g];
      }
    }
  }
  if (cur.length > 0) {
    cur.sort((a, b) => a.count - b.count);
    const best = cur[0];
    if (best) splitPoints.push(best.x);
  }

  // Build columns from split points
  const columns: ColumnBand<TLine>[] = [];
  if (splitPoints.length === 0) {
    columns.push({
      columnIndex: 0,
      minX: 0,
      maxX: 1.0,
      lines: [...contentLines].sort((a, b) => a.y - b.y),
    });
  } else {
    let prevX = 0;
    for (let i = 0; i <= splitPoints.length; i++) {
      const nextX = i < splitPoints.length ? (splitPoints[i] ?? 1.0) : 1.0;
      const colLines = contentLines
        .filter((l) => l.x >= prevX && (i === splitPoints.length ? true : l.x < nextX))
        .sort((a, b) => a.y - b.y);

      columns.push({
        columnIndex: i,
        minX: prevX,
        maxX: nextX,
        lines: colLines,
      });
      prevX = nextX;
    }
  }

  return {
    spanningLines: spanningLines.sort((a, b) => a.y - b.y),
    columns,
  };
}
