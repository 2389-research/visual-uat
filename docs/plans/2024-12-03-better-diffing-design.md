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
