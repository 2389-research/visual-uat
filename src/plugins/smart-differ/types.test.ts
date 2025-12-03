// ABOUTME: Tests for smart differ type definitions
// ABOUTME: Validates type structure and interface contracts

import type {
  AlignmentRegion,
  SmartDiffResult,
  SmartDifferConfig,
  MatchedRegion,
  InsertedRegion,
  DeletedRegion
} from './types';

describe('Smart Differ Types', () => {
  it('should accept valid matched region', () => {
    const region: MatchedRegion = {
      type: 'matched',
      baseline: { x: 0, y: 0, width: 100, height: 50 },
      current: { x: 0, y: 0, width: 100, height: 50 },
      similarity: 0.95
    };

    expect(region.type).toBe('matched');
    expect(region.similarity).toBeGreaterThan(0);
  });

  it('should accept valid inserted region', () => {
    const region: InsertedRegion = {
      type: 'inserted',
      baseline: null,
      current: { x: 0, y: 50, width: 100, height: 30 },
      similarity: null
    };

    expect(region.type).toBe('inserted');
    expect(region.baseline).toBeNull();
  });

  it('should accept valid deleted region', () => {
    const region: DeletedRegion = {
      type: 'deleted',
      baseline: { x: 0, y: 0, width: 100, height: 30 },
      current: null,
      similarity: null
    };

    expect(region.type).toBe('deleted');
    expect(region.current).toBeNull();
  });

  it('should accept valid SmartDiffResult', () => {
    const result: SmartDiffResult = {
      strategy: 'adaptive',
      confidence: 0.9,
      regions: []
    };

    expect(result.strategy).toBe('adaptive');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('should accept valid SmartDifferConfig', () => {
    const config: SmartDifferConfig = {
      adaptiveThreshold: 0.95,
      searchWindow: 50,
      blockSize: 50,
      fallbackThreshold: 3,
      enableColumnPass: true,
      columnPassThreshold: 0.5,
      columnStripWidth: 32
    };

    expect(config.adaptiveThreshold).toBeLessThanOrEqual(1);
    expect(config.searchWindow).toBeGreaterThan(0);
    expect(config.enableColumnPass).toBe(true);
    expect(config.columnPassThreshold).toBeLessThanOrEqual(1);
    expect(config.columnStripWidth).toBeGreaterThan(0);
  });
});
