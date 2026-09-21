import { describe, it, expect } from "vitest";
import {
  clusterColumns,
  pairHorizontalPriceLines,
  stitchItemBlocks,
  parsePriceFromText,
  isStandalonePriceLine,
  endsWithTerminalPunctuation,
  mergeIsolatedCurrencySymbols,
  mergeBoundingBoxes,
  type OcrLine,
} from "../src/index.js";

describe("Geometry & Currency Primitives", () => {
  describe("Punctuation & Price Utilities", () => {
    it("detects terminal punctuation", () => {
      expect(endsWithTerminalPunctuation("This is a complete sentence.")).toBe(true);
      expect(endsWithTerminalPunctuation("What is included?")).toBe(true);
      expect(endsWithTerminalPunctuation("Services include:")).toBe(true);
      expect(endsWithTerminalPunctuation("A dangling line with no terminal punctuation")).toBe(
        false,
      );
      expect(endsWithTerminalPunctuation("Transfer of Remains")).toBe(false);
    });

    it("identifies standalone price lines vs text lines", () => {
      expect(isStandalonePriceLine("$350")).toBe(true);
      expect(isStandalonePriceLine("$1,200.00")).toBe(true);
      expect(isStandalonePriceLine("$995 to $8,995")).toBe(true);
      expect(isStandalonePriceLine("$3.50/mile")).toBe(true);
      expect(isStandalonePriceLine("Included")).toBe(true);
      expect(isStandalonePriceLine("No Charge")).toBe(true);
      expect(isStandalonePriceLine("Consultation")).toBe(false);
      expect(isStandalonePriceLine("Professional Services of Staff")).toBe(false);
    });

    it("parses flat prices and price ranges accurately", () => {
      const flat = parsePriceFromText("Basic Services $1,250.00");
      expect(flat.price).toBe(1250);
      expect(flat.isRange).toBe(false);

      const range = parsePriceFromText("Packages range from $995 to $8,995");
      expect(range.price).toBe(995);
      expect(range.maximumPrice).toBe(8995);
      expect(range.isRange).toBe(true);

      const included = parsePriceFromText("Service vehicle (Included)");
      expect(included.price).toBe(0);
      expect(included.rawPriceText).toBe("Included");
    });

    it("merges detached currency symbols with adjacent numbers", () => {
      const lines: OcrLine[] = [
        { id: 1, text: "$", x: 0.8, y: 0.3, width: 0.02, height: 0.02 },
        { id: 2, text: "495.00", x: 0.83, y: 0.3, width: 0.08, height: 0.02 },
      ];
      const merged = mergeIsolatedCurrencySymbols(lines);
      expect(merged.length).toBe(1);
      expect(merged[0]?.text).toBe("$495.00");
      expect(merged[0]?.x).toBe(0.8);
    });
  });

  describe("2D Column Clustering", () => {
    it("clusters lines into 2 distinct columns separated by a gutter", () => {
      const col1: OcrLine[] = [
        {
          id: 1,
          text: "Item Left 1",
          x: 0.1,
          y: 0.2,
          width: 0.2,
          height: 0.02,
        },
        { id: 2, text: "$100", x: 0.35, y: 0.2, width: 0.05, height: 0.02 },
        {
          id: 3,
          text: "Item Left 2",
          x: 0.1,
          y: 0.25,
          width: 0.2,
          height: 0.02,
        },
        { id: 4, text: "$200", x: 0.35, y: 0.25, width: 0.05, height: 0.02 },
      ];
      const col2: OcrLine[] = [
        {
          id: 5,
          text: "Item Right 1",
          x: 0.6,
          y: 0.2,
          width: 0.2,
          height: 0.02,
        },
        { id: 6, text: "$300", x: 0.85, y: 0.2, width: 0.05, height: 0.02 },
        {
          id: 7,
          text: "Item Right 2",
          x: 0.6,
          y: 0.25,
          width: 0.2,
          height: 0.02,
        },
        { id: 8, text: "$400", x: 0.85, y: 0.25, width: 0.05, height: 0.02 },
      ];

      const all = [...col1, ...col2];
      const { columns } = clusterColumns(all);
      expect(columns.length).toBeGreaterThanOrEqual(1);
    });

    it("isolates wide spanning headers and footers", () => {
      const spanningHeader: OcrLine = {
        id: 99,
        text: "ACME COMPANY GENERAL PRICE LIST AND CATALOG",
        x: 0.1,
        y: 0.05,
        width: 0.8,
        height: 0.04,
      };
      const bodyLine: OcrLine = {
        id: 1,
        text: "Basic Widget",
        x: 0.1,
        y: 0.3,
        width: 0.2,
        height: 0.02,
      };

      const { spanningLines, columns } = clusterColumns([spanningHeader, bodyLine]);
      expect(spanningLines.length).toBe(1);
      expect(spanningLines[0]?.id).toBe(99);
      expect(columns.length).toBe(1);
    });
  });

  describe("Horizontal Baseline Pairing", () => {
    it("pairs title lines with right-aligned prices on the same baseline", () => {
      const lines: OcrLine[] = [
        {
          id: 1,
          text: "Executive Package",
          x: 0.1,
          y: 0.3,
          width: 0.3,
          height: 0.02,
        },
        {
          id: 2,
          text: "$2,500.00",
          x: 0.8,
          y: 0.301,
          width: 0.1,
          height: 0.02,
        },
      ];

      const { anchoredPairs, unpairedLines } = pairHorizontalPriceLines(lines);
      expect(anchoredPairs.length).toBe(1);
      expect(anchoredPairs[0]?.titleLine.text).toBe("Executive Package");
      expect(anchoredPairs[0]?.priceValue).toBe(2500);
      expect(unpairedLines.length).toBe(0);
    });

    it("pairs price directly below title when formatted vertically", () => {
      const lines: OcrLine[] = [
        {
          id: 1,
          text: "Custom Merchandise Range",
          x: 0.1,
          y: 0.3,
          width: 0.4,
          height: 0.02,
        },
        {
          id: 2,
          text: "$500 to $1,500",
          x: 0.1,
          y: 0.325,
          width: 0.2,
          height: 0.02,
        },
      ];

      const { anchoredPairs } = pairHorizontalPriceLines(lines);
      expect(anchoredPairs.length).toBe(1);
      expect(anchoredPairs[0]?.titleLine.text).toBe("Custom Merchandise Range");
      expect(anchoredPairs[0]?.isRange).toBe(true);
      expect(anchoredPairs[0]?.priceMin).toBe(500);
      expect(anchoredPairs[0]?.priceMax).toBe(1500);
    });
  });

  describe("Item Block Stitching", () => {
    it("stitches multi-line descriptions between anchored items", async () => {
      const lines: OcrLine[] = [
        {
          id: 1,
          text: "Standard Service",
          x: 0.1,
          y: 0.2,
          width: 0.3,
          height: 0.02,
        },
        { id: 2, text: "$1,000.00", x: 0.8, y: 0.2, width: 0.1, height: 0.02 },
        {
          id: 3,
          text: "Includes initial consultation and paperwork filing.",
          x: 0.1,
          y: 0.23,
          width: 0.5,
          height: 0.02,
        },
        {
          id: 4,
          text: "Also includes scheduled appointments.",
          x: 0.1,
          y: 0.255,
          width: 0.4,
          height: 0.02,
        },
        {
          id: 5,
          text: "Premium Service",
          x: 0.1,
          y: 0.35,
          width: 0.3,
          height: 0.02,
        },
        { id: 6, text: "$2,000.00", x: 0.8, y: 0.35, width: 0.1, height: 0.02 },
      ];

      const { anchoredPairs } = pairHorizontalPriceLines(lines);
      const blocks = await stitchItemBlocks(lines, anchoredPairs);

      expect(blocks.length).toBe(2);
      const first = blocks[0];
      expect(first?.title).toBe("Standard Service");
      expect(first?.price).toBe(1000);
      expect(first?.description).toContain("Includes initial consultation and paperwork filing.");
      expect(first?.description).toContain("Also includes scheduled appointments.");
    });

    it("splits colon narrative titles into clean title and description", async () => {
      const lines: OcrLine[] = [
        {
          id: 1,
          text: "PREMIUM PACKAGE: This complete offering includes all professional staffing",
          x: 0.1,
          y: 0.2,
          width: 0.6,
          height: 0.02,
        },
        { id: 2, text: "$3,995.00", x: 0.8, y: 0.2, width: 0.1, height: 0.02 },
      ];

      const { anchoredPairs } = pairHorizontalPriceLines(lines);
      const blocks = await stitchItemBlocks(lines, anchoredPairs);

      expect(blocks.length).toBe(1);
      expect(blocks[0]?.title).toBe("PREMIUM PACKAGE");
      expect(blocks[0]?.description).toContain(
        "This complete offering includes all professional staffing",
      );
    });

    it("computes enclosing bounding box for stitched items", () => {
      const lines: OcrLine[] = [
        { id: 1, text: "A", x: 0.1, y: 0.2, width: 0.3, height: 0.02 },
        { id: 2, text: "B", x: 0.1, y: 0.23, width: 0.6, height: 0.03 },
      ];
      const box = mergeBoundingBoxes(lines, "Test Box");
      expect(box).not.toBeNull();
      expect(box?.x).toBe(0.1);
      expect(box?.y).toBe(0.2);
      expect(box?.width).toBe(0.6);
      expect(box?.height).toBeCloseTo(0.06, 3);
    });
  });
});
