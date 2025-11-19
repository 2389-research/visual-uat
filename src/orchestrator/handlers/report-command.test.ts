// src/orchestrator/handlers/report-command.test.ts
import { ReportCommandHandler } from './report-command';
import { ResultStore } from '../services/result-store';
import { RunResult } from '../types/results';

jest.mock('../services/result-store');

describe('ReportCommandHandler', () => {
  let mockStore: jest.Mocked<ResultStore>;
  let handler: ReportCommandHandler;

  beforeEach(() => {
    mockStore = {
      loadLatestResult: jest.fn(),
      loadResult: jest.fn()
    } as any;

    handler = new ReportCommandHandler(mockStore);
  });

  describe('execute', () => {
    it('should load latest result when no runId provided', async () => {
      const mockResult: RunResult = {
        runId: 'abc1234',
        timestamp: 1731870123,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [],
        summary: { total: 1, passed: 1, failed: 0, errored: 0, needsReview: 0 }
      };

      mockStore.loadLatestResult.mockResolvedValue(mockResult);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await handler.execute();

      expect(mockStore.loadLatestResult).toHaveBeenCalled();
      expect(exitCode).toBe(0);

      consoleLogSpy.mockRestore();
    });

    it('should load specific result when runId provided', async () => {
      const mockResult: RunResult = {
        runId: 'def5678',
        timestamp: 1731870456,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [],
        summary: { total: 1, passed: 1, failed: 0, errored: 0, needsReview: 0 }
      };

      mockStore.loadResult.mockResolvedValue(mockResult);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const exitCode = await handler.execute(1731870456);

      expect(mockStore.loadResult).toHaveBeenCalledWith(1731870456);
      expect(exitCode).toBe(0);

      consoleLogSpy.mockRestore();
    });

    it('should return error code when no results found', async () => {
      mockStore.loadLatestResult.mockResolvedValue(null);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const exitCode = await handler.execute();

      expect(consoleErrorSpy).toHaveBeenCalledWith('No test results found');
      expect(exitCode).toBe(1);

      consoleErrorSpy.mockRestore();
    });

    it('should display failed tests in output', async () => {
      const mockResult: RunResult = {
        runId: 'ghi9012',
        timestamp: 1731870123,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [
          {
            specPath: 'tests/checkout.md',
            generatedPath: 'generated/checkout.spec.ts',
            status: 'failed',
            checkpoints: [],
            duration: 100
          }
        ],
        summary: { total: 1, passed: 0, failed: 1, errored: 0, needsReview: 0 }
      };

      mockStore.loadLatestResult.mockResolvedValue(mockResult);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute();

      expect(consoleLogSpy).toHaveBeenCalledWith('✗ 1 failed');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nFailed tests:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - tests/checkout.md');

      consoleLogSpy.mockRestore();
    });

    it('should display tests needing review in output', async () => {
      const mockResult: RunResult = {
        runId: 'jkl3456',
        timestamp: 1731870123,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [
          {
            specPath: 'tests/login.md',
            generatedPath: 'generated/login.spec.ts',
            status: 'needs-review',
            checkpoints: [],
            duration: 150
          }
        ],
        summary: { total: 1, passed: 0, failed: 0, errored: 0, needsReview: 1 }
      };

      mockStore.loadLatestResult.mockResolvedValue(mockResult);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute();

      expect(consoleLogSpy).toHaveBeenCalledWith('⚠ 1 need manual review');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nReview needed:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - tests/login.md');

      consoleLogSpy.mockRestore();
    });

    it('should display errored test count in output', async () => {
      const mockResult: RunResult = {
        runId: 'mno7890',
        timestamp: 1731870123,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [
          {
            specPath: 'tests/payment.md',
            generatedPath: 'generated/payment.spec.ts',
            status: 'errored',
            checkpoints: [],
            duration: 50
          }
        ],
        summary: { total: 1, passed: 0, failed: 0, errored: 1, needsReview: 0 }
      };

      mockStore.loadLatestResult.mockResolvedValue(mockResult);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute();

      expect(consoleLogSpy).toHaveBeenCalledWith('⊗ 1 errored');

      consoleLogSpy.mockRestore();
    });

    it('should display all sections with mixed test statuses', async () => {
      const mockResult: RunResult = {
        runId: 'pqr1234',
        timestamp: 1731870123,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [
          {
            specPath: 'tests/checkout.md',
            generatedPath: 'generated/checkout.spec.ts',
            status: 'passed',
            checkpoints: [],
            duration: 100
          },
          {
            specPath: 'tests/login.md',
            generatedPath: 'generated/login.spec.ts',
            status: 'failed',
            checkpoints: [],
            duration: 150
          },
          {
            specPath: 'tests/signup.md',
            generatedPath: 'generated/signup.spec.ts',
            status: 'needs-review',
            checkpoints: [],
            duration: 200
          },
          {
            specPath: 'tests/payment.md',
            generatedPath: 'generated/payment.spec.ts',
            status: 'errored',
            checkpoints: [],
            duration: 50
          }
        ],
        summary: { total: 4, passed: 1, failed: 1, errored: 1, needsReview: 1 }
      };

      mockStore.loadLatestResult.mockResolvedValue(mockResult);
      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      await handler.execute();

      expect(consoleLogSpy).toHaveBeenCalledWith('\nVisual UAT Results:');
      expect(consoleLogSpy).toHaveBeenCalledWith('✓ 1 passed');
      expect(consoleLogSpy).toHaveBeenCalledWith('✗ 1 failed');
      expect(consoleLogSpy).toHaveBeenCalledWith('⚠ 1 need manual review');
      expect(consoleLogSpy).toHaveBeenCalledWith('⊗ 1 errored');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nFailed tests:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - tests/login.md');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nReview needed:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  - tests/signup.md');
      expect(consoleLogSpy).toHaveBeenCalledWith(`\nFull report: .visual-uat/results/run-${mockResult.timestamp}.json`);
      expect(consoleLogSpy).toHaveBeenCalledWith('Note: HTML reporter coming soon!');

      consoleLogSpy.mockRestore();
    });
  });
});
