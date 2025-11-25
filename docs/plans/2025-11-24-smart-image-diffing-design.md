# Smart Image Diffing Design

**Date:** 2025-11-24
**Status:** Approved
**Branch:** `feat/handle-different-sized-images`

## Problem Statement

The current visual-uat differ (pixelmatch-differ) has two critical limitations:

1. **Dimension Requirement**: Pixelmatch requires both images to have identical dimensions, causing errors when page heights change (e.g., header redesign changed page height from 942px to 720px)

2. **Content Shift False Positives**: When content is inserted in the middle of a page, naive pixel diffing flags everything below the insertion as different, even though it's just shifted. This makes the tool impractical for web/document comparison where insertions and deletions are common.

**Goal:** Build a content-aware differ that detects actual changes (insertions, deletions, modifications) while correctly handling content shifts and size changes.

## Architecture: Two-Tier Hybrid Strategy

### Tier 1: Adaptive Row-by-Row Alignment (Fast Path)
- **Use case:** Common scenarios where content shifts are localized (80% of cases)
- **Performance:** Fast sequential comparison with sliding window search
- **When to use:** Default approach, tries first

### Tier 2: Feature-Based Matching (Fallback)
- **Use case:** Complex scenarios with major restructuring (20% of cases)
- **Performance:** Slower but more sophisticated global matching
- **When to use:** Falls back when Tier 1 confidence is low (threshold: 3+ fallback triggers)

### Output
Both tiers produce:
1. **Annotated Diff Image**: Visual representation with colored overlays
   - Green = insertion
   - Red = deletion
   - Pink/yellow = pixel-level changes
2. **Structured Data**: Array of alignment regions with coordinates and similarity scores
3. **Metadata**: Strategy used, confidence score (0.5-1.0), pixel diff percentage

## Core Components

### 1. SmartDiffer (Main Orchestrator)
```typescript
class SmartDiffer implements Differ {
  compare(baseline: Buffer, current: Buffer, config: SmartDifferConfig): Promise<SmartDiffResult>
  // Decides which tier to use
  // Coordinates alignment and comparison
}

interface SmartDifferConfig {
  adaptiveThreshold: number;    // 0.95 default - similarity required for row match
  searchWindow: number;          // 50 default - ±N rows to search for alignment
  blockSize: number;             // 50 default - rows per feature block
  fallbackThreshold: number;     // 3 default - misalignments before fallback
}
```

### 2. AdaptiveAligner (Tier 1)
```typescript
class AdaptiveAligner {
  compareRowByRow(baseline: Image, current: Image): AlignmentResult
  detectMismatch(baselineRow: Row, currentRow: Row): boolean
  searchAlignment(baselineRow: Row, currentRows: Row[], window: number): Match | null
  realign(baselineRow: Row, currentRow: Row): AlignmentRegion
}
```

### 3. FeatureMatcher (Tier 2)
```typescript
class FeatureMatcher {
  divideIntoBlocks(image: Image, blockSize: number): Block[]
  computePerceptualHash(block: Block): string
  matchBlocks(baselineBlocks: Block[], currentBlocks: Block[]): Match[]
  buildAlignmentMap(matches: Match[]): AlignmentRegion[]
}
```

### 4. DiffRenderer (Shared)
```typescript
class DiffRenderer {
  annotateImage(regions: AlignmentRegion[], baseline: Image, current: Image): Buffer
  createRegionData(regions: AlignmentRegion[]): RegionData[]
}
```

## Data Structures

```typescript
interface AlignmentRegion {
  type: 'matched' | 'inserted' | 'deleted';
  baseline: { x: number; y: number; width: number; height: number } | null;
  current: { x: number; y: number; width: number; height: number } | null;
  similarity: number | null; // 0-1 for matched regions, null for inserted/deleted
}

interface SmartDiffResult {
  strategy: 'adaptive' | 'feature-based';
  pixelDiffPercentage: number;
  regions: AlignmentRegion[];
  diffImage: Buffer; // Annotated PNG
  confidence: number; // 0.5-1.0 - how confident in alignment
}
```

## Algorithms

### Tier 1: Adaptive Row-by-Row Alignment

1. **Sequential Comparison**
   - Start at row 0 of both images
   - Compare current rows using pixel similarity (adaptiveThreshold = 0.95)
   - If match → record matched region, advance both pointers
   - If mismatch → trigger sliding window search

2. **Sliding Window Search**
   - Search ±searchWindow rows (default: 50) in current image for matching row
   - If found within threshold → record insertion/deletion regions, realign pointers
   - If not found → increment fallback counter, record mismatch

