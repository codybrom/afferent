import type { OcrLine, StitchedItemBlock } from "../types.js";

export interface CrossPageCandidatePair<TLine extends OcrLine = OcrLine, TValue = unknown> {
  pageN: { pageNumber: number; block: StitchedItemBlock<TLine, TValue> };
  pageNPlusOne: { pageNumber: number; block: StitchedItemBlock<TLine, TValue> };
  linguisticScore: number;
  reasons: string[];
}
