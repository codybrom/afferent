/**
 * afferent
 *
 * Sensory 2D spatial layout and perceptual engine for documents, tables, and visual structures.
 */

// Core Types
export type {
  OcrLine,
  BoundingBox,
  ColumnBand,
  AnchoredItemPair,
  StitchedItemBlock,
  ProcessedPageLayout,
  SpatialEngineOptions,
  ExtractedValue,
} from "./types.js";

// Presets
export { presets, priceListPreset, specSheetPreset, inventoryPreset } from "./presets/index.js";

// Geometry Primitives
export { mergeBoundingBoxes, mergeLines } from "./geometry/bounding-box.js";
export {
  isStandalonePriceLine,
  parsePriceFromText,
  defaultPriceValueMatcher,
  endsWithTerminalPunctuation,
  mergeIsolatedCurrencySymbols,
} from "./geometry/currency.js";
export { clusterColumns } from "./geometry/columns.js";
export { pairHorizontalPriceLines, pairHorizontalValues } from "./geometry/pairing.js";
export { stitchItemBlocks } from "./geometry/stitching.js";

// Cross-Page Continuations
export type { CrossPageCandidatePair } from "./continuations/types.js";
export { findPageBoundaryCandidates } from "./continuations/boundary-detector.js";
export { stitchCrossPageItemBlocks } from "./continuations/stitching.js";

// Jev & System 1 Integration
export type {
  Question,
  ChoiceQuestion,
  NoulQuestion,
  ScoreQuestion,
  Answer,
  ChoiceAnswer,
  NoulAnswer,
  ScoreAnswer,
  SystemOneRequest,
  SystemOneResponse,
} from "./jev/primitives.js";
export { choice, noul, score } from "./jev/primitives.js";
export type {
  SystemOneClient,
  SystemOneEvaluateFn,
  ContinuationEvaluator,
  ContinuationEvaluationResult,
} from "./jev/evaluator.js";
export { buildContinuationRequest, createContinuationEvaluator } from "./jev/evaluator.js";

// Top-Level Orchestration
export { processPageLayout, stitchCrossPageDocument } from "./engine.js";
