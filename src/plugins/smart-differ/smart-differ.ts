// ABOUTME: Smart differ orchestrator with two-tier hybrid strategy
// ABOUTME: Replaces PixelmatchDiffer with content-aware alignment and backward compatibility

import type { Differ, Screenshot, DiffResult, BoundingBox } from '../../types/plugins';
import { PNG } from 'pngjs';
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

    // Try Tier 1: Adaptive alignment
    const alignmentResult = await this.aligner.align(baselinePng, currentPng);

    let regions = alignmentResult.regions;
    let confidence = alignmentResult.confidence;

    // Fallback to Tier 2 if needed
    if (alignmentResult.fallbackTriggered) {
      const matchResult = await this.matcher.match(baselinePng, currentPng);
      regions = matchResult.regions;
      confidence = matchResult.confidence;
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
    const totalPixels = Math.max(baseline.width * baseline.height, current.width * current.height);
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
