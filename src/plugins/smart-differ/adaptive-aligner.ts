// ABOUTME: Adaptive row-by-row alignment with sliding window search (Tier 1)
// ABOUTME: Fast path for common cases with content shift detection

import { PNG } from 'pngjs';
import type { AlignmentRegion, SmartDifferConfig } from './types';

export interface AlignmentResult {
  regions: AlignmentRegion[];
  confidence: number;
  fallbackTriggered: boolean;
}

export class AdaptiveAligner {
  constructor(private config: SmartDifferConfig) {}

  async align(baseline: PNG, current: PNG): Promise<AlignmentResult> {
    const regions: AlignmentRegion[] = [];
    let baselineY = 0;
    let currentY = 0;
    let fallbackCount = 0;
    let totalComparisons = 0;
    let successfulMatches = 0;

    while (baselineY < baseline.height || currentY < current.height) {
      totalComparisons++;

      // Check if we've exhausted one image
      if (baselineY >= baseline.height) {
        // Remaining current content is inserted
        regions.push({
          type: 'inserted',
          baseline: null,
          current: {
            x: 0,
            y: currentY,
            width: current.width,
            height: current.height - currentY
          },
          similarity: null
        });
        break;
      }

      if (currentY >= current.height) {
        // Remaining baseline content is deleted
        regions.push({
          type: 'deleted',
          baseline: {
            x: 0,
            y: baselineY,
            width: baseline.width,
            height: baseline.height - baselineY
          },
          current: null,
          similarity: null
        });
        break;
      }

      // Compare current rows
      const similarity = this.compareRows(baseline, baselineY, current, currentY);

      if (similarity >= this.config.adaptiveThreshold) {
        // Rows match - record matched region
        const matchHeight = this.findMatchingStretch(
          baseline,
          baselineY,
          current,
          currentY
        );

        regions.push({
          type: 'matched',
          baseline: {
            x: 0,
            y: baselineY,
            width: baseline.width,
            height: matchHeight
          },
          current: {
            x: 0,
            y: currentY,
            width: current.width,
            height: matchHeight
          },
          similarity
        });

        baselineY += matchHeight;
        currentY += matchHeight;
        successfulMatches++;
      } else {
        // Mismatch - try sliding window search
        const alignment = this.searchAlignment(
          baseline,
          baselineY,
          current,
          currentY
        );

        if (alignment) {
          // Found alignment - record insertion or deletion
          if (alignment.currentOffset > 0) {
            // Content inserted in current
            regions.push({
              type: 'inserted',
              baseline: null,
              current: {
                x: 0,
                y: currentY,
                width: current.width,
                height: alignment.currentOffset
              },
              similarity: null
            });
            currentY += alignment.currentOffset;
          } else if (alignment.baselineOffset > 0) {
            // Content deleted from baseline
            regions.push({
              type: 'deleted',
              baseline: {
                x: 0,
                y: baselineY,
                width: baseline.width,
                height: alignment.baselineOffset
              },
              current: null,
              similarity: null
            });
            baselineY += alignment.baselineOffset;
          }
        } else {
          // No alignment found - increment fallback
          fallbackCount++;

          if (fallbackCount >= this.config.fallbackThreshold) {
            // Trigger fallback to Tier 2
            return {
              regions: [],
              confidence: 0.5,
              fallbackTriggered: true
            };
          }

          // Record small mismatched region and continue
          const chunkSize = Math.min(10, baseline.height - baselineY, current.height - currentY);
          regions.push({
            type: 'matched',
            baseline: {
              x: 0,
              y: baselineY,
              width: baseline.width,
              height: chunkSize
            },
            current: {
              x: 0,
              y: currentY,
              width: current.width,
              height: chunkSize
            },
            similarity: 0.5
          });
          baselineY += chunkSize;
          currentY += chunkSize;
        }
      }
    }

    // Calculate confidence
    const confidence = totalComparisons > 0
      ? 0.5 + (successfulMatches / totalComparisons) * 0.5
      : 0.5;

    return {
      regions,
      confidence: Math.min(1.0, confidence),
      fallbackTriggered: false
    };
  }

  private compareRows(
    img1: PNG,
    row1: number,
    img2: PNG,
    row2: number
  ): number {
    if (row1 >= img1.height || row2 >= img2.height) return 0;

    const width = Math.min(img1.width, img2.width);
    let matchingPixels = 0;

    for (let x = 0; x < width; x++) {
      const idx1 = (img1.width * row1 + x) << 2;
      const idx2 = (img2.width * row2 + x) << 2;

      const rDiff = Math.abs(img1.data[idx1] - img2.data[idx2]);
      const gDiff = Math.abs(img1.data[idx1 + 1] - img2.data[idx2 + 1]);
      const bDiff = Math.abs(img1.data[idx1 + 2] - img2.data[idx2 + 2]);

      const avgDiff = (rDiff + gDiff + bDiff) / 3;

      if (avgDiff < 25) { // Threshold for pixel match
        matchingPixels++;
      }
    }

    return matchingPixels / width;
  }

  private findMatchingStretch(
    baseline: PNG,
    baselineY: number,
    current: PNG,
    currentY: number
  ): number {
    let height = 1;
    const maxHeight = Math.min(
      baseline.height - baselineY,
      current.height - currentY,
      100 // Cap at 100 rows for efficiency
    );

    while (height < maxHeight) {
      const similarity = this.compareRows(
        baseline,
        baselineY + height,
        current,
        currentY + height
      );

      if (similarity < this.config.adaptiveThreshold) {
        break;
      }

      height++;
    }

    return height;
  }

  private searchAlignment(
    baseline: PNG,
    baselineY: number,
    current: PNG,
    currentY: number
  ): { baselineOffset: number; currentOffset: number } | null {
    const { searchWindow } = this.config;

    // Search forward in current image
    for (let offset = 1; offset <= searchWindow && currentY + offset < current.height; offset++) {
      const similarity = this.compareRows(baseline, baselineY, current, currentY + offset);
      if (similarity >= this.config.adaptiveThreshold) {
        return { baselineOffset: 0, currentOffset: offset };
      }
    }

    // Search forward in baseline image
    for (let offset = 1; offset <= searchWindow && baselineY + offset < baseline.height; offset++) {
      const similarity = this.compareRows(baseline, baselineY + offset, current, currentY);
      if (similarity >= this.config.adaptiveThreshold) {
        return { baselineOffset: offset, currentOffset: 0 };
      }
    }

    return null;
  }
}
