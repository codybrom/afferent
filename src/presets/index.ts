import type { SpatialEngineOptions, ExtractedValue, OcrLine } from "../types.js";
import { defaultPriceValueMatcher } from "../geometry/currency.js";

/**
 * Standard preset for catalogs, price lists, menus, and service rate sheets.
 * Pairs items with prices and monetary ranges ($1,200.00, $45.00, etc.).
 */
export const priceListPreset: SpatialEngineOptions<number> = {
  documentContext: "catalog, service rate sheet, or price list",
  valueMatcher: defaultPriceValueMatcher,
};

const SPEC_REGEX =
  /\b(\d+(?:\.\d+)?)\s*(?:V|VAC|VDC|kV|Hz|kHz|MHz|GHz|W|kW|mW|mA|A|dB|Ω|kΩ|MΩ|mm|cm|m|in|ft|kg|g|mg|lbs?|oz|°C|°F|K|RPM|psi|bar|GB|MB|TB|kbps|Mbps|Gbps)\b/i;

/**
 * Standard preset for engineering spec sheets, hardware manuals, and datasheets.
 * Pairs spec attributes (e.g. "Operating Voltage") with measurements (e.g. "240 VAC", "60Hz", "15 mm").
 */
export const specSheetPreset: SpatialEngineOptions<string> = {
  documentContext: "technical specification sheet, hardware manual, or datasheet",
  valueMatcher: (line: OcrLine): ExtractedValue<string> | null => {
    const match = line.text.match(SPEC_REGEX);
    if (match) {
      return {
        rawText: match[0].trim(),
        value: match[0].trim(),
      };
    }
    return null;
  },
};

const INVENTORY_REGEX =
  /\b(\d[\d,]*)\s*(?:units?|pcs?|pieces?|pk|pack|boxes?|cases?|cartons?|ea|each|pairs?|sets?)\b/i;

/**
 * Standard preset for inventory manifests, bills of materials (BOM), and packing slips.
 * Pairs component/item names with quantities (e.g. "500 units", "24 pcs", "10 pk").
 */
export const inventoryPreset: SpatialEngineOptions<number> = {
  documentContext: "inventory manifest, bill of materials, or packing slip",
  valueMatcher: (line: OcrLine): ExtractedValue<number> | null => {
    const match = line.text.match(INVENTORY_REGEX);
    if (match && match[1]) {
      const num = Number(match[1].replace(/,/g, ""));
      if (!isNaN(num)) {
        return {
          rawText: match[0].trim(),
          value: num,
        };
      }
    }
    return null;
  },
};

export const presets = {
  priceList: priceListPreset,
  specSheet: specSheetPreset,
  inventory: inventoryPreset,
};
