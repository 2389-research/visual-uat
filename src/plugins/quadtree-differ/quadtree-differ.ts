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

    // Calculate pixel diff percentage using quadtree canvas size to prevent >100%
    const totalPixels = Math.max(baselinePng.width, currentPng.width) *
                        Math.max(baselinePng.height, currentPng.height);
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

    const maxY = y + height;
    const maxX = x + width;

    for (let py = y; py < maxY; py++) {
      for (let px = x; px < maxX; px++) {
        const inBaseline = px < baseline.width && py < baseline.height;
        const inCurrent = px < current.width && py < current.height;

        if (inBaseline && inCurrent) {
          const idx1 = (py * baseline.width + px) << 2;
          const idx2 = (py * current.width + px) << 2;

          const rDiff = Math.abs(baseline.data[idx1] - current.data[idx2]);
          const gDiff = Math.abs(baseline.data[idx1 + 1] - current.data[idx2 + 1]);
          const bDiff = Math.abs(baseline.data[idx1 + 2] - current.data[idx2 + 2]);

          if ((rDiff + gDiff + bDiff) / 3 < this.config.pixelThreshold) {
            matching++;
          }
        }
        // Pixels outside either image are treated as mismatches (not incrementing matching)
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
    // Create diff image using max dimensions to handle size differences
    const width = Math.max(baseline.width, current.width);
    const height = Math.max(baseline.height, current.height);
    const diff = new PNG({ width, height });

    // Start with current image as base
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dstIdx = (y * width + x) << 2;

        if (x < current.width && y < current.height) {
          const srcIdx = (y * current.width + x) << 2;
          diff.data[dstIdx] = current.data[srcIdx];
          diff.data[dstIdx + 1] = current.data[srcIdx + 1];
          diff.data[dstIdx + 2] = current.data[srcIdx + 2];
          diff.data[dstIdx + 3] = current.data[srcIdx + 3];
        } else {
          // Area outside current - fill with gray
          diff.data[dstIdx] = 128;
          diff.data[dstIdx + 1] = 128;
          diff.data[dstIdx + 2] = 128;
          diff.data[dstIdx + 3] = 255;
        }
      }
    }

    // Overlay colors on changed regions based on change type
    for (const region of changedRegions) {
      for (let y = region.y; y < region.y + region.height && y < height; y++) {
        for (let x = region.x; x < region.x + region.width && x < width; x++) {
          const idx = (y * width + x) << 2;

          const inBaseline = x < baseline.width && y < baseline.height;
          const inCurrent = x < current.width && y < current.height;

          if (inBaseline && inCurrent) {
            // Modification (both have pixels) - Yellow/Orange tint
            diff.data[idx] = Math.min(255, diff.data[idx] + 80);      // Boost red
            diff.data[idx + 1] = Math.min(255, diff.data[idx + 1] + 40); // Slight boost green (makes orange)
            diff.data[idx + 2] = Math.max(0, diff.data[idx + 2] - 80);   // Reduce blue
          } else if (inCurrent && !inBaseline) {
            // Addition (only in current) - Green tint
            diff.data[idx] = Math.max(0, diff.data[idx] - 50);
            diff.data[idx + 1] = Math.min(255, diff.data[idx + 1] + 100);
            diff.data[idx + 2] = Math.max(0, diff.data[idx + 2] - 50);
          } else if (inBaseline && !inCurrent) {
            // Deletion (only in baseline) - Red tint
            const baseIdx = (y * baseline.width + x) << 2;
            diff.data[idx] = Math.min(255, baseline.data[baseIdx] + 100);
            diff.data[idx + 1] = Math.max(0, baseline.data[baseIdx + 1] - 50);
            diff.data[idx + 2] = Math.max(0, baseline.data[baseIdx + 2] - 50);
            diff.data[idx + 3] = 255;
          }
        }
      }
    }

    return PNG.sync.write(diff);
  }
}
