# Better Diffing Design

## Problem Statement

The current SmartDiffer uses row-by-row alignment which causes false positives when content shifts partially:
- A change in one column flags the entire row as different
- Content below a partial shift cascades as "changed" across full width
- Visually obvious small changes appear as large diffs

## Goals

- Reduce false positives from partial layout shifts
- Isolate changes to the actual region that changed
- Maintain balanced performance (not sacrificing speed for marginal accuracy gains)
- Keep backward compatibility with existing plugin architecture

## Solution

Two complementary improvements:

### 1. SmartDiffer Enhancement: Row + Column Dual Pass

Enhance the existing SmartDiffer with a second alignment pass:

**Current flow:**
```
Row alignment → Identify shifted rows → Render diff
```

**New flow:**
```
Row alignment → Identify shifted rows → Column alignment on shifted rows → Isolate changed regions → Render diff
```

**Algorithm:**

1. **Row pass** (existing): Run adaptive row alignment. Identify rows marked as "shifted" (content moved) vs "changed" (content different).

2. **Column pass** (new): For rows flagged as "shifted", slice into vertical strips and run the same alignment algorithm horizontally. Find which columns within those rows actually changed.

3. **Region isolation**: Intersect row and column results. Only mark as "changed" where both passes agree content is different. Shifted-but-unchanged content gets properly aligned.

**Example:** 3-column layout where middle column grows:
- Row pass: Flags all rows below change as "shifted"
- Column pass: Only middle column strip shows differences
- Result: Middle column highlighted, side columns properly aligned

**Trade-offs:**
- ~2x processing for shifted regions (unchanged regions skip column pass)
- Reuses existing AdaptiveAligner code
- Maintains backward compatibility

### 2. QuadtreeDiffer: New Plugin

A recursive divide-and-conquer approach for 2D-native diffing:

**Algorithm:**

1. Compare entire baseline vs current using perceptual hash
2. If identical (hash > 95%): Mark region unchanged, stop
3. If different: Divide into 4 quadrants
4. Recurse on each quadrant until minimum block size (32px default)
5. At leaf level: Use pixelmatch for pixel-level comparison

**Why it works:**
- Large unchanged regions exit early at high levels
- Changes naturally isolated to spatial region
- No row/column assumption - works for any layout
- Hierarchical structure matches how layouts are composed

**Configuration:**
```typescript
interface QuadtreeConfig {
  minBlockSize: number;        // Default: 32px
  similarityThreshold: number; // Default: 0.95
  maxDepth: number;            // Default: 8
}
```

**Trade-offs:**
- New implementation (not building on SmartDiffer)
- May over-segment at quadrant boundaries
- Excellent for sparse changes, less optimal for dense changes

## Plugin Selection

Users configure via existing `plugins.differ` in `visual-uat.config.js`:
- `@visual-uat/smart-differ` - Enhanced SmartDiffer (default)
- `@visual-uat/quadtree-differ` - QuadtreeDiffer alternative

## Implementation Order

1. Enhance SmartDiffer with column pass (lower risk, incremental)
2. Add QuadtreeDiffer as new plugin (independent, can parallelize)
3. Test both with real-world cases
4. Update default based on results

## Out of Scope (for now)

- Diff visualization improvements - will revisit after algorithm fixes
- Auto-selection between differs - users choose via config
- DOM-aware diffing - pure image comparison only

---

## Implementation Notes

### Column Pass Behavior and Configuration

The column pass enhancement is controlled by the `enableColumnPass` configuration option in SmartDiffer:

```typescript
interface SmartDifferConfig {
  enableColumnPass: boolean;  // Default: true
}
```

**How it works:**

1. After row alignment identifies shifted or inserted regions, the column pass refines these regions horizontally
2. The image width is divided into approximately 10 vertical strips (column width = width / 10, minimum 1px)
3. Each strip is compared using pixel-by-pixel similarity within the row range
4. Contiguous changed columns are merged into larger regions
5. Only regions with unchanged columns on one or both sides are refined; full-width changes remain full-width

**When column pass activates:**

- Runs on regions marked as "inserted" by the row alignment
- Skips regions that are already matched or deleted
- Only refines when both changed and unchanged columns are detected
- Falls back to original region if entire width changed

**Configuration guidance:**

- Leave `enableColumnPass: true` (default) for most cases - adds negligible overhead since it only runs on shifted regions
- Set to `false` if dealing with extremely wide images (>3000px) where strip processing becomes expensive
- Column pass reuses the same `adaptiveThreshold` value from the main config (default 0.95 similarity required to consider a column unchanged)

### QuadtreeDiffer Usage

The QuadtreeDiffer provides an alternative approach using recursive spatial subdivision:

**When to use QuadtreeDiffer:**

- Sparse localized changes in large images (e.g., single button change in a full page)
- Complex multi-column layouts where row-based alignment struggles
- Cases where content moves diagonally or in 2D patterns
- When you want naturally bounded change regions without full-width artifacts

**When to use SmartDiffer:**

- Dense changes across the image
- Primarily vertical content shifts (scrolling, insertions)
- When backward compatibility with existing diff results matters
- Default choice for most cases

**Configuration:**

```typescript
interface QuadtreeConfig {
  minBlockSize: number;        // Stop subdivision at this size (default: 32px)
  similarityThreshold: number; // Consider regions identical if similarity >= this (default: 0.95)
  maxDepth: number;            // Safety limit for recursion (default: 8)
}
```

**Configuration guidance:**

- Increase `minBlockSize` (e.g., 64px) for faster comparison at the cost of precision
- Decrease `minBlockSize` (e.g., 16px) for finer change detection at the cost of performance
- Adjust `similarityThreshold` down (e.g., 0.9) if too many unchanged regions are flagged as changed
- `maxDepth: 8` allows subdivision down to 1/256th of original image size, sufficient for most cases

### Performance Characteristics

**SmartDiffer with Column Pass:**

- Best case: O(n) where n = number of pixels, when all regions match after row alignment
- Typical case: O(n + m) where m = pixels in shifted regions
- Worst case: O(2n) when entire image appears shifted (runs column pass on all rows)
- Memory: O(1) - processes in streaming fashion
- Column pass overhead: ~10-20% on average, only on shifted regions

**QuadtreeDiffer:**

- Best case: O(log n) when large regions match at high levels
- Typical case: O(k log n) where k = number of changed leaf blocks
- Worst case: O(n) when no regions match, subdivides everything to leaf level
- Memory: O(tree depth) for recursion stack, typically < 1MB for standard images
- Efficient for sparse changes: 1% change may examine <10% of pixels

**Practical Performance:**

- Both differs handle 1920x1080 images in 100-300ms on modern hardware
- SmartDiffer faster for dense changes or vertical shifts
- QuadtreeDiffer faster for sparse localized changes
- Column pass adds 10-30ms overhead on typical web page diffs

**Choosing based on your use case:**

- Use SmartDiffer (default) for regression testing of web pages with typical content changes
- Use QuadtreeDiffer for comparing images with isolated UI element changes
- Use QuadtreeDiffer for spatial layouts like dashboards, grids, or multi-column designs
- Profile both if performance is critical - actual performance depends heavily on image content