3. **Fallback Trigger**
   - If fallbackThreshold misalignments occur (default: 3)
   - Switch to Tier 2 (Feature-Based Matching)

4. **Confidence Scoring**
   - High confidence (0.9-1.0): All rows matched or aligned within small window
   - Medium confidence (0.7-0.9): Some realignments but patterns clear
   - Low confidence (<0.7): Many fallbacks triggered

### Tier 2: Feature-Based Matching

1. **Block Division**
   - Divide both images into blocks (default: 50 rows each)
   - Maintain block position metadata (y-offset, height)

2. **Perceptual Hashing**
   - Compute perceptual hash for each block (pHash or blockhash)
   - Produces content-based signature robust to minor pixel changes

3. **Block Correspondence**
   - Match baseline blocks to current blocks using hash similarity
   - Use Hungarian algorithm (optimal) or greedy matching (faster)
   - Similarity threshold: >80% for match (configurable)

4. **Alignment Map Construction**
   - Map matched blocks → matched regions
   - Unmatched baseline blocks → deleted regions
   - Unmatched current blocks → inserted regions
   - Within matched blocks → pixel diff for changes

5. **Confidence Scoring**
   - High confidence (0.8-1.0): Most blocks matched with high similarity
   - Medium confidence (0.6-0.8): Moderate matches, some ambiguity
   - Low confidence (0.5-0.6): Many unmatched blocks or low similarity matches

## Edge Cases

1. **Ambiguous Shifts**: Favor similarity detection - if content is >80% similar, match it even if far away
2. **Same-Size Images**: Use fast path through adaptive alignment, should be identical to old pixelmatch behavior (backward compatible)
3. **Completely Different Images**: Both tiers will produce low confidence (<0.6), large insertion+deletion regions
4. **Multiple Similar Blocks**: Use position bias - prefer matches that maintain relative ordering
5. **Performance**: Balanced approach - optimize common cases (Tier 1), fall back for complex scenarios (Tier 2)

## Integration Approach: Complete Replacement

### Replace PixelmatchDiffer Entirely

**Rationale:** SmartDiffer handles all cases including same-size images without errors, making PixelmatchDiffer obsolete.

### Implementation Strategy

1. **SmartDiffer as Default**
   - Implement `Differ` interface
   - Handle both different-size and same-size images
   - Provide backward-compatible results for same-size images

2. **Configuration**
   ```typescript
   // visual-uat.config.js
   {
     differ: '@visual-uat/smart-differ', // or just default
     smartDiffer: {
       adaptiveThreshold: 0.95,
       searchWindow: 50,
       blockSize: 50,
       fallbackThreshold: 3
     }
   }
   ```

3. **Migration Path**
   - Existing projects: No config changes needed
   - Same-size images: Get identical results (backward compatible)
   - Different-size images: Automatically handled with smart diffing

4. **File Changes**
   - Delete: `src/plugins/pixelmatch-differ.ts`
   - Create: `src/plugins/smart-differ.ts`
   - Update: Plugin registry to use SmartDiffer by default

### Backward Compatibility

- **Same dimensions**: SmartDiffer detects and uses fast pixel-only comparison (equivalent to pixelmatch)
- **Existing tests**: Should pass without modification
- **API**: Maintains `Differ` interface, no breaking changes

## Success Criteria

1. **Functional Requirements**
   - ✅ Handles different-sized images without errors
   - ✅ Detects content insertions without flagging shifted content as different
   - ✅ Detects content deletions without flagging shifted content as different
   - ✅ Detects pixel-level changes within existing content
   - ✅ Produces annotated diff images with colored overlays
   - ✅ Provides structured data for programmatic analysis

2. **Performance Requirements**
   - ✅ Fast path (Tier 1) handles 80% of cases efficiently
   - ✅ Fallback (Tier 2) provides accuracy for complex cases
   - ✅ Same-size images maintain current performance

3. **Quality Requirements**
   - ✅ High confidence scores (>0.7) for clear differences
   - ✅ Backward compatible with existing tests
   - ✅ No false positives for content shifts

## Next Steps

1. Create detailed implementation plan using writing-plans skill
2. Implement SmartDiffer core orchestration
3. Implement AdaptiveAligner (Tier 1)
4. Implement FeatureMatcher (Tier 2)
5. Implement DiffRenderer
6. Write comprehensive tests (TDD approach)
7. Update documentation and examples
8. Deprecate PixelmatchDiffer
