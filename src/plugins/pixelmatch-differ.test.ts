// ABOUTME: Tests for pixelmatch-based screenshot differ
// ABOUTME: Validates pixel-level comparison and diff image generation

import { PixelmatchDiffer } from './pixelmatch-differ';
import { PNG } from 'pngjs';
import type { Screenshot } from '../types/plugins';

describe('PixelmatchDiffer', () => {
  const differ = new PixelmatchDiffer();

  function createTestImage(width: number, height: number, color: [number, number, number]): Buffer {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        png.data[idx] = color[0];
        png.data[idx + 1] = color[1];
        png.data[idx + 2] = color[2];
        png.data[idx + 3] = 255;
      }
    }
    return PNG.sync.write(png);
  }

  it('should detect identical images', async () => {
    const img = createTestImage(100, 100, [255, 0, 0]);

    const screenshot1: Screenshot = {
      data: img,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const screenshot2: Screenshot = {
      data: img,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const result = await differ.compare(screenshot1, screenshot2);

    expect(result.identical).toBe(true);
    expect(result.pixelDiffPercent).toBe(0);
    expect(result.changedRegions).toHaveLength(0);
  });

  it('should detect different images', async () => {
    const img1 = createTestImage(100, 100, [255, 0, 0]);
    const img2 = createTestImage(100, 100, [0, 255, 0]);

    const screenshot1: Screenshot = {
      data: img1,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const screenshot2: Screenshot = {
      data: img2,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const result = await differ.compare(screenshot1, screenshot2);

    expect(result.identical).toBe(false);
    expect(result.pixelDiffPercent).toBeGreaterThan(50);
    expect(result.diffImage).toBeDefined();
  });

  it('should throw error for different dimensions', async () => {
    const img1 = createTestImage(100, 100, [255, 0, 0]);
    const img2 = createTestImage(200, 200, [255, 0, 0]);

    const screenshot1: Screenshot = {
      data: img1,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const screenshot2: Screenshot = {
      data: img2,
      width: 200,
      height: 200,
      checkpoint: 'test'
    };

    await expect(differ.compare(screenshot1, screenshot2)).rejects.toThrow();
  });
});
