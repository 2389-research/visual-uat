// ABOUTME: Tests for TestRunner service that runs Playwright tests in worktrees.
// ABOUTME: Verifies async test execution, error handling, and screenshot directory configuration.

import { TestRunner } from './test-runner';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';

jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

function createMockProcess() {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

describe('TestRunner', () => {
  let runner: TestRunner;

  beforeEach(() => {
    runner = new TestRunner('/project/root', '/screenshots/base', 'http://localhost:34567');
    jest.clearAllMocks();
  });

  it('should run test and return result on success', async () => {
    const mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess);

    const resultPromise = runner.runTest('/project/root/tests/generated/login.spec.ts');

    mockProcess.emit('close', 0);

    const result = await resultPromise;
    expect(result.status).toBe('passed');
    expect(result.testPath).toBe('/project/root/tests/generated/login.spec.ts');
    expect(mockSpawn).toHaveBeenCalledWith(
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

  it('should return errored result on test failure', async () => {
    const mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess);

    const resultPromise = runner.runTest('/project/root/tests/generated/broken.spec.ts');

    mockProcess.stderr.emit('data', 'Test failed');
    mockProcess.emit('close', 1);

    const result = await resultPromise;
    expect(result.status).toBe('errored');
    expect(result.error).toBe('Exit code 1: Test failed');
  });

  it('should return errored result on spawn error', async () => {
    const mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess);

    const resultPromise = runner.runTest('/project/root/tests/generated/test.spec.ts');

    mockProcess.emit('error', new Error('Command not found'));

    const result = await resultPromise;
    expect(result.status).toBe('errored');
    expect(result.error).toContain('Command not found');
  });

  it('should parse duration from JSON output', async () => {
    const mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess);

    const resultPromise = runner.runTest('/project/root/tests/generated/login.spec.ts');

    const jsonOutput = JSON.stringify({
      suites: [{
        specs: [{
          tests: [{
            results: [{ duration: 1234 }]
          }]
        }]
      }]
    });
    mockProcess.stdout.emit('data', jsonOutput);
    mockProcess.emit('close', 0);

    const result = await resultPromise;
    expect(result.duration).toBe(1234);
  });
});
