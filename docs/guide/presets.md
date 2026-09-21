# Domain Presets

Documents have different visual grammars. A price list uses currency baselines, a specification sheet uses key-value colon attributes, and an inventory manifest tracks SKUs and counts.

**afferent** provides built-in domain presets and supports custom options via `SpatialEngineOptions`.

## Built-In Presets

### Price Lists (`presets.priceList`)

Configured for catalogs, menus, and service rate sheets with currency values:

```typescript
import { processPageLayout, presets } from "afferent";

const layout = await processPageLayout(lines, presets.priceList);
```

- Pairs currency symbols (`$`, `USD`, `€`, `£`) and prices with titles.
- Merges price ranges (e.g. `$500 - $1,200`).
- Prevents section headers (like `GENERAL SERVICES`) from absorbing into items.

### Technical Spec Sheets (`presets.specSheet`)

Configured for hardware specifications, datasheets, and technical parameters:

```typescript
import { processPageLayout, presets } from "afferent";

const layout = await processPageLayout(lines, presets.specSheet);
```

- Pairs colon-delimited properties (e.g. `Operating Voltage: 24V DC`).
- Extracts measurement units (`mm`, `kg`, `W`, `MHz`, `RPM`).
- Treats component headers (`DIMENSIONS`, `ELECTRICAL`, `WARRANTY`) as section boundaries.

### Inventory Manifests (`presets.inventory`)

Configured for warehouse manifests, parts lists, and logistics tables:

```typescript
import { processPageLayout, presets } from "afferent";

const layout = await processPageLayout(lines, presets.inventory);
```

- Matches alphanumeric SKUs and part numbers (`AB-1234`, `SKU-90210`).
- Pairs quantities and stock counts.

## Custom Configuration

Supply custom options to tailor the engine to your specific layout needs:

```typescript
import { processPageLayout, type SpatialEngineOptions } from "afferent";

const options: SpatialEngineOptions = {
  // Prevent custom headers from absorbing into descriptions
  sectionHeaderPatterns: [/^(?:SERVICES|EQUIPMENT|TERMS|DISCLAIMERS)/i],

  // Maximum vertical gap to stitch lines into one description (normalized 0..1)
  maxLineVerticalDistance: 0.045,

  // Y-tolerance for horizontal baseline pairing
  horizontalDeltaY: 0.012,

  // Document context passed to System 1 continuation evaluations
  documentContext: "commercial equipment invoice",

  // Custom extractor for non-currency values (dates, codes, serials)
  extractValue: (text) => {
    const match = text.match(/\b([A-Z]{2}-\d{4})\b/);
    return match ? { value: match[1], raw: match[0] } : null;
  },
};

const layout = await processPageLayout(lines, options);
```
