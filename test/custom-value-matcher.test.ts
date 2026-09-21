import { describe, it, expect } from "vitest";
import {
  processPageLayout,
  specSheetPreset,
  inventoryPreset,
  buildContinuationRequest,
  type OcrLine,
  type CrossPageCandidatePair,
} from "../src/index.js";

describe("Pluggable Value Matchers & Presets", () => {
  it("processes technical specification sheets using specSheetPreset", async () => {
    const specLines: OcrLine[] = [
      { id: 1, text: "ELECTRICAL SPECIFICATIONS", x: 0.1, y: 0.1, width: 0.8, height: 0.04 },
      { id: 2, text: "Input Voltage", x: 0.1, y: 0.2, width: 0.25, height: 0.02 },
      { id: 3, text: "240 VAC", x: 0.75, y: 0.2, width: 0.15, height: 0.02 },
      {
        id: 4,
        text: "Standard single-phase wall power",
        x: 0.1,
        y: 0.23,
        width: 0.45,
        height: 0.02,
      },
      { id: 5, text: "Operating Frequency", x: 0.1, y: 0.3, width: 0.3, height: 0.02 },
      { id: 6, text: "60Hz", x: 0.75, y: 0.3, width: 0.1, height: 0.02 },
      { id: 7, text: "Weight", x: 0.1, y: 0.4, width: 0.15, height: 0.02 },
      { id: 8, text: "15 lbs", x: 0.75, y: 0.4, width: 0.1, height: 0.02 },
    ];

    const layout = await processPageLayout(specLines, specSheetPreset);

    expect(layout.itemBlocks).toHaveLength(3);
    const voltageItem = layout.itemBlocks.find((b) => b.title === "Input Voltage");
    expect(voltageItem).toBeDefined();
    expect(voltageItem?.rawValueText).toBe("240 VAC");
    expect(voltageItem?.value).toBe("240 VAC");
    expect(voltageItem?.description).toBe("Standard single-phase wall power");

    const freqItem = layout.itemBlocks.find((b) => b.title === "Operating Frequency");
    expect(freqItem).toBeDefined();
    expect(freqItem?.rawValueText).toBe("60Hz");

    const weightItem = layout.itemBlocks.find((b) => b.title === "Weight");
    expect(weightItem).toBeDefined();
    expect(weightItem?.rawValueText).toBe("15 lbs");
  });

  it("processes inventory manifests using inventoryPreset", async () => {
    const inventoryLines: OcrLine[] = [
      { id: 1, text: "M4 Steel Screws", x: 0.1, y: 0.2, width: 0.3, height: 0.02 },
      { id: 2, text: "500 pcs", x: 0.8, y: 0.2, width: 0.12, height: 0.02 },
      { id: 3, text: "Corrosion resistant grade 316", x: 0.1, y: 0.23, width: 0.4, height: 0.02 },
      { id: 4, text: "Mounting Brackets", x: 0.1, y: 0.3, width: 0.25, height: 0.02 },
      { id: 5, text: "24 units", x: 0.8, y: 0.3, width: 0.12, height: 0.02 },
    ];

    const layout = await processPageLayout(inventoryLines, inventoryPreset);

    expect(layout.itemBlocks).toHaveLength(2);
    const screws = layout.itemBlocks.find((b) => b.title === "M4 Steel Screws");
    expect(screws).toBeDefined();
    expect(screws?.value).toBe(500);
    expect(screws?.rawValueText).toBe("500 pcs");
    expect(screws?.description).toBe("Corrosion resistant grade 316");

    const brackets = layout.itemBlocks.find((b) => b.title === "Mounting Brackets");
    expect(brackets).toBeDefined();
    expect(brackets?.value).toBe(24);
    expect(brackets?.rawValueText).toBe("24 units");
  });

  it("passes documentContext to Jev System One continuation request", () => {
    const candidate: CrossPageCandidatePair = {
      pageN: {
        pageNumber: 1,
        block: {
          id: "tail",
          title: "Model X-500 Server Rack",
          description: "Includes high-velocity cooling fans,",
          price: 4500,
          maximumPrice: null,
          rawPriceText: "$4,500.00",
          isPriceRange: false,
          kind: "lineItem",
          lines: [],
          box: { id: "b1", x: 0.1, y: 0.85, width: 0.8, height: 0.1 },
        },
      },
      pageNPlusOne: {
        pageNumber: 2,
        block: {
          id: "head",
          title: "and redundant dual power supplies.",
          description: null,
          price: null,
          maximumPrice: null,
          rawPriceText: null,
          isPriceRange: false,
          kind: "context",
          lines: [],
          box: { id: "b2", x: 0.1, y: 0.05, width: 0.6, height: 0.05 },
        },
      },
      linguisticScore: 60,
      reasons: ["Tail ends with comma"],
    };

    const request = buildContinuationRequest(candidate, {
      documentContext: "datacenter hardware catalog",
    });

    expect(request.state.document_type).toBe("datacenter hardware catalog");
    expect(request.state.page_n_tail_text).toContain("Model X-500 Server Rack");
    expect(request.state.page_n1_head_text).toBe("and redundant dual power supplies.");
    expect(request.questions.isContinuation.instructions).toContain("attributes, or options");
    expect(request.questions.isContinuation.criteria?.true).toContain(
      "specification, or attribute",
    );
  });
});
