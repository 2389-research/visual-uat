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
        timestamp: 1731870123,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [],
        summary: { total: 1, passed: 1, failed: 0, errored: 0, needsReview: 0 }
      };

      mockStore.loadLatestResult.mockResolvedValue(mockResult);

      const exitCode = await handler.execute();

      expect(mockStore.loadLatestResult).toHaveBeenCalled();
      expect(exitCode).toBe(0);
    });

    it('should load specific result when runId provided', async () => {
      const mockResult: RunResult = {
        timestamp: 1731870456,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [],
        summary: { total: 1, passed: 1, failed: 0, errored: 0, needsReview: 0 }
      };

      mockStore.loadResult.mockResolvedValue(mockResult);

      const exitCode = await handler.execute(1731870456);

      expect(mockStore.loadResult).toHaveBeenCalledWith(1731870456);
      expect(exitCode).toBe(0);
    });

    it('should return error code when no results found', async () => {
      mockStore.loadLatestResult.mockResolvedValue(null);

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const exitCode = await handler.execute();

      expect(consoleErrorSpy).toHaveBeenCalledWith('No test results found');
      expect(exitCode).toBe(1);

      consoleErrorSpy.mockRestore();
    });
  });
});
