import { describe, it, expect } from "vitest";
import {
  createContinuationEvaluator,
  buildContinuationRequest,
  stitchCrossPageDocument,
  type ProcessedPageLayout,
  type StitchedItemBlock,
  type SystemOneClient,
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

describe("Jev Evaluator & Document Stitching", () => {
  it("builds standard System One continuation request", () => {
    const cand = {
      pageN: {
        pageNumber: 1,
        block: createMockBlock(
          "tail",
          "Executive Suite",
          0.8,
          0.1,
          1500,
          "Includes breakfast, and",
        ),
      },
      pageNPlusOne: {
        pageNumber: 2,
        block: createMockBlock("head", "roundtrip airport transfers", 0.1, 0.05, null),
      },
      linguisticScore: 55,
      reasons: ["Trailing conjunction"],
    };

    const req = buildContinuationRequest(cand);
    expect(req.state).toBeDefined();
    expect(req.questions.isContinuation.type).toBe("noul");
    expect(req.questions.continuationType.type).toBe("choice");
  });

  it("creates evaluator from a TypeSafe client or evaluate function", async () => {
    // Mock client implementing TypeSafe SDK client.systemOne(...)
    const mockClient: SystemOneClient = {
      systemOne: async (_req) => ({
        model: "typesafe-ai/jev",
        answers: {
          isContinuation: { type: "noul", noul: 0.92 },
          continuationType: {
            type: "choice",
            choice: "descriptionContinuation",
            probabilities: { descriptionContinuation: 0.92, none: 0.08 },
            confidence: 0.9,
          },
        },
      }),
    };

    const evaluator = createContinuationEvaluator(mockClient);

    const cand = {
      pageN: {
        pageNumber: 1,
        block: createMockBlock(
          "tail",
          "Executive Suite",
          0.8,
          0.1,
          1500,
          "Includes breakfast, and",
        ),
      },
      pageNPlusOne: {
        pageNumber: 2,
        block: createMockBlock("head", "roundtrip airport transfers", 0.1, 0.05, null),
      },
      linguisticScore: 55,
      reasons: ["Trailing conjunction"],
    };

    const result = await evaluator(cand);
    expect(result.isContinuation).toBe(true);
    expect(result.probability).toBe(0.92);
    expect(result.continuationType).toBe("descriptionContinuation");
  });

  it("stitches multi-page document using stitchCrossPageDocument with pluggable evaluator", async () => {
    const mockClient: SystemOneClient = {
      evaluate: async () => ({
        model: "typesafe-ai/jev",
        answers: {
          isContinuation: { type: "noul", noul: 0.88 },
          continuationType: {
            type: "choice",
            choice: "descriptionContinuation",
            probabilities: { descriptionContinuation: 0.88, none: 0.12 },
            confidence: 0.88,
          },
        },
      }),
    };

    const tailBlock = createMockBlock(
      "tail_item",
      "Annual Support Contract",
      0.82,
      0.1,
      5000,
      "Covers telephone and email support, with",
    );
    const headBlock = createMockBlock("head_frag", "24/7 emergency response SLA", 0.05, 0.05, null);

    const pages: ProcessedPageLayout[] = [
      {
        pageNumber: 1,
        columns: [],
        spanningBlocks: [],
        itemBlocks: [tailBlock],
        contextBlocks: [],
      },
      {
        pageNumber: 2,
        columns: [],
        spanningBlocks: [],
        itemBlocks: [],
        contextBlocks: [headBlock],
      },
    ];

    const stitchedPages = await stitchCrossPageDocument(pages, mockClient);
    expect(stitchedPages.length).toBe(2);
    expect(tailBlock.description).toContain("24/7 emergency response SLA");
    expect(tailBlock.hasContinuation).toBe(true);
  });
});
