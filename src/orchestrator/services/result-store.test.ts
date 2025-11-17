// src/orchestrator/services/result-store.test.ts
import { ResultStore } from './result-store';
import { RunResult } from '../types/results';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs');

describe('ResultStore', () => {
  let store: ResultStore;
  const projectRoot = '/fake/project';

  beforeEach(() => {
    store = new ResultStore(projectRoot);
    jest.clearAllMocks();
  });

  describe('saveRunResult', () => {
    it('should create results directory if not exists', async () => {
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
      const mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;

      mockExistsSync.mockReturnValue(false);

      const result: RunResult = {
        timestamp: 1731870123,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      };

      const path = await store.saveRunResult(result);

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.visual-uat/results'),
        { recursive: true }
      );
      expect(mockWriteFileSync).toHaveBeenCalled();
      expect(path).toContain('run-1731870123.json');
    });

    it('should serialize result to JSON', async () => {
      const mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;
      mockWriteFileSync.mockImplementation(() => {});

      const result: RunResult = {
        timestamp: 1731870123,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [],
        summary: { total: 1, passed: 1, failed: 0, errored: 0, needsReview: 0 }
      };

      await store.saveRunResult(result);

      const writeCall = mockWriteFileSync.mock.calls[0];
      const serialized = writeCall[1] as string;
      const parsed = JSON.parse(serialized);

      expect(parsed.timestamp).toBe(1731870123);
      expect(parsed.summary.passed).toBe(1);
    });
  });

  describe('loadLatestResult', () => {
    it('should find most recent result file', async () => {
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
      const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([
        'run-1731870123.json',
        'run-1731870456.json',
        'run-1731870100.json'
      ] as any);

      mockReadFileSync.mockReturnValue(JSON.stringify({
        timestamp: 1731870456,
        summary: { total: 1, passed: 1, failed: 0, errored: 0, needsReview: 0 }
      }));

      const result = await store.loadLatestResult();

      expect(result?.timestamp).toBe(1731870456);
    });

    it('should return null if no results exist', async () => {
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;

      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue([] as any);

      const result = await store.loadLatestResult();
      expect(result).toBeNull();
    });
  });

  describe('ensureDirectories', () => {
    it('should create all required directories', () => {
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;

      mockExistsSync.mockReturnValue(false);

      store.ensureDirectories();

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.visual-uat/screenshots/base'),
        { recursive: true }
      );
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.visual-uat/screenshots/current'),
        { recursive: true }
      );
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.visual-uat/diffs'),
        { recursive: true }
      );
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.visual-uat/results'),
        { recursive: true }
      );
    });
  });

  describe('loadResult', () => {
    it('should load result by timestamp', async () => {
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

      mockExistsSync.mockReturnValue(true);

      const expectedResult: RunResult = {
        timestamp: 1731870123,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [],
        summary: { total: 5, passed: 3, failed: 2, errored: 0, needsReview: 0 }
      };

      mockReadFileSync.mockReturnValue(JSON.stringify(expectedResult));

      const result = await store.loadResult(1731870123);

      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining(path.join('.visual-uat', 'results', 'run-1731870123.json'))
      );
      expect(mockReadFileSync).toHaveBeenCalledWith(
        expect.stringContaining(path.join('.visual-uat', 'results', 'run-1731870123.json')),
        'utf-8'
      );
      expect(result).toEqual(expectedResult);
    });

    it('should return null when loading non-existent result', async () => {
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

      mockExistsSync.mockReturnValue(false);

      const result = await store.loadResult(9999999999);

      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining(path.join('.visual-uat', 'results', 'run-9999999999.json'))
      );
      expect(result).toBeNull();
    });
  });

  describe('getScreenshotPath', () => {
    it('should return correct path for base branch', () => {
      const screenshotPath = store.getScreenshotPath('base', 'login-test', 'after-login');

      expect(screenshotPath).toContain('.visual-uat');
      expect(screenshotPath).toContain(path.join('screenshots', 'base'));
      expect(screenshotPath).toContain('login-test');
      expect(screenshotPath).toContain('after-login.png');
      expect(screenshotPath).toBe(
        path.join(projectRoot, '.visual-uat', 'screenshots', 'base', 'login-test', 'after-login.png')
      );
    });

    it('should return correct path for current branch', () => {
      const screenshotPath = store.getScreenshotPath('current', 'checkout-flow', 'payment');

      expect(screenshotPath).toContain('.visual-uat');
      expect(screenshotPath).toContain(path.join('screenshots', 'current'));
      expect(screenshotPath).toContain('checkout-flow');
      expect(screenshotPath).toContain('payment.png');
      expect(screenshotPath).toBe(
        path.join(projectRoot, '.visual-uat', 'screenshots', 'current', 'checkout-flow', 'payment.png')
      );
    });
  });

  describe('getDiffPath', () => {
    it('should return correct diff path', () => {
      const diffPath = store.getDiffPath('dashboard-test', 'initial');

      expect(diffPath).toContain('.visual-uat');
      expect(diffPath).toContain('diffs');
      expect(diffPath).toContain('dashboard-test');
      expect(diffPath).toContain('initial.png');
      expect(diffPath).toBe(
        path.join(projectRoot, '.visual-uat', 'diffs', 'dashboard-test', 'initial.png')
      );
    });
  });
});
