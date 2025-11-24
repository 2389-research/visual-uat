// ABOUTME: Tests for TestRunner service that runs Playwright tests in worktrees.
// ABOUTME: Verifies test execution, error handling, and screenshot directory configuration.

import { TestRunner } from './test-runner';
import { RawTestResult } from '../handlers/execution-states';
import { spawnSync } from 'child_process';

jest.mock('child_process');
const mockSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

describe('TestRunner', () => {
  let runner: TestRunner;

  beforeEach(() => {
    runner = new TestRunner('/project/root', '/screenshots/base', 'http://localhost:34567');
    jest.clearAllMocks();
  });

  it('should run test and return result on success', () => {
    mockSpawnSync.mockReturnValueOnce({
      status: 0,
      stdout: '',
      stderr: '',
      error: undefined
    } as any);

    const result = runner.runTest('/project/root/tests/generated/login.spec.ts');

    expect(result.status).toBe('passed');
    expect(result.testPath).toBe('/project/root/tests/generated/login.spec.ts');
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'npx',
      ['playwright', 'test', 'tests/generated/login.spec.ts', '--reporter=json'],
      expect.objectContaining({
        cwd: '/project/root',
        env: expect.objectContaining({
          SCREENSHOT_DIR: '/screenshots/base',
          BASE_URL: 'http://localhost:34567'
        })
      })
    );
  });

  it('should return errored result on test failure', () => {
    mockSpawnSync.mockReturnValueOnce({
      status: 1,
      stdout: '',
      stderr: 'Test failed',
      error: undefined
    } as any);

    const result = runner.runTest('/project/root/tests/generated/broken.spec.ts');

    expect(result.status).toBe('errored');
    expect(result.error).toBe('Exit code 1: Test failed');
  });

  it('should return errored result on spawn error', () => {
    mockSpawnSync.mockReturnValueOnce({
      status: null,
      stdout: '',
      stderr: '',
      error: new Error('Command not found')
    } as any);

    const result = runner.runTest('/project/root/tests/generated/test.spec.ts');

    expect(result.status).toBe('errored');
    expect(result.error).toContain('Command not found');
  });
});
