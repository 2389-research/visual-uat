# Smart Differ Guide

## Overview

The Smart Differ replaces the old PixelmatchDiffer with intelligent content-aware comparison that handles different-sized images and detects actual changes (insertions, deletions, modifications) without flagging content shifts as differences.

## Use Cases

### Header/Footer Redesign
When your header height changes from 150px to 100px, SmartDiffer:
- ✅ Detects the header change
- ✅ Recognizes shifted content is unchanged
- ❌ Does NOT flag entire page as different

### Content Insertion
When you add a new section in the middle of a page, SmartDiffer:
- ✅ Highlights the new section
- ✅ Recognizes content below is just shifted
- ❌ Does NOT flag everything below as different

### Layout Reordering
When you reorder page sections, SmartDiffer:
- ✅ Detects that sections moved
- ✅ Recognizes the content itself is unchanged
- ✅ Shows the structural change

## Architecture

See `docs/plans/2025-11-24-smart-image-diffing-design.md` for full design details.

## Configuration

### Default Configuration

```typescript
{
  adaptiveThreshold: 0.95,    // 95% similarity required for row match
  searchWindow: 50,           // Search ±50 rows for alignment
  blockSize: 50,              // 50 rows per feature block
  fallbackThreshold: 3        // Fallback after 3 misalignments
}
```

### Custom Configuration

```javascript
// visual-uat.config.js
module.exports = {
  smartDiffer: {
    adaptiveThreshold: 0.90,  // Lower = more lenient matching
    searchWindow: 100,        // Larger = detect bigger shifts (slower)
    blockSize: 30,            // Smaller = finer granularity (slower)
    fallbackThreshold: 5      // Higher = more attempts before fallback
  }
};
```

### Tuning Tips

- **More false positives?** Lower `adaptiveThreshold` to 0.90
- **Missing insertions?** Increase `searchWindow` to 100
- **Coarse change detection?** Decrease `blockSize` to 30
- **Premature fallback?** Increase `fallbackThreshold` to 5

## Output

### Diff Image Colors

- 🟢 **Green overlay** = Content inserted
- 🔴 **Red overlay** = Content deleted
- 🩷 **Pink/yellow overlay** = Pixel-level changes within matched regions

### Structured Data

SmartDiffer returns a `DiffResult` (the standard Differ interface):

```typescript
interface DiffResult {
  diffImage: Buffer;           // Annotated PNG with overlays
  pixelDiffPercent: number;    // 0-100 percentage of changed pixels
  changedRegions: BoundingBox[]; // Coordinates of changed areas
  identical: boolean;          // True if 0% diff
}
```

**Note:** Internally, SmartDiffer uses a `SmartDiffResult` type with additional fields (`strategy`, `confidence`, `regions: AlignmentRegion[]`) for the two-tier algorithm, but these are transformed into the standard `DiffResult` format for the public API.

## Backward Compatibility

Same-size images produce identical results to the old PixelmatchDiffer. Existing tests should pass without modification.

## Performance

- **Same-size images**: ~same as PixelmatchDiffer
- **Simple content shifts**: 1-2x slower (Tier 1)
- **Complex restructuring**: 3-5x slower (Tier 2 fallback)

For most real-world scenarios, performance impact is negligible (<100ms difference).
