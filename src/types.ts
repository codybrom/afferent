/**
 * Core type definitions for the Jev Spatial Engine.
 */

/**
 * An individual OCR text line with normalized coordinates [0.0, 1.0].
 */
export interface OcrLine<TId = number | string> {
  id: TId;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
}

/**
 * A rectangular bounding box on normalized coordinates.
 */
export interface BoundingBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
}

/**
 * A vertical column band discovered through horizontal gutter analysis.
 */
export interface ColumnBand<TLine extends OcrLine = OcrLine> {
  columnIndex: number;
  minX: number;
  maxX: number;
  lines: TLine[];
}

/**
 * An extracted value (e.g. price, dimension, quantity, SKU) from an OCR line.
 */
export interface ExtractedValue<T = number> {
  rawText: string;
  value: T;
  isRange?: boolean;
  maxValue?: T;
}

/**
 * An anchored pairing between a title/label line and its corresponding price or value line.
 */
export interface AnchoredItemPair<TLine extends OcrLine = OcrLine, TValue = number> {
  titleLine: TLine;
  priceLine: TLine | null;
  valueLine?: TLine | null;
  priceText: string | null;
  rawValueText?: string | null;
  priceValue: number | null;
  value?: TValue | null;
  isRange: boolean;
  priceMin: number | null;
  priceMax: number | null;
  deltaY: number;
  sameLineAttributes?: TLine[];
}

/**
 * A recovered semantic item block combining title, description, price/value, and exact geometry.
 */
export interface StitchedItemBlock<TLine extends OcrLine = OcrLine, TValue = number> {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  maximumPrice: number | null;
  rawPriceText: string | null;
  value?: TValue | null;
  rawValueText?: string | null;
  isPriceRange: boolean;
  kind: "lineItem" | "bundle" | "package" | "context";
  contextCategory?: "sectionHeader" | "policy" | "disclaimer" | "note" | "continuation" | "none";
  lines: TLine[];
  box: BoundingBox;
  continuationOf?: string;
  continuedOnPage?: number;
  continuationFromPage?: number;
  hasContinuation?: boolean;
}

/**
 * The complete spatial layout extracted for a single page.
 */
export interface ProcessedPageLayout<TLine extends OcrLine = OcrLine, TValue = number> {
  pageNumber: number;
  columns: ColumnBand<TLine>[];
  spanningBlocks: StitchedItemBlock<TLine, TValue>[];
  itemBlocks: StitchedItemBlock<TLine, TValue>[];
  contextBlocks: StitchedItemBlock<TLine, TValue>[];
}

/**
 * Configuration options for the spatial layout engine.
 */
export interface SpatialEngineOptions<TValue = number> {
  /**
   * Custom value matcher to pair against titles on the horizontal baseline.
   * Defaults to standard currency/price matching ($1,200.00, 45.00, etc.).
   */
  valueMatcher?: (line: OcrLine) => ExtractedValue<TValue> | null;

  /**
   * Optional context passed to Jev micro-models to tune disambiguation.
   * e.g., "funeral home general price list", "restaurant catering menu", "hardware spec sheet".
   */
  documentContext?: string;

  /**
   * Custom regular expressions to treat lines as section headers/banners
   * preventing them from being absorbed into descriptions.
   */
  sectionHeaderPatterns?: RegExp[];

  /**
   * Custom domain keywords indicating continuation across lines or pages.
   */
  continuationKeywords?: string[];

  /**
   * Maximum vertical distance (|y2 - (y1 + h1)|) to stitch multi-line descriptions (default: 0.045).
   */
  maxLineVerticalDistance?: number;

  /**
   * Maximum baseline delta |y1 - y2| to pair horizontal title and value (default: 0.012).
   */
  horizontalDeltaY?: number;

  /**
   * Currency or value symbols to merge if detached (default: ['$', 'USD', '€', '£']).
   */
  currencySymbols?: string[];
}
