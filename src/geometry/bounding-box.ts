import type { OcrLine, BoundingBox } from "../types.js";

/**
 * Merge multiple OCR lines into a single enclosing bounding box.
 */
export function mergeBoundingBoxes(lines: OcrLine[], label?: string): BoundingBox | null {
  if (lines.length === 0) return null;

  const minX = Math.min(...lines.map((l) => l.x));
  const minY = Math.min(...lines.map((l) => l.y));
  const maxX = Math.max(...lines.map((l) => l.x + l.width));
  const maxY = Math.max(...lines.map((l) => l.y + l.height));

  return {
    id: `box_${crypto.randomUUID()}`,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    label,
  };
}

/** Alias for mergeBoundingBoxes for backward compatibility */
export const mergeLines = mergeBoundingBoxes;
