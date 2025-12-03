# Better Diffing Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce false positives from partial layout shifts by adding 2D-aware diffing.

**Architecture:** Two parallel improvements: (1) Enhance SmartDiffer with column pass for shifted rows, (2) Add QuadtreeDiffer as alternative plugin using recursive subdivision.

**Tech Stack:** TypeScript, pngjs, existing SmartDiffer infrastructure

---

## Task 1: Add Column Aligner

**Files:**
- Create: `src/plugins/smart-differ/column-aligner.ts`
- Create: `src/plugins/smart-differ/column-aligner.test.ts`

**Step 1: Write the failing test**

```typescript
// src/plugins/smart-differ/column-aligner.test.ts
// ABOUTME: Tests for column-based alignment to isolate horizontal changes
// ABOUTME: Validates that partial column shifts don't flag entire rows

import { PNG } from 'pngjs';
import { ColumnAligner } from './column-aligner';
import { DEFAULT_CONFIG } from './types';

describe('ColumnAligner', () => {
  const config = DEFAULT_CONFIG;
  let aligner: ColumnAligner;

  beforeEach(() => {
    aligner = new ColumnAligner(config);
  });

  describe('alignColumns', () => {
    it('should identify which columns changed in a row range', async () => {
      // Create two 300x100 images where only middle third (cols 100-200) differs
      const baseline = new PNG({ width: 300, height: 100 });
      const current = new PNG({ width: 300, height: 100 });

      // Fill both with white
      for (let i = 0; i < baseline.data.length; i += 4) {
        baseline.data[i] = 255;     // R
        baseline.data[i + 1] = 255; // G
        baseline.data[i + 2] = 255; // B
        baseline.data[i + 3] = 255; // A
        current.data[i] = 255;
        current.data[i + 1] = 255;
        current.data[i + 2] = 255;
        current.data[i + 3] = 255;
      }

      // Make middle column red in current only
      for (let y = 0; y < 100; y++) {
        for (let x = 100; x < 200; x++) {
          const idx = (y * 300 + x) << 2;
          current.data[idx] = 255;     // R
          current.data[idx + 1] = 0;   // G
          current.data[idx + 2] = 0;   // B
        }
      }

      const result = await aligner.alignColumns(
        baseline,
        current,
        { startRow: 0, endRow: 100 }
      );

      expect(result.changedColumns).toHaveLength(1);
      expect(result.changedColumns[0].startX).toBeGreaterThanOrEqual(100);
      expect(result.changedColumns[0].endX).toBeLessThanOrEqual(200);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test -- --testPathPattern="column-aligner" --no-coverage`

Expected: FAIL with "Cannot find module './column-aligner'"

**Step 3: Write minimal implementation**

