// ABOUTME: Smart differ orchestrator with two-tier hybrid strategy
// ABOUTME: Replaces PixelmatchDiffer with content-aware alignment and backward compatibility

import type { Differ, Screenshot, DiffResult, BoundingBox } from '../../types/plugins';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { AdaptiveAligner } from './adaptive-aligner';
import { FeatureMatcher } from './feature-matcher';
import { DiffRenderer } from './diff-renderer';
import type { SmartDifferConfig } from './types';
import { DEFAULT_CONFIG } from './types';

export class SmartDiffer implements Differ {
  private config: SmartDifferConfig;
  private aligner: AdaptiveAligner;
  private matcher: FeatureMatcher;
  private renderer: DiffRenderer;

  constructor(config?: Partial<SmartDifferConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.aligner = new AdaptiveAligner(this.config);
    this.matcher = new FeatureMatcher(this.config);
    this.renderer = new DiffRenderer();
  }

  async compare(baseline: Screenshot, current: Screenshot): Promise<DiffResult> {
    const baselinePng = PNG.sync.read(baseline.data);
    const currentPng = PNG.sync.read(current.data);

    // Fast path: If images have same dimensions, use pixelmatch directly
    // This gives pixel-level precision instead of chunked regions
    if (baselinePng.width === currentPng.width && baselinePng.height === currentPng.height) {
      return this.compareWithPixelmatch(baselinePng, currentPng);
    }

    // Different dimensions: Use adaptive alignment to handle content shifts
    const alignmentResult = await this.aligner.align(baselinePng, currentPng);

    let regions = alignmentResult.regions;

    // Fallback to Tier 2 if needed
    if (alignmentResult.fallbackTriggered) {
      const matchResult = await this.matcher.match(baselinePng, currentPng);
      regions = matchResult.regions;
    }

    // Render diff image
    const diffImage = await this.renderer.render(regions, baselinePng, currentPng);

    // Calculate changed regions and pixel diff percentage
    const changedRegions = this.extractChangedRegions(regions);
    const pixelDiffPercent = this.calculatePixelDiff(regions, baselinePng, currentPng);
    const identical = pixelDiffPercent === 0;

    return {
      diffImage,
      pixelDiffPercent,
      changedRegions,
      identical
    };
  }

  /**
   * Direct pixelmatch comparison for same-dimension images.
   * Provides pixel-level precision without chunked regions.
   */
  private compareWithPixelmatch(baseline: PNG, current: PNG): DiffResult {
    const { width, height } = baseline;
    const diffPng = new PNG({ width, height });

    // Run pixelmatch for pixel-level diff
    const diffPixels = pixelmatch(
      baseline.data,
      current.data,
      diffPng.data,
      width,
      height,
      { threshold: 0.1 }
    );

    const totalPixels = width * height;
    const pixelDiffPercent = (diffPixels / totalPixels) * 100;
    const identical = diffPixels === 0;

    // Extract changed regions by finding bounding boxes of diff pixels
    const changedRegions = this.extractChangedRegionsFromDiff(diffPng);

    return {
      diffImage: PNG.sync.write(diffPng),
      pixelDiffPercent,
      changedRegions,
      identical
    };
  }

  /**
   * Extract bounding boxes of changed regions from a pixelmatch diff image.
   * Groups contiguous changed pixels into rectangular regions.
   */
  private extractChangedRegionsFromDiff(diffPng: PNG): BoundingBox[] {
    const { width, height, data } = diffPng;
    const regions: BoundingBox[] = [];
    const visited = new Set<number>();

    // Find all diff pixels (pixelmatch outputs red for differences)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) << 2;
        // Pixelmatch colors diff pixels red (255, 0, 0) or similar
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        // Check if this is a diff pixel (red-ish, not gray background)
        const isDiff = r > 200 && g < 100 && b < 100;

        if (isDiff && !visited.has(y * width + x)) {
          // Flood-fill to find connected region bounds
          const bounds = this.findRegionBounds(diffPng, x, y, visited);
          if (bounds.width > 0 && bounds.height > 0) {
            regions.push(bounds);
          }
        }
      }
    }

    return regions;
  }

  /**
   * Find bounding box of a connected diff region using flood-fill.
   */
  private findRegionBounds(
    diffPng: PNG,
    startX: number,
    startY: number,
    visited: Set<number>
  ): BoundingBox {
    const { width, height, data } = diffPng;
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;

    const stack: [number, number][] = [[startX, startY]];

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = y * width + x;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited.has(key)) continue;

      const idx = key << 2;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const isDiff = r > 200 && g < 100 && b < 100;

      if (!isDiff) continue;

      visited.add(key);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);

      // Check neighbors (4-connected)
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    };
  }

  private extractChangedRegions(regions: import('./types').AlignmentRegion[]): BoundingBox[] {
    const changed: BoundingBox[] = [];

    for (const region of regions) {
      if (region.type === 'inserted' && region.current) {
        changed.push(region.current);
      } else if (region.type === 'deleted' && region.baseline) {
        changed.push(region.baseline);
      } else if (region.type === 'matched' && region.similarity !== null && region.similarity < 1.0) {
        // Changed matched region
        if (region.current) {
          changed.push(region.current);
        }
      }
    }

    return changed;
  }

  private calculatePixelDiff(
    regions: import('./types').AlignmentRegion[],
    baseline: PNG,
    current: PNG
  ): number {
    // Use union of both images as denominator to prevent >100% when counting
    // both insertions (in current) and deletions (from baseline)
    const totalPixels = baseline.width * baseline.height + current.width * current.height;
    let changedPixels = 0;

    for (const region of regions) {
      if (region.type === 'inserted' && region.current) {
        changedPixels += region.current.width * region.current.height;
      } else if (region.type === 'deleted' && region.baseline) {
        changedPixels += region.baseline.width * region.baseline.height;
      } else if (region.type === 'matched' && region.similarity !== null && region.current) {
        // Estimate changed pixels based on similarity
        const regionPixels = region.current.width * region.current.height;
        changedPixels += regionPixels * (1 - region.similarity);
      }
    }

    return (changedPixels / totalPixels) * 100;
  }
}
