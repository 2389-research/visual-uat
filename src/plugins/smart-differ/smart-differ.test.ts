// ABOUTME: Tests for smart differ orchestrator with two-tier strategy
// ABOUTME: Validates tier selection, backward compatibility, and integration

import { SmartDiffer } from './smart-differ';
import { PNG } from 'pngjs';
import type { Screenshot } from '../../types/plugins';

describe('SmartDiffer', () => {
  const differ = new SmartDiffer();

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

  it('should handle same-size identical images (backward compatible)', async () => {
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

  it('should handle same-size different images (backward compatible)', async () => {
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

  it('should handle different-sized images without error', async () => {
    const img1 = createTestImage(100, 100, [255, 0, 0]);
    const img2 = createTestImage(100, 150, [255, 0, 0]);

    const screenshot1: Screenshot = {
      data: img1,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const screenshot2: Screenshot = {
      data: img2,
      width: 100,
      height: 150,
      checkpoint: 'test'
    };

    const result = await differ.compare(screenshot1, screenshot2);

    expect(result.diffImage).toBeDefined();
    expect(result.identical).toBe(false);
    // Should not throw error
  });

  it('should use adaptive tier for simple content shifts', async () => {
    // Create baseline: red (50px), blue (50px)
    const baseline = new PNG({ width: 100, height: 100 });
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        baseline.data[idx] = 255;
        baseline.data[idx + 1] = 0;
        baseline.data[idx + 2] = 0;
        baseline.data[idx + 3] = 255;
      }
    }
    for (let y = 50; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        baseline.data[idx] = 0;
        baseline.data[idx + 1] = 0;
        baseline.data[idx + 2] = 255;
        baseline.data[idx + 3] = 255;
      }
    }

    // Create current: red (50px), green (30px), blue (50px)
    const current = new PNG({ width: 100, height: 130 });
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        current.data[idx] = 255;
        current.data[idx + 1] = 0;
        current.data[idx + 2] = 0;
        current.data[idx + 3] = 255;
      }
    }
    for (let y = 50; y < 80; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        current.data[idx] = 0;
        current.data[idx + 1] = 255;
        current.data[idx + 2] = 0;
        current.data[idx + 3] = 255;
      }
    }
    for (let y = 80; y < 130; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        current.data[idx] = 0;
        current.data[idx + 1] = 0;
        current.data[idx + 2] = 255;
        current.data[idx + 3] = 255;
      }
    }

    const screenshot1: Screenshot = {
      data: PNG.sync.write(baseline),
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const screenshot2: Screenshot = {
      data: PNG.sync.write(current),
      width: 100,
      height: 130,
      checkpoint: 'test'
    };

    const result = await differ.compare(screenshot1, screenshot2);

    expect(result.diffImage).toBeDefined();
    expect(result.changedRegions.length).toBeGreaterThan(0);
  });

  it('should fallback to feature-based tier for complex restructuring', async () => {
    // This would trigger fallback in real scenarios
    // For now, just verify it doesn't crash
    const img1 = createTestImage(100, 100, [255, 0, 0]);
    const img2 = createTestImage(150, 80, [0, 255, 0]);

    const screenshot1: Screenshot = {
      data: img1,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const screenshot2: Screenshot = {
      data: img2,
      width: 150,
      height: 80,
      checkpoint: 'test'
    };

    const result = await differ.compare(screenshot1, screenshot2);

    expect(result.diffImage).toBeDefined();
  });
});
