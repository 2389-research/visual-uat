// ABOUTME: Renders annotated diff images with colored region overlays
// ABOUTME: Green=insertion, red=deletion, pink/yellow=pixel-level changes

import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { AlignmentRegion } from './types';

export class DiffRenderer {
  async render(
    regions: AlignmentRegion[],
    baseline: PNG,
    current: PNG
  ): Promise<Buffer> {
    // Create output image based on maximum dimensions
    const maxWidth = Math.max(baseline.width, current.width);
    const maxHeight = Math.max(baseline.height, current.height);
    const output = new PNG({ width: maxWidth, height: maxHeight });

    // Fill with white background
    for (let i = 0; i < output.data.length; i += 4) {
      output.data[i] = 255;     // R
      output.data[i + 1] = 255; // G
      output.data[i + 2] = 255; // B
      output.data[i + 3] = 255; // A
    }

    // Render each region
    for (const region of regions) {
      if (region.type === 'matched') {
        this.renderMatched(region, baseline, current, output);
      } else if (region.type === 'inserted') {
        this.renderInserted(region, current, output);
      } else if (region.type === 'deleted') {
        this.renderDeleted(region, baseline, output);
      }
    }

    return PNG.sync.write(output);
  }

  private renderMatched(
    region: AlignmentRegion & { type: 'matched' },
    baseline: PNG,
    current: PNG,
    output: PNG
  ): void {
    const { baseline: baseBox, current: currBox, similarity } = region;

    if (similarity === 1.0) {
      // Perfect match - just copy current image
      this.copyRegion(current, currBox, output, currBox);
    } else {
      // Imperfect match - use pixelmatch to highlight differences
      const regionDiff = new PNG({ width: currBox.width, height: currBox.height });

      // Extract region data
      const baseData = this.extractRegion(baseline, baseBox);
      const currData = this.extractRegion(current, currBox);

      // Compare with pixelmatch
      pixelmatch(baseData, currData, regionDiff.data, currBox.width, currBox.height, {
        threshold: 0.1
      });

      // Copy diff to output
      this.copyRegion(regionDiff, { x: 0, y: 0, width: currBox.width, height: currBox.height }, output, currBox);
    }
  }

  private renderInserted(
    region: AlignmentRegion & { type: 'inserted' },
    current: PNG,
    output: PNG
  ): void {
    const { current: box } = region;

    // Copy current image data
    this.copyRegion(current, box, output, box);

    // Add green overlay
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let x = box.x; x < box.x + box.width; x++) {
        const idx = (output.width * y + x) << 2;
        output.data[idx] = Math.floor(output.data[idx] * 0.5);         // Dim red
        output.data[idx + 1] = Math.min(255, Math.floor(output.data[idx + 1] + 205)); // Boost green
        output.data[idx + 2] = Math.floor(output.data[idx + 2] * 0.5);  // Dim blue
      }
    }
  }

  private renderDeleted(
    region: AlignmentRegion & { type: 'deleted' },
    baseline: PNG,
    output: PNG
  ): void {
    const { baseline: box } = region;

    // Copy baseline image data
    this.copyRegion(baseline, box, output, box);

    // Add red overlay
    for (let y = box.y; y < box.y + box.height; y++) {
      for (let x = box.x; x < box.x + box.width; x++) {
        const idx = (output.width * y + x) << 2;
        output.data[idx] = Math.min(255, Math.floor(output.data[idx] + 205));      // Boost red
        output.data[idx + 1] = Math.floor(output.data[idx + 1] * 0.5); // Dim green
        output.data[idx + 2] = Math.floor(output.data[idx + 2] * 0.5); // Dim blue
      }
    }
  }

  private copyRegion(
    source: PNG,
    sourceBox: { x: number; y: number; width: number; height: number },
    dest: PNG,
    destBox: { x: number; y: number; width: number; height: number }
  ): void {
    for (let y = 0; y < sourceBox.height; y++) {
      for (let x = 0; x < sourceBox.width; x++) {
        const srcIdx = (source.width * (sourceBox.y + y) + (sourceBox.x + x)) << 2;
        const dstIdx = (dest.width * (destBox.y + y) + (destBox.x + x)) << 2;

        dest.data[dstIdx] = source.data[srcIdx];
        dest.data[dstIdx + 1] = source.data[srcIdx + 1];
        dest.data[dstIdx + 2] = source.data[srcIdx + 2];
        dest.data[dstIdx + 3] = source.data[srcIdx + 3];
      }
    }
  }

  private extractRegion(
    source: PNG,
    box: { x: number; y: number; width: number; height: number }
  ): Buffer {
    const data = Buffer.alloc(box.width * box.height * 4);

    for (let y = 0; y < box.height; y++) {
      for (let x = 0; x < box.width; x++) {
        const srcIdx = (source.width * (box.y + y) + (box.x + x)) << 2;
        const dstIdx = (box.width * y + x) << 2;

        data[dstIdx] = source.data[srcIdx];
        data[dstIdx + 1] = source.data[srcIdx + 1];
        data[dstIdx + 2] = source.data[srcIdx + 2];
        data[dstIdx + 3] = source.data[srcIdx + 3];
      }
    }

    return data;
  }
}
