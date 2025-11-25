// ABOUTME: Tests for diff image renderer with colored region annotations
// ABOUTME: Validates green=insertion, red=deletion, pink/yellow=pixel changes

import { DiffRenderer } from './diff-renderer';
import { PNG } from 'pngjs';
import type { AlignmentRegion } from './types';

describe('DiffRenderer', () => {
  const renderer = new DiffRenderer();

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

  it('should render matched regions with no highlighting', async () => {
    const baseline = createTestImage(100, 100, [255, 0, 0]);
    const current = createTestImage(100, 100, [255, 0, 0]);

    const regions: AlignmentRegion[] = [{
      type: 'matched',
      baseline: { x: 0, y: 0, width: 100, height: 100 },
      current: { x: 0, y: 0, width: 100, height: 100 },
      similarity: 1.0
    }];

    const result = await renderer.render(regions, baseline, current);

    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should render inserted regions in green', async () => {
    const baseline = createTestImage(100, 50, [255, 0, 0]);
    const current = createTestImage(100, 100, [255, 0, 0]);

    const regions: AlignmentRegion[] = [{
      type: 'inserted',
      baseline: null,
      current: { x: 0, y: 50, width: 100, height: 50 },
      similarity: null
    }];

    const result = await renderer.render(regions, baseline, current);

    // Verify green overlay exists in inserted region
    const png = PNG.sync.read(result);
    const idx = (100 * 75 + 50) << 2; // Middle of inserted region
    expect(png.data[idx + 1]).toBeGreaterThan(200); // Green channel
  });

  it('should render deleted regions in red', async () => {
    const baseline = createTestImage(100, 100, [255, 0, 0]);
    const current = createTestImage(100, 50, [255, 0, 0]);

    const regions: AlignmentRegion[] = [{
      type: 'deleted',
      baseline: { x: 0, y: 50, width: 100, height: 50 },
      current: null,
      similarity: null
    }];

    const result = await renderer.render(regions, baseline, current);

    // Verify red overlay exists in deleted region
    const png = PNG.sync.read(result);
    const idx = (100 * 75 + 50) << 2; // Middle of deleted region
    expect(png.data[idx]).toBeGreaterThan(200); // Red channel
  });

  it('should render matched regions with low similarity in pink', async () => {
    const baseline = createTestImage(100, 100, [255, 0, 0]);
    const current = createTestImage(100, 100, [0, 255, 0]);

    const regions: AlignmentRegion[] = [{
      type: 'matched',
      baseline: { x: 0, y: 0, width: 100, height: 100 },
      current: { x: 0, y: 0, width: 100, height: 100 },
      similarity: 0.5
    }];

    const result = await renderer.render(regions, baseline, current);

    // Verify pink/yellow overlay for pixel differences
    const png = PNG.sync.read(result);
    const idx = (100 * 50 + 50) << 2; // Middle
    expect(png.data[idx]).toBeGreaterThan(0); // Some red
  });
});
