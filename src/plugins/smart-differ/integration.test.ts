// ABOUTME: Integration tests for smart differ end-to-end scenarios
// ABOUTME: Tests real-world use cases with complex image manipulations

import { SmartDiffer } from './smart-differ';
import { PNG } from 'pngjs';
import type { Screenshot } from '../../types/plugins';

describe('SmartDiffer Integration', () => {
  const differ = new SmartDiffer();

  function createGradientImage(width: number, height: number, startY: number = 0): PNG {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      const intensity = Math.floor(((startY + y) / (height + startY)) * 255);
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        png.data[idx] = intensity;
        png.data[idx + 1] = intensity;
        png.data[idx + 2] = intensity;
        png.data[idx + 3] = 255;
      }
    }
    return png;
  }

  it('should handle header height change (real-world scenario)', async () => {
    // Simulate header redesign: page height changes from 942px to 720px
    const baseline = createGradientImage(800, 942);
    const current = createGradientImage(800, 720);

    const screenshot1: Screenshot = {
      data: PNG.sync.write(baseline),
      width: 800,
      height: 942,
      checkpoint: 'homepage'
    };

    const screenshot2: Screenshot = {
      data: PNG.sync.write(current),
      width: 800,
      height: 720,
      checkpoint: 'homepage'
    };

    const result = await differ.compare(screenshot1, screenshot2);

    expect(result.diffImage).toBeDefined();
    expect(result.changedRegions.length).toBeGreaterThan(0);
    // Should not throw dimension mismatch error
  });

  it('should detect navbar insertion without flagging page shift', async () => {
    // Baseline: content only (500px)
    const baseline = createGradientImage(800, 500);

    // Current: navbar (60px) + same content (500px) = 560px
    const current = new PNG({ width: 800, height: 560 });

    // Draw navbar (dark)
    for (let y = 0; y < 60; y++) {
      for (let x = 0; x < 800; x++) {
        const idx = (800 * y + x) << 2;
        current.data[idx] = 50;
        current.data[idx + 1] = 50;
        current.data[idx + 2] = 50;
        current.data[idx + 3] = 255;
      }
    }

    // Copy content (shifted down)
    const contentGradient = createGradientImage(800, 500);
    for (let y = 0; y < 500; y++) {
      for (let x = 0; x < 800; x++) {
        const srcIdx = (800 * y + x) << 2;
        const dstIdx = (800 * (y + 60) + x) << 2;
        current.data[dstIdx] = contentGradient.data[srcIdx];
        current.data[dstIdx + 1] = contentGradient.data[srcIdx + 1];
        current.data[dstIdx + 2] = contentGradient.data[srcIdx + 2];
        current.data[dstIdx + 3] = contentGradient.data[srcIdx + 3];
      }
    }

    const screenshot1: Screenshot = {
      data: PNG.sync.write(baseline),
      width: 800,
      height: 500,
      checkpoint: 'page'
    };

    const screenshot2: Screenshot = {
      data: PNG.sync.write(current),
      width: 800,
      height: 560,
      checkpoint: 'page'
    };

    const result = await differ.compare(screenshot1, screenshot2);

    // Should detect insertion but not flag the shifted content as different
    const insertedRegions = result.changedRegions.filter(r => r.y < 100);
    expect(insertedRegions.length).toBeGreaterThan(0);

    // Pixel diff should be proportional to insertion, not entire page
    expect(result.pixelDiffPercent).toBeLessThan(30);
  });

  it('should handle multiple content blocks reordering', async () => {
    // Real-world scenario: blocks with different heights reordered
    // Baseline: red block (80px) + green block (120px) + blue block (100px) = 300px
    const baseline = new PNG({ width: 800, height: 300 });
    const baselineBlocks = [
      { startY: 0, height: 80, color: [255, 0, 0] },
      { startY: 80, height: 120, color: [0, 255, 0] },
      { startY: 200, height: 100, color: [0, 0, 255] }
    ];

    for (const block of baselineBlocks) {
      for (let y = block.startY; y < block.startY + block.height; y++) {
        for (let x = 0; x < 800; x++) {
          const idx = (800 * y + x) << 2;
          baseline.data[idx] = block.color[0];
          baseline.data[idx + 1] = block.color[1];
          baseline.data[idx + 2] = block.color[2];
          baseline.data[idx + 3] = 255;
        }
      }
    }

    // Current: green block (120px) + blue block (100px) + red block (80px) = 300px
    // Same total height but blocks in different order
    const current = new PNG({ width: 800, height: 300 });
    const currentBlocks = [
      { startY: 0, height: 120, color: [0, 255, 0] },   // Green first
      { startY: 120, height: 100, color: [0, 0, 255] }, // Blue second
      { startY: 220, height: 80, color: [255, 0, 0] }   // Red last
    ];

    for (const block of currentBlocks) {
      for (let y = block.startY; y < block.startY + block.height; y++) {
        for (let x = 0; x < 800; x++) {
          const idx = (800 * y + x) << 2;
          current.data[idx] = block.color[0];
          current.data[idx + 1] = block.color[1];
          current.data[idx + 2] = block.color[2];
          current.data[idx + 3] = 255;
        }
      }
    }

    const screenshot1: Screenshot = {
      data: PNG.sync.write(baseline),
      width: 800,
      height: 300,
      checkpoint: 'blocks'
    };

    const screenshot2: Screenshot = {
      data: PNG.sync.write(current),
      width: 800,
      height: 300,
      checkpoint: 'blocks'
    };

    const result = await differ.compare(screenshot1, screenshot2);

    // Should detect changes (blocks are in different positions)
    expect(result.diffImage).toBeDefined();
    expect(result.identical).toBe(false);
    // The differ should detect that content has changed, even if blocks still exist
    expect(result.pixelDiffPercent).toBeGreaterThan(0);
  });
});
