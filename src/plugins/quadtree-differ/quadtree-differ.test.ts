// ABOUTME: Tests for quadtree-based image diffing
// ABOUTME: Validates recursive subdivision finds localized changes

import { PNG } from 'pngjs';
import { QuadtreeDiffer } from './quadtree-differ';

describe('QuadtreeDiffer', () => {
  let differ: QuadtreeDiffer;

  beforeEach(() => {
    differ = new QuadtreeDiffer();
  });

  describe('compare', () => {
    it('should detect identical images', async () => {
      const img = new PNG({ width: 100, height: 100 });
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = 255;
      }
      const buffer = PNG.sync.write(img);

      const result = await differ.compare(
        { data: buffer, width: 100, height: 100, checkpoint: 'test' },
        { data: buffer, width: 100, height: 100, checkpoint: 'test' }
      );

      expect(result.identical).toBe(true);
      expect(result.pixelDiffPercent).toBe(0);
    });

    it('should isolate change to quadrant', async () => {
      const baseline = new PNG({ width: 100, height: 100 });
      const current = new PNG({ width: 100, height: 100 });

      // Fill both white
      for (let i = 0; i < baseline.data.length; i += 4) {
        baseline.data[i] = 255;
        baseline.data[i + 1] = 255;
        baseline.data[i + 2] = 255;
        baseline.data[i + 3] = 255;
        current.data[i] = 255;
        current.data[i + 1] = 255;
        current.data[i + 2] = 255;
        current.data[i + 3] = 255;
      }

      // Make top-left quadrant red in current
      for (let y = 0; y < 50; y++) {
        for (let x = 0; x < 50; x++) {
          const idx = (y * 100 + x) << 2;
          current.data[idx] = 255;
          current.data[idx + 1] = 0;
          current.data[idx + 2] = 0;
        }
      }

      const baselineBuffer = PNG.sync.write(baseline);
      const currentBuffer = PNG.sync.write(current);

      const result = await differ.compare(
        { data: baselineBuffer, width: 100, height: 100, checkpoint: 'test' },
        { data: currentBuffer, width: 100, height: 100, checkpoint: 'test' }
      );

      expect(result.identical).toBe(false);
      expect(result.changedRegions.length).toBeGreaterThan(0);
      // Changed region should be in top-left area
      const region = result.changedRegions[0];
      expect(region.x).toBeLessThan(50);
      expect(region.y).toBeLessThan(50);
    });
  });
});
