// ABOUTME: Tests for plugin interface type definitions
// ABOUTME: Validates that all plugin interfaces are properly exported and type-safe

import type {
  TargetRunner,
  TestGenerator,
  Differ,
  Evaluator,
  TargetInfo,
  TestSpec,
  GeneratedTest,
  DiffResult,
  EvaluationInput,
  EvaluationResult
} from './plugins';

describe('Plugin Interfaces', () => {
  it('should export TargetRunner interface', () => {
    // Type-only test - if this compiles, types are correct
    const mockRunner: TargetRunner = {
      start: async (branch: string) => ({
        baseUrl: 'http://localhost:3000',
        environment: {},
        metadata: {}
      }),
      stop: async (info: TargetInfo) => {},
      isReady: async (info: TargetInfo) => true
    };
    expect(mockRunner).toBeDefined();
  });

  it('should export TestGenerator interface', () => {
    const mockGenerator: TestGenerator = {
      generate: async (spec: TestSpec, context: any) => ({
        code: 'test code',
        language: 'typescript',
        checkpoints: ['checkpoint1']
      })
    };
    expect(mockGenerator).toBeDefined();
  });

  it('should export Differ interface', () => {
    const mockDiffer: Differ = {
      compare: async (baseline: any, current: any) => ({
        diffImage: Buffer.from(''),
        pixelDiffPercent: 0,
        changedRegions: [],
        identical: true
      })
    };
    expect(mockDiffer).toBeDefined();
  });

  it('should export Evaluator interface', () => {
    const mockEvaluator: Evaluator = {
      evaluate: async (input: EvaluationInput) => ({
        pass: true,
        confidence: 0.95,
        reason: 'No changes detected',
        needsReview: false
      })
    };
    expect(mockEvaluator).toBeDefined();
  });
});
