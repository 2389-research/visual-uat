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
