// ABOUTME: Pixelmatch-based screenshot differ for visual comparison
// ABOUTME: Generates pixel-level diffs and calculates change metrics

import type { Differ, Screenshot, DiffResult, BoundingBox } from '../types/plugins';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export class PixelmatchDiffer implements Differ {
  async compare(baseline: Screenshot, current: Screenshot): Promise<DiffResult> {
    if (baseline.width !== current.width || baseline.height !== current.height) {
      throw new Error(
        `Image dimensions mismatch: baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`
      );
    }

    const img1 = PNG.sync.read(baseline.data);
    const img2 = PNG.sync.read(current.data);
    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      { threshold: 0.1 }
    );

    const totalPixels = width * height;
    const pixelDiffPercent = (numDiffPixels / totalPixels) * 100;
    const identical = numDiffPixels === 0;

    // Generate diff image
    const diffImage = PNG.sync.write(diff);

    // Calculate changed regions (simplified - single bounding box for all changes)
    const changedRegions = identical ? [] : this.findChangedRegions(diff.data, width, height);

    return {
      diffImage,
      pixelDiffPercent,
      changedRegions,
      identical
    };
  }

  private findChangedRegions(diffData: Buffer, width: number, height: number): BoundingBox[] {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasChanges = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        // Check if pixel is marked as different (red in diff image)
        if (diffData[idx] > 0) {
          hasChanges = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasChanges) return [];

    return [{
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    }];
  }
}
