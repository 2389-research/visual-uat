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
    runner = new TestRunner('/project/root', '/screenshots/base');
    jest.clearAllMocks();
  });

  it('should run test and return result on success', async () => {
    mockSpawnSync.mockReturnValueOnce({
      status: 0,
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
      error: undefined
    } as any);

    const result = await runner.runTest('tests/generated/login.spec.ts');

    expect(result.status).toBe('passed');
    expect(result.testPath).toBe('tests/generated/login.spec.ts');
    expect(mockSpawnSync).toHaveBeenCalledWith(
      'npx',
      ['playwright', 'test', 'tests/generated/login.spec.ts', '--reporter=json'],
      expect.objectContaining({
        cwd: '/project/root',
        env: expect.objectContaining({
          SCREENSHOT_DIR: '/screenshots/base'
        })
      })
    );
  });

  it('should return errored result on test failure', async () => {
    mockSpawnSync.mockReturnValueOnce({
      status: 1,
      stdout: Buffer.from(''),
      stderr: Buffer.from('Test failed'),
      error: undefined
    } as any);

    const result = await runner.runTest('tests/generated/broken.spec.ts');

    expect(result.status).toBe('errored');
    expect(result.error).toBe('Test failed');
  });

  it('should return errored result on spawn error', async () => {
    mockSpawnSync.mockReturnValueOnce({
      status: null,
      stdout: Buffer.from(''),
      stderr: Buffer.from(''),
      error: new Error('Command not found')
    } as any);

    const result = await runner.runTest('tests/generated/test.spec.ts');

    expect(result.status).toBe('errored');
    expect(result.error).toContain('Command not found');
  });
});
