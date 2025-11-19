// ABOUTME: Tests for result type definitions, ensuring CheckpointResult, TestResult, and RunResult can be created correctly.
// ABOUTME: Validates structure for passing tests, errored tests, and full run summaries.
import { RunResult, TestResult, CheckpointResult } from './results';

describe('Result Types', () => {
  describe('CheckpointResult', () => {
    it('should create valid checkpoint result', () => {
      const checkpoint: CheckpointResult = {
        name: 'initial',
        baselineImage: '.visual-uat/screenshots/base/test/initial.png',
        currentImage: '.visual-uat/screenshots/current/test/initial.png',
        diffImage: '.visual-uat/diffs/test/initial.png',
        diffMetrics: {
          pixelDiffPercent: 2.5,
          changedRegions: [{ x: 10, y: 20, width: 100, height: 50 }]
        },
        evaluation: {
          pass: true,
          confidence: 0.98,
          reason: 'Expected button color change',
          needsReview: false
        }
      };

      expect(checkpoint.name).toBe('initial');
      expect(checkpoint.diffMetrics.pixelDiffPercent).toBe(2.5);
      expect(checkpoint.evaluation.pass).toBe(true);
    });
  });

  describe('TestResult', () => {
    it('should create valid test result', () => {
      const testResult: TestResult = {
        specPath: 'tests/login.md',
        generatedPath: 'tests/generated/login.spec.ts',
        status: 'passed',
        checkpoints: [],
        duration: 1500
      };

      expect(testResult.status).toBe('passed');
      expect(testResult.duration).toBe(1500);
    });

    it('should include error for errored test', () => {
      const testResult: TestResult = {
        specPath: 'tests/broken.md',
        generatedPath: 'tests/generated/broken.spec.ts',
        status: 'errored',
        checkpoints: [],
        error: 'Server timeout',
        duration: 30000
      };

      expect(testResult.status).toBe('errored');
      expect(testResult.error).toBe('Server timeout');
    });
  });

  describe('RunResult', () => {
    it('should create valid run result', () => {
      const runResult: RunResult = {
        runId: 'abc1234',
        timestamp: 1731870123,
        baseBranch: 'main',
        currentBranch: 'feature/new-ui',
        config: {} as any,
        tests: [],
        summary: {
          total: 5,
          passed: 3,
          failed: 1,
          errored: 0,
          needsReview: 1
        }
      };

      expect(runResult.summary.total).toBe(5);
      expect(runResult.summary.passed).toBe(3);
    });
  });

  describe('RunResult with runId', () => {
    it('should include runId in RunResult', () => {
      const result: RunResult = {
        runId: 'a3f7b9c',
        timestamp: Date.now(),
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      };

      expect(result.runId).toBe('a3f7b9c');
      expect(result.runId).toHaveLength(7);
    });
  });
});
