// ABOUTME: Tests for adaptive row-by-row alignment with sliding window search
// ABOUTME: Validates content shift detection and realignment logic

import { AdaptiveAligner } from './adaptive-aligner';
import { PNG } from 'pngjs';
import type { SmartDifferConfig } from './types';
import { DEFAULT_CONFIG } from './types';

describe('AdaptiveAligner', () => {
  const config: SmartDifferConfig = DEFAULT_CONFIG;
  const aligner = new AdaptiveAligner(config);

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

  function createStripedImage(width: number, height: number, stripeHeight: number): PNG {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      const stripe = Math.floor(y / stripeHeight);
      const color = stripe % 2 === 0 ? [255, 0, 0] : [0, 0, 255];

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

  it('should align identical images perfectly', async () => {
    const img1 = createTestImage(100, 100, [255, 0, 0]);
    const img2 = createTestImage(100, 100, [255, 0, 0]);

    const result = await aligner.align(img1, img2);

    expect(result.regions).toHaveLength(1);
    expect(result.regions[0].type).toBe('matched');
    expect(result.regions[0].similarity).toBe(1.0);
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.fallbackTriggered).toBe(false);
  });

  it('should detect content insertion in the middle', async () => {
    // Baseline: red (50px), blue (50px)
    const baseline = createStripedImage(100, 100, 50);

    // Current: red (50px), green (30px), blue (50px)
    const current = new PNG({ width: 100, height: 130 });
    // Copy red stripe
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        current.data[idx] = 255;
        current.data[idx + 1] = 0;
        current.data[idx + 2] = 0;
        current.data[idx + 3] = 255;
      }
    }
    // Add green stripe (inserted)
    for (let y = 50; y < 80; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        current.data[idx] = 0;
        current.data[idx + 1] = 255;
        current.data[idx + 2] = 0;
        current.data[idx + 3] = 255;
      }
    }
    // Copy blue stripe
    for (let y = 80; y < 130; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        current.data[idx] = 0;
        current.data[idx + 1] = 0;
        current.data[idx + 2] = 255;
        current.data[idx + 3] = 255;
      }
    }

    const result = await aligner.align(baseline, current);

    // Should have 3 regions: matched (red), inserted (green), matched (blue)
    expect(result.regions.length).toBeGreaterThanOrEqual(2);

    const insertedRegions = result.regions.filter(r => r.type === 'inserted');
    expect(insertedRegions.length).toBeGreaterThan(0);

    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it('should detect content deletion', async () => {
    // Baseline: red (50px), green (30px), blue (50px)
    const baseline = new PNG({ width: 100, height: 130 });
    for (let y = 0; y < 50; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        baseline.data[idx] = 255;
        baseline.data[idx + 1] = 0;
        baseline.data[idx + 2] = 0;
        baseline.data[idx + 3] = 255;
      }
    }
    for (let y = 50; y < 80; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        baseline.data[idx] = 0;
        baseline.data[idx + 1] = 255;
        baseline.data[idx + 2] = 0;
        baseline.data[idx + 3] = 255;
      }
    }
    for (let y = 80; y < 130; y++) {
      for (let x = 0; x < 100; x++) {
        const idx = (100 * y + x) << 2;
        baseline.data[idx] = 0;
        baseline.data[idx + 1] = 0;
        baseline.data[idx + 2] = 255;
        baseline.data[idx + 3] = 255;
      }
    }

    // Current: red (50px), blue (50px) - green removed
    const current = createStripedImage(100, 100, 50);

    const result = await aligner.align(baseline, current);

    const deletedRegions = result.regions.filter(r => r.type === 'deleted');
    expect(deletedRegions.length).toBeGreaterThan(0);
  });

  it('should trigger fallback after threshold misalignments', async () => {
    const img1 = createTestImage(100, 100, [255, 0, 0]);
    const img2 = createTestImage(100, 100, [0, 255, 0]); // Completely different

    const result = await aligner.align(img1, img2);

    expect(result.fallbackTriggered).toBe(true);
  });

  describe('column pass integration', () => {
    it('should narrow down changed regions using column pass', async () => {
      // Create 300x200 images where middle column (100-200) has extra content
      const baseline = new PNG({ width: 300, height: 200 });
      const current = new PNG({ width: 300, height: 220 }); // 20px taller

      // Fill baseline white
      for (let i = 0; i < baseline.data.length; i += 4) {
        baseline.data[i] = 255;
        baseline.data[i + 1] = 255;
        baseline.data[i + 2] = 255;
        baseline.data[i + 3] = 255;
      }

      // Fill current - white everywhere, but middle column has red insert at row 100
      for (let y = 0; y < current.height; y++) {
        for (let x = 0; x < current.width; x++) {
          const idx = (y * current.width + x) << 2;
          // Middle column (100-200), rows 100-120: red (inserted content)
          if (x >= 100 && x < 200 && y >= 100 && y < 120) {
            current.data[idx] = 255;
            current.data[idx + 1] = 0;
            current.data[idx + 2] = 0;
          } else {
            current.data[idx] = 255;
            current.data[idx + 1] = 255;
            current.data[idx + 2] = 255;
          }
          current.data[idx + 3] = 255;
        }
      }

      const alignerWithColumnPass = new AdaptiveAligner({ ...DEFAULT_CONFIG, enableColumnPass: true });
      const result = await alignerWithColumnPass.align(baseline, current);

      // Should have narrowed regions that don't span full width
      const insertedRegion = result.regions.find(r => r.type === 'inserted');
      expect(insertedRegion).toBeDefined();
      if (insertedRegion?.current) {
        // The inserted region should be narrowed to middle column, not full width
        expect(insertedRegion.current.width).toBeLessThan(300);
      }
    });
  });
});
