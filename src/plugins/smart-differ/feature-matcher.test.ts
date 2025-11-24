// ABOUTME: Tests for feature-based matching using perceptual hashing
// ABOUTME: Validates block division, hash computation, and correspondence matching

import { FeatureMatcher } from './feature-matcher';
import { PNG } from 'pngjs';
import type { SmartDifferConfig } from './types';
import { DEFAULT_CONFIG } from './types';

describe('FeatureMatcher', () => {
  const config: SmartDifferConfig = DEFAULT_CONFIG;
  const matcher = new FeatureMatcher(config);

  function createTestImage(width: number, height: number, color: [number, number, number]): PNG {
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
    return png;
  }

  function createBlockImage(width: number, height: number, blockHeight: number): PNG {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      const block = Math.floor(y / blockHeight);
      const color = block % 3 === 0
        ? [255, 0, 0]
        : block % 3 === 1
        ? [0, 255, 0]
        : [0, 0, 255];

      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        png.data[idx] = color[0];
        png.data[idx + 1] = color[1];
        png.data[idx + 2] = color[2];
        png.data[idx + 3] = 255;
      }
    }
    return png;
  }

  it('should match identical images', async () => {
    const img1 = createTestImage(100, 200, [255, 0, 0]);
    const img2 = createTestImage(100, 200, [255, 0, 0]);

    const result = await matcher.match(img1, img2);

    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].type).toBe('matched');
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it('should detect reordered blocks', async () => {
    // Baseline: red, green, blue
    const baseline = createBlockImage(100, 150, 50);

    // Current: green, red, blue (middle blocks swapped)
    const current = new PNG({ width: 100, height: 150 });
    // Green block first
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        current.data[idx] = 0;
        current.data[idx + 1] = 255;
        current.data[idx + 2] = 0;
        current.data[idx + 3] = 255;
      }
    }
    // Red block second
    for (let y = 50; y < 100; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        current.data[idx] = 255;
        current.data[idx + 1] = 0;
        current.data[idx + 2] = 0;
        current.data[idx + 3] = 255;
      }
    }
    // Blue block third
    for (let y = 100; y < 150; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        current.data[idx] = 0;
        current.data[idx + 1] = 0;
        current.data[idx + 2] = 255;
        current.data[idx + 3] = 255;
      }
    }

    const result = await matcher.match(baseline, current);

    // Should detect that blocks exist in different order
    expect(result.regions.length).toBeGreaterThan(1);
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  it('should detect inserted content', async () => {
    // Baseline: red, blue (100x100 total)
    const baseline = createBlockImage(100, 100, 50);

    // Current: red, green (new), blue (100x150 total)
    const current = createBlockImage(100, 150, 50);

    const result = await matcher.match(baseline, current);

    const insertedRegions = result.regions.filter(r => r.type === 'inserted');
    expect(insertedRegions.length).toBeGreaterThan(0);
  });

  it('should detect deleted content', async () => {
    // Baseline: red, green, blue (100x150 total)
    const baseline = createBlockImage(100, 150, 50);

    // Current: red, blue (100x100 total) - green removed
    const current = createBlockImage(100, 100, 50);

    const result = await matcher.match(baseline, current);

    const deletedRegions = result.regions.filter(r => r.type === 'deleted');
    expect(deletedRegions.length).toBeGreaterThan(0);
  });

  it('should handle completely different images', async () => {
    const img1 = createTestImage(100, 100, [255, 0, 0]);
    const img2 = createTestImage(100, 100, [0, 255, 0]);

    const result = await matcher.match(img1, img2);

    expect(result.confidence).toBeLessThan(0.7);
    expect(result.regions.length).toBeGreaterThan(0);
  });
});
