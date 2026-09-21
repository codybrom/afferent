import { describe, it, expect } from "vitest";
import {
  findPageBoundaryCandidates,
  stitchCrossPageItemBlocks,
  type ProcessedPageLayout,
  type StitchedItemBlock,
} from "../src/index.js";

function createMockBlock(
  id: string,
  title: string,
  y: number,
  height: number,
  price: number | null = null,
  description: string | null = null,
): StitchedItemBlock {
  return {
    id,
    title,
    description,
    price,
    maximumPrice: null,
    rawPriceText: price !== null ? `$${price}` : null,
    isPriceRange: false,
    kind: price !== null ? "lineItem" : "context",
    lines: [
      {
        id: `line_${id}`,
        text: description ? `${title} ${description}` : title,
        x: 0.1,
        y,
        width: 0.8,
        height,
      },
    ],
    box: {
      id: `box_${id}`,
      x: 0.1,
      y,
      width: 0.8,
      height,
      label: title,
    },
  };
}

describe("Cross-Page Boundary Detection & Continuation Stitching", () => {
  it("identifies candidate when tail ends abruptly and head starts with lowercase or continuation word", () => {
    const tailBlock = createMockBlock(
      "tail_1",
      "Complete Corporate Package",
      0.75,
      0.15,
      2500,
      "Includes all administrative filing, consultation, and",
    );
    const headBlock = createMockBlock(
      "head_1",
      "preparation of all necessary statutory documents",
      0.08,
      0.05,
      null,
    );

    const page1: ProcessedPageLayout = {
      pageNumber: 1,
      columns: [],
      spanningBlocks: [],
      itemBlocks: [tailBlock],
      contextBlocks: [],
    };

    const page2: ProcessedPageLayout = {
      pageNumber: 2,
      columns: [],
      spanningBlocks: [],
      itemBlocks: [],
      contextBlocks: [headBlock],
    };

    const candidates = findPageBoundaryCandidates(page1, page2);
    expect(candidates.length).toBe(1);
    const cand = candidates[0];
    expect(cand?.linguisticScore).toBeGreaterThanOrEqual(70);
    expect(cand?.pageN.block.id).toBe("tail_1");
    expect(cand?.pageNPlusOne.block.id).toBe("head_1");
  });

  it("stitches cross-page continuation in-place into Page N tail block", () => {
    const tailBlock = createMockBlock(
      "tail_1",
      "Complete Corporate Package",
      0.75,
      0.15,
      2500,
      "Includes all administrative filing, and",
    );
    const headBlock = createMockBlock("head_1", "preparation of documents", 0.08, 0.05, null);

    const page1: ProcessedPageLayout = {
      pageNumber: 1,
      columns: [],
      spanningBlocks: [],
      itemBlocks: [tailBlock],
      contextBlocks: [],
    };

    const page2: ProcessedPageLayout = {
      pageNumber: 2,
      columns: [],
      spanningBlocks: [],
      itemBlocks: [headBlock],
      contextBlocks: [],
    };

    const candidates = findPageBoundaryCandidates(page1, page2);
    stitchCrossPageItemBlocks(page1, page2, candidates);

    // Tail block should now contain merged description and metadata
    expect(tailBlock.description).toContain("preparation of documents");
    expect(tailBlock.hasContinuation).toBe(true);
    expect(tailBlock.continuedOnPage).toBe(2);

    // Head block should be converted to continuation context
    expect(headBlock.kind).toBe("context");
    expect(headBlock.contextCategory).toBe("continuation");
    expect(headBlock.continuationOf).toBe("tail_1");
    expect(headBlock.continuationFromPage).toBe(1);

    // Head block should be removed from itemBlocks on Page 2
    expect(page2.itemBlocks.length).toBe(0);
    expect(page2.contextBlocks.length).toBe(1);
  });
});
