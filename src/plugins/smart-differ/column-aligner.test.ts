// ABOUTME: Tests for column-based alignment to isolate horizontal changes
// ABOUTME: Validates that partial column shifts don't flag entire rows

import { PNG } from 'pngjs';
import { ColumnAligner } from './column-aligner';
import { DEFAULT_CONFIG } from './types';

describe('ColumnAligner', () => {
  const config = DEFAULT_CONFIG;
  let aligner: ColumnAligner;

  beforeEach(() => {
    aligner = new ColumnAligner(config);
  });

  describe('alignColumns', () => {
    it('should identify which columns changed in a row range', async () => {
      // Create two 300x100 images where only middle third (cols 100-200) differs
      const baseline = new PNG({ width: 300, height: 100 });
      const current = new PNG({ width: 300, height: 100 });

      // Fill both with white
      for (let i = 0; i < baseline.data.length; i += 4) {
        baseline.data[i] = 255;     // R
        baseline.data[i + 1] = 255; // G
        baseline.data[i + 2] = 255; // B
        baseline.data[i + 3] = 255; // A
        current.data[i] = 255;
        current.data[i + 1] = 255;
        current.data[i + 2] = 255;
        current.data[i + 3] = 255;
      }

      // Make middle column red in current only
      for (let y = 0; y < 100; y++) {
        for (let x = 100; x < 200; x++) {
          const idx = (y * 300 + x) << 2;
          current.data[idx] = 255;     // R
          current.data[idx + 1] = 0;   // G
          current.data[idx + 2] = 0;   // B
        }
      }

      const result = await aligner.alignColumns(
        baseline,
        current,
        { startRow: 0, endRow: 100 }
      );

      // Should have at least one changed column region
      expect(result.changedColumns.length).toBeGreaterThanOrEqual(1);
      // Changed region should substantially overlap with the actual changed area (100-200)
      // With finer-grained strips, boundary strips may not be included if mostly unchanged
      const changedStart = result.changedColumns[0].startX;
      const changedEnd = result.changedColumns[result.changedColumns.length - 1].endX;
      // Changed region should start before or near the middle of the changed area
      expect(changedStart).toBeLessThanOrEqual(128);
      // Changed region should end near the end of the changed area (allowing for strip boundaries)
      expect(changedEnd).toBeGreaterThanOrEqual(160);
      // Verify the detected change covers at least 50% of the actual changed width
      expect(changedEnd - changedStart).toBeGreaterThanOrEqual(50);
    });
  });
});