```typescript
// src/plugins/smart-differ/column-aligner.ts
// ABOUTME: Column-based alignment for horizontal change isolation
// ABOUTME: Identifies which columns within a row range actually changed

import { PNG } from 'pngjs';
import type { SmartDifferConfig } from './types';

export interface ColumnRange {
  startX: number;
  endX: number;
  similarity: number;
}

export interface ColumnAlignmentResult {
  changedColumns: ColumnRange[];
  unchangedColumns: ColumnRange[];
}

export class ColumnAligner {
  constructor(private config: SmartDifferConfig) {}

  async alignColumns(
    baseline: PNG,
    current: PNG,
    rowRange: { startRow: number; endRow: number }
  ): Promise<ColumnAlignmentResult> {
    const width = Math.min(baseline.width, current.width);
    const columnWidth = Math.max(1, Math.floor(width / 10)); // Divide into ~10 strips

    const changedColumns: ColumnRange[] = [];
    const unchangedColumns: ColumnRange[] = [];

    for (let startX = 0; startX < width; startX += columnWidth) {
      const endX = Math.min(startX + columnWidth, width);
      const similarity = this.compareColumnStrip(
        baseline,
        current,
        startX,
        endX,
        rowRange.startRow,
        rowRange.endRow
      );

      const range: ColumnRange = { startX, endX, similarity };

      if (similarity >= this.config.adaptiveThreshold) {
        unchangedColumns.push(range);
      } else {
        changedColumns.push(range);
      }
    }

    return { changedColumns, unchangedColumns };
  }

  private compareColumnStrip(
    baseline: PNG,
    current: PNG,
    startX: number,
    endX: number,
    startRow: number,
    endRow: number
  ): number {
    let matchingPixels = 0;
    let totalPixels = 0;

    for (let y = startRow; y < endRow && y < baseline.height && y < current.height; y++) {
      for (let x = startX; x < endX; x++) {
        const idx1 = (y * baseline.width + x) << 2;
        const idx2 = (y * current.width + x) << 2;

        const rDiff = Math.abs(baseline.data[idx1] - current.data[idx2]);
        const gDiff = Math.abs(baseline.data[idx1 + 1] - current.data[idx2 + 1]);
        const bDiff = Math.abs(baseline.data[idx1 + 2] - current.data[idx2 + 2]);
        const avgDiff = (rDiff + gDiff + bDiff) / 3;

        if (avgDiff < 25) {
          matchingPixels++;
        }
        totalPixels++;
      }
    }

    return totalPixels > 0 ? matchingPixels / totalPixels : 0;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test -- --testPathPattern="column-aligner" --no-coverage`

Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/smart-differ/column-aligner.ts src/plugins/smart-differ/column-aligner.test.ts
git commit -m "feat: add ColumnAligner for horizontal change isolation"
```

---

## Task 2: Integrate Column Pass into AdaptiveAligner

**Files:**
- Modify: `src/plugins/smart-differ/adaptive-aligner.ts`
- Modify: `src/plugins/smart-differ/adaptive-aligner.test.ts`
- Modify: `src/plugins/smart-differ/types.ts`

**Step 1: Write the failing test**

Add to `src/plugins/smart-differ/adaptive-aligner.test.ts`:

```typescript
describe('column pass integration', () => {
  it('should narrow down changed regions using column pass', async () => {
    // Create 300x200 images where middle column (100-200) has extra content
    const baseline = new PNG({ width: 300, height: 200 });
    const current = new PNG({ width: 300, height: 220 }); // 20px taller

    // Fill baseline white
    for (let i = 0; i < baseline.data.length; i += 4) {
      baseline.data[i] = 255;
      baseline.data[i + 1] = 255;
      baseline.data[i + 2] = 255;
      baseline.data[i + 3] = 255;
    }

    // Fill current - white everywhere, but middle column has red insert at row 100
    for (let y = 0; y < current.height; y++) {
      for (let x = 0; x < current.width; x++) {
        const idx = (y * current.width + x) << 2;
        // Middle column (100-200), rows 100-120: red (inserted content)
        if (x >= 100 && x < 200 && y >= 100 && y < 120) {
          current.data[idx] = 255;
          current.data[idx + 1] = 0;
          current.data[idx + 2] = 0;
        } else {
          current.data[idx] = 255;
          current.data[idx + 1] = 255;
          current.data[idx + 2] = 255;
        }
        current.data[idx + 3] = 255;
      }
    }

    const aligner = new AdaptiveAligner({ ...DEFAULT_CONFIG, enableColumnPass: true });
    const result = await aligner.align(baseline, current);

    // Should have narrowed regions that don't span full width
    const insertedRegion = result.regions.find(r => r.type === 'inserted');
    expect(insertedRegion).toBeDefined();
    if (insertedRegion?.current) {
      // The inserted region should be narrowed to middle column, not full width
      expect(insertedRegion.current.width).toBeLessThan(300);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test -- --testPathPattern="adaptive-aligner" --no-coverage`

Expected: FAIL (enableColumnPass not recognized, or regions span full width)

**Step 3: Update types**

Add to `src/plugins/smart-differ/types.ts`:

```typescript
export interface SmartDifferConfig {
  adaptiveThreshold: number;
  searchWindow: number;
  blockSize: number;
  fallbackThreshold: number;
  enableColumnPass: boolean;  // NEW
}

export const DEFAULT_CONFIG: SmartDifferConfig = {
  adaptiveThreshold: 0.95,
  searchWindow: 50,
  blockSize: 50,
  fallbackThreshold: 3,
  enableColumnPass: true  // NEW - enabled by default
};
```

**Step 4: Update AdaptiveAligner**

Modify `src/plugins/smart-differ/adaptive-aligner.ts` to import and use ColumnAligner:

```typescript
import { ColumnAligner } from './column-aligner';

export class AdaptiveAligner {
  private columnAligner: ColumnAligner;

  constructor(private config: SmartDifferConfig) {
    this.columnAligner = new ColumnAligner(config);
  }

  async align(baseline: PNG, current: PNG): Promise<AlignmentResult> {
    // ... existing row alignment code ...

    // After row alignment, if enableColumnPass, refine shifted regions
    if (this.config.enableColumnPass) {
      regions = await this.refineWithColumnPass(regions, baseline, current);
    }

    return { regions, confidence, fallbackTriggered: false };
  }

  private async refineWithColumnPass(
    regions: AlignmentRegion[],
    baseline: PNG,
    current: PNG
  ): Promise<AlignmentRegion[]> {
    const refined: AlignmentRegion[] = [];

    for (const region of regions) {
      if (region.type === 'inserted' && region.current) {
        // Run column pass to narrow down
        const colResult = await this.columnAligner.alignColumns(
          baseline,
          current,
          { startRow: region.current.y, endRow: region.current.y + region.current.height }
        );

        if (colResult.changedColumns.length > 0 && colResult.unchangedColumns.length > 0) {
          // Split into narrower regions
          for (const col of colResult.changedColumns) {
            refined.push({
              type: 'inserted',
              baseline: null,
              current: {
                x: col.startX,
                y: region.current.y,
                width: col.endX - col.startX,
                height: region.current.height
              },
              similarity: null
            });
          }
        } else {
          refined.push(region);
        }
      } else {
        refined.push(region);
      }
    }

    return refined;
  }
}
```

**Step 5: Run test to verify it passes**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test -- --testPathPattern="adaptive-aligner" --no-coverage`

Expected: PASS

**Step 6: Run full test suite**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test --no-coverage`

Expected: All tests pass

**Step 7: Commit**

```bash
git add src/plugins/smart-differ/types.ts src/plugins/smart-differ/adaptive-aligner.ts src/plugins/smart-differ/adaptive-aligner.test.ts
git commit -m "feat: integrate column pass into AdaptiveAligner for 2D refinement"
```

---

## Task 3: Create QuadtreeDiffer Plugin Structure

**Files:**
- Create: `src/plugins/quadtree-differ/index.ts`
- Create: `src/plugins/quadtree-differ/types.ts`
- Create: `src/plugins/quadtree-differ/quadtree-differ.ts`
- Create: `src/plugins/quadtree-differ/quadtree-differ.test.ts`

**Step 1: Write the failing test**

```typescript
// src/plugins/quadtree-differ/quadtree-differ.test.ts
// ABOUTME: Tests for quadtree-based image diffing
// ABOUTME: Validates recursive subdivision finds localized changes

import { PNG } from 'pngjs';
import { QuadtreeDiffer } from './quadtree-differ';

describe('QuadtreeDiffer', () => {
  let differ: QuadtreeDiffer;

  beforeEach(() => {
    differ = new QuadtreeDiffer();
  });

  describe('compare', () => {
    it('should detect identical images', async () => {
      const img = new PNG({ width: 100, height: 100 });
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = 255;
      }
      const buffer = PNG.sync.write(img);

      const result = await differ.compare(
        { data: buffer, width: 100, height: 100, checkpoint: 'test' },
        { data: buffer, width: 100, height: 100, checkpoint: 'test' }
      );

      expect(result.identical).toBe(true);
      expect(result.pixelDiffPercent).toBe(0);
    });

    it('should isolate change to quadrant', async () => {
      const baseline = new PNG({ width: 100, height: 100 });
      const current = new PNG({ width: 100, height: 100 });

      // Fill both white
      for (let i = 0; i < baseline.data.length; i += 4) {
        baseline.data[i] = 255;
        baseline.data[i + 1] = 255;
        baseline.data[i + 2] = 255;
        baseline.data[i + 3] = 255;
        current.data[i] = 255;
        current.data[i + 1] = 255;
        current.data[i + 2] = 255;
        current.data[i + 3] = 255;
      }

      // Make top-left quadrant red in current
      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
          const idx = (y * 100 + x) << 2;
          current.data[idx] = 255;
          current.data[idx + 1] = 0;
          current.data[idx + 2] = 0;
        }
      }

      const baselineBuffer = PNG.sync.write(baseline);
      const currentBuffer = PNG.sync.write(current);

      const result = await differ.compare(
        { data: baselineBuffer, width: 100, height: 100, checkpoint: 'test' },
        { data: currentBuffer, width: 100, height: 100, checkpoint: 'test' }
      );

      expect(result.identical).toBe(false);
      expect(result.changedRegions.length).toBeGreaterThan(0);
      // Changed region should be in top-left area
      const region = result.changedRegions[0];
      expect(region.x).toBeLessThan(50);
      expect(region.y).toBeLessThan(50);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test -- --testPathPattern="quadtree-differ" --no-coverage`

Expected: FAIL with "Cannot find module"

**Step 3: Create types file**

```typescript
// src/plugins/quadtree-differ/types.ts
// ABOUTME: Type definitions for quadtree-based image diffing
// ABOUTME: Configuration and internal node structures

export interface QuadtreeConfig {
  minBlockSize: number;        // Stop recursion at this size (default: 32)
  similarityThreshold: number; // Hash match threshold (default: 0.95)
  maxDepth: number;            // Safety limit (default: 8)
}

export const DEFAULT_QUADTREE_CONFIG: QuadtreeConfig = {
  minBlockSize: 32,
  similarityThreshold: 0.95,
  maxDepth: 8
};

export interface QuadtreeNode {
  x: number;
  y: number;
  width: number;
  height: number;
  identical: boolean;
  children?: QuadtreeNode[];
}
```

**Step 4: Create main differ class**

```typescript
// src/plugins/quadtree-differ/quadtree-differ.ts
// ABOUTME: Quadtree-based image differ using recursive subdivision
// ABOUTME: Naturally isolates changes to their spatial region

import type { Differ, Screenshot, DiffResult, BoundingBox } from '../../types/plugins';
import { PNG } from 'pngjs';
import type { QuadtreeConfig, QuadtreeNode } from './types';
import { DEFAULT_QUADTREE_CONFIG } from './types';

export class QuadtreeDiffer implements Differ {
  private config: QuadtreeConfig;

  constructor(config?: Partial<QuadtreeConfig>) {
    this.config = { ...DEFAULT_QUADTREE_CONFIG, ...config };
  }

  async compare(baseline: Screenshot, current: Screenshot): Promise<DiffResult> {
    const baselinePng = PNG.sync.read(baseline.data);
    const currentPng = PNG.sync.read(current.data);

    // Build quadtree
    const tree = this.buildQuadtree(
      baselinePng,
      currentPng,
      0,
      0,
      Math.max(baselinePng.width, currentPng.width),
      Math.max(baselinePng.height, currentPng.height),
      0
    );

    // Extract changed regions from tree
    const changedRegions = this.extractChangedRegions(tree);

    // Calculate pixel diff percentage
    const totalPixels = baselinePng.width * baselinePng.height;
    let changedPixels = 0;
    for (const region of changedRegions) {
      changedPixels += region.width * region.height;
    }
    const pixelDiffPercent = totalPixels > 0 ? (changedPixels / totalPixels) * 100 : 0;

    // Render diff image (simple version - highlight changed regions)
    const diffImage = this.renderDiff(baselinePng, currentPng, changedRegions);

    return {
      diffImage,
      pixelDiffPercent,
      changedRegions,
      identical: changedRegions.length === 0
    };
  }

  private buildQuadtree(
    baseline: PNG,
    current: PNG,
    x: number,
    y: number,
    width: number,
    height: number,
    depth: number
  ): QuadtreeNode {
    const node: QuadtreeNode = { x, y, width, height, identical: false };

    // Check if region is identical
    if (this.regionsMatch(baseline, current, x, y, width, height)) {
      node.identical = true;
      return node;
    }

    // Stop recursion if at min size or max depth
    if (width <= this.config.minBlockSize ||
        height <= this.config.minBlockSize ||
        depth >= this.config.maxDepth) {
      node.identical = false;
      return node;
    }

    // Subdivide into quadrants
    const halfW = Math.floor(width / 2);
    const halfH = Math.floor(height / 2);

    node.children = [
      this.buildQuadtree(baseline, current, x, y, halfW, halfH, depth + 1),
      this.buildQuadtree(baseline, current, x + halfW, y, width - halfW, halfH, depth + 1),
      this.buildQuadtree(baseline, current, x, y + halfH, halfW, height - halfH, depth + 1),
      this.buildQuadtree(baseline, current, x + halfW, y + halfH, width - halfW, height - halfH, depth + 1)
    ];

    // Node is identical if all children are identical
    node.identical = node.children.every(c => c.identical);

    return node;
  }

  private regionsMatch(
    baseline: PNG,
    current: PNG,
    x: number,
    y: number,
    width: number,
    height: number
  ): boolean {
    let matching = 0;
    let total = 0;

    for (let py = y; py < y + height && py < baseline.height && py < current.height; py++) {
      for (let px = x; px < x + width && px < baseline.width && px < current.width; px++) {
        const idx1 = (py * baseline.width + px) << 2;
        const idx2 = (py * current.width + px) << 2;

        const rDiff = Math.abs(baseline.data[idx1] - current.data[idx2]);
        const gDiff = Math.abs(baseline.data[idx1 + 1] - current.data[idx2 + 1]);
        const bDiff = Math.abs(baseline.data[idx1 + 2] - current.data[idx2 + 2]);

        if ((rDiff + gDiff + bDiff) / 3 < 25) {
          matching++;
        }
        total++;
      }
    }

    return total > 0 && (matching / total) >= this.config.similarityThreshold;
  }

  private extractChangedRegions(node: QuadtreeNode): BoundingBox[] {
    if (node.identical) {
      return [];
    }

    if (!node.children) {
      return [{ x: node.x, y: node.y, width: node.width, height: node.height }];
    }

    const regions: BoundingBox[] = [];
    for (const child of node.children) {
      regions.push(...this.extractChangedRegions(child));
    }
    return regions;
  }

  private renderDiff(baseline: PNG, current: PNG, changedRegions: BoundingBox[]): Buffer {
    // Create diff image from current, highlight changed regions
    const diff = new PNG({ width: current.width, height: current.height });
    current.data.copy(diff.data);

    // Overlay red tint on changed regions
    for (const region of changedRegions) {
      for (let y = region.y; y < region.y + region.height && y < diff.height; y++) {
        for (let x = region.x; x < region.x + region.width && x < diff.width; x++) {
          const idx = (y * diff.width + x) << 2;
          diff.data[idx] = Math.min(255, diff.data[idx] + 100); // Add red
          diff.data[idx + 1] = Math.max(0, diff.data[idx + 1] - 50); // Reduce green
          diff.data[idx + 2] = Math.max(0, diff.data[idx + 2] - 50); // Reduce blue
        }
      }
    }

    return PNG.sync.write(diff);
  }
}
```

**Step 5: Create index file**

```typescript
// src/plugins/quadtree-differ/index.ts
// ABOUTME: Public exports for quadtree differ plugin
// ABOUTME: Alternative to SmartDiffer for 2D-native diffing

export { QuadtreeDiffer } from './quadtree-differ';
export type { QuadtreeConfig } from './types';
export { DEFAULT_QUADTREE_CONFIG } from './types';
```

**Step 6: Run test to verify it passes**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test -- --testPathPattern="quadtree-differ" --no-coverage`

Expected: PASS

**Step 7: Commit**

```bash
git add src/plugins/quadtree-differ/
git commit -m "feat: add QuadtreeDiffer plugin for 2D-native diffing"
```

---

## Task 4: Register QuadtreeDiffer in Plugin Registry

**Files:**
- Modify: `src/orchestrator/services/plugin-registry.ts`
- Modify: `src/orchestrator/services/plugin-registry.test.ts`

**Step 1: Write the failing test**

Add to plugin-registry.test.ts:

```typescript
it('should load quadtree-differ plugin', () => {
  const config = createTestConfig({
    plugins: {
      ...testPlugins,
      differ: '@visual-uat/quadtree-differ'
    }
  });

  const registry = new PluginRegistry(config);
  const plugins = registry.loadAll();

  expect(plugins.differ).toBeDefined();
  expect(plugins.differ.constructor.name).toBe('QuadtreeDiffer');
});
```

**Step 2: Run test to verify it fails**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test -- --testPathPattern="plugin-registry" --no-coverage`

Expected: FAIL (unknown plugin)

**Step 3: Update plugin registry**

Add to `src/orchestrator/services/plugin-registry.ts`:

```typescript
import { QuadtreeDiffer } from '../../plugins/quadtree-differ';

// In loadDiffer method, add case:
case '@visual-uat/quadtree-differ':
  return new QuadtreeDiffer();
```

**Step 4: Run test to verify it passes**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test -- --testPathPattern="plugin-registry" --no-coverage`

Expected: PASS

**Step 5: Run full test suite**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test --no-coverage`

Expected: All tests pass

**Step 6: Commit**

```bash
git add src/orchestrator/services/plugin-registry.ts src/orchestrator/services/plugin-registry.test.ts
git commit -m "feat: register QuadtreeDiffer in plugin registry"
```

---

## Task 5: Integration Test for Column Pass

**Files:**
- Modify: `src/plugins/smart-differ/integration.test.ts`

**Step 1: Add integration test**

```typescript
describe('column pass integration', () => {
  it('should narrow diff to changed column in multi-column layout', async () => {
    // Create test images simulating 3-column layout
    // where middle column has insertion
    const baseline = new PNG({ width: 300, height: 200 });
    const current = new PNG({ width: 300, height: 220 });

    // Fill with white, then add colored columns to simulate layout
    // ... (create realistic multi-column test case)

    const differ = new SmartDiffer({ enableColumnPass: true });
    const result = await differ.compare(
      { data: PNG.sync.write(baseline), width: 300, height: 200, checkpoint: 'test' },
      { data: PNG.sync.write(current), width: 300, height: 220, checkpoint: 'test' }
    );

    // Verify diff is localized, not full-width
    expect(result.changedRegions.some(r => r.width < 300)).toBe(true);
  });
});
```

**Step 2: Run integration tests**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test -- --testPathPattern="integration" --no-coverage`

Expected: PASS

**Step 3: Commit**

```bash
git add src/plugins/smart-differ/integration.test.ts
git commit -m "test: add integration test for column pass"
```

---

## Task 6: Update Documentation

**Files:**
- Modify: `docs/plans/2024-12-03-better-diffing-design.md`
- Modify: `README.md` (if plugin docs exist there)

**Step 1: Update design doc with implementation notes**

Add "Implementation Notes" section documenting:
- Column pass behavior and configuration
- QuadtreeDiffer usage and when to choose it
- Performance characteristics

**Step 2: Commit**

```bash
git add docs/
git commit -m "docs: update better diffing design with implementation notes"
```

---

## Task 7: Final Verification

**Step 1: Run full test suite**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm test`

Expected: All tests pass

**Step 2: Run build**

Run: `cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/better-diffing && npm run build`

Expected: Build succeeds

**Step 3: Manual smoke test (optional)**

Test with real images if available to verify behavior improvement.
