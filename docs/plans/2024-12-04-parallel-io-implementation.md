# Parallel I/O Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Parallelize I/O-bound operations to achieve 5-6x speedup in test execution.

**Architecture:** Replace sequential loops with Promise.all/allSettled. Convert synchronous spawn to async spawn with promise wrapper. Keep phase ordering sequential but parallelize tasks within each phase.

**Tech Stack:** Node.js native `child_process.spawn`, `Promise.all`, `Promise.allSettled`

---

## Task 1: Make TestRunner.runTest() async

Convert the synchronous `spawnSync` to async `spawn` with a promise wrapper.

**Files:**
- Modify: `src/orchestrator/services/test-runner.ts:16-86`
- Modify: `src/orchestrator/services/test-runner.test.ts`

**Step 1: Write failing test for async runTest**

Add to `src/orchestrator/services/test-runner.test.ts`:

```typescript
import { spawn } from 'child_process';

jest.mock('child_process');
const mockSpawn = spawn as jest.MockedFunction<typeof spawn>;

// Add after the existing tests, around line 71:
describe('async runTest', () => {
  it('should return a promise that resolves on success', async () => {
    const mockProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn()
    };
    mockSpawn.mockReturnValue(mockProcess as any);

    const resultPromise = runner.runTest('/project/root/tests/generated/login.spec.ts');

    // Simulate process completing
    const closeCallback = mockProcess.on.mock.calls.find(c => c[0] === 'close')?.[1];
    closeCallback?.(0);

    const result = await resultPromise;
    expect(result.status).toBe('passed');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd "/Users/dylanr/Dropbox (Personal)/work/2389/visual-uat/.worktrees/parallel-io"
npm test -- src/orchestrator/services/test-runner.test.ts --testNamePattern="async runTest"
```

Expected: FAIL - runTest returns sync result, not promise

**Step 3: Update TestRunner to use async spawn**

Replace `src/orchestrator/services/test-runner.ts` content:

```typescript
// ABOUTME: Service for running Playwright tests in worktrees.
// ABOUTME: Executes tests asynchronously, parses output, and captures screenshot paths.

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RawTestResult } from '../handlers/execution-states';

export class TestRunner {
  constructor(
    private worktreePath: string,
    private screenshotDir: string,
    private baseUrl: string
  ) {}

  async runTest(testPath: string): Promise<RawTestResult> {
    // Convert absolute test path to relative path from worktree
    const relativeTestPath = path.relative(this.worktreePath, testPath);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(
        'npx',
        ['playwright', 'test', relativeTestPath, '--reporter=json'],
        {
          cwd: this.worktreePath,
          env: {
            ...process.env,
            SCREENSHOT_DIR: this.screenshotDir,
            BASE_URL: this.baseUrl
          }
        }
      );

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        resolve({
          testPath,
          status: 'errored',
          duration: 0,
          screenshots: [],
          error: error.message
        });
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          const errorMessage = stderr || stdout || 'Test execution failed';
          resolve({
            testPath,
            status: 'errored',
            duration: 0,
            screenshots: [],
            error: `Exit code ${code}: ${errorMessage}`
          });
          return;
        }

        // Discover screenshots
        const screenshots: string[] = [];
        try {
          if (fs.existsSync(this.screenshotDir)) {
            const files = fs.readdirSync(this.screenshotDir);
            screenshots.push(...files.filter(f => f.endsWith('.png')));
          }
        } catch (error) {
          console.warn(`Warning: Could not read screenshot directory: ${error}`);
        }

        // Parse JSON output for duration
        let duration = 0;
        try {
          const output = JSON.parse(stdout);
          if (output.suites && output.suites[0]?.specs?.[0]?.tests?.[0]?.results?.[0]) {
            duration = output.suites[0].specs[0].tests[0].results[0].duration;
          }
        } catch (error) {
          // If JSON parsing fails, duration stays 0
        }

        resolve({
          testPath,
          status: 'passed',
          duration,
          screenshots
        });
      });
    });
  }
}
```

**Step 4: Update test mocks for spawn instead of spawnSync**

Replace entire `src/orchestrator/services/test-runner.test.ts`:

```typescript
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

    // Simulate successful completion
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

    // Simulate stderr output then failure
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

    // Simulate spawn error
    mockProcess.emit('error', new Error('Command not found'));

    const result = await resultPromise;
    expect(result.status).toBe('errored');
    expect(result.error).toContain('Command not found');
  });

  it('should parse duration from JSON output', async () => {
    const mockProcess = createMockProcess();
    mockSpawn.mockReturnValue(mockProcess);

    const resultPromise = runner.runTest('/project/root/tests/generated/login.spec.ts');

    // Simulate JSON output with duration
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
```

**Step 5: Run tests to verify they pass**

```bash
cd "/Users/dylanr/Dropbox (Personal)/work/2389/visual-uat/.worktrees/parallel-io"
npm test -- src/orchestrator/services/test-runner.test.ts
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/orchestrator/services/test-runner.ts src/orchestrator/services/test-runner.test.ts
git commit -m "feat: convert TestRunner.runTest to async spawn

Replace spawnSync with async spawn + promise wrapper to enable
parallel test execution.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Parallelize handleExecuteBase

Convert the sequential for-loop to Promise.all.

**Files:**
- Modify: `src/orchestrator/handlers/run-command.ts:169-186`

**Step 1: Write failing test for parallel execution**

Add to `src/orchestrator/handlers/run-command.test.ts` in the EXECUTE_BASE describe block:

```typescript
it('should run tests in parallel', async () => {
  // Setup with multiple specs
  mockChangeDetector.mockReturnValue({
    determineScope: () => 'full',
    getSpecsToGenerate: () => ['/test/specs/test1.md', '/test/specs/test2.md', '/test/specs/test3.md']
  });

  const runOrder: string[] = [];
  mockTestRunner.mockImplementation((worktree, screenshotDir, baseUrl) => ({
    runTest: jest.fn().mockImplementation(async (testPath: string) => {
      runOrder.push(path.basename(testPath));
      // Simulate async delay
      await new Promise(r => setTimeout(r, 10));
      return { testPath, status: 'passed', duration: 100, screenshots: [] };
    })
  }));

  // ... rest of handler setup and execution
  // Verify all tests started before any completed (parallel behavior)
});
```

Note: This test may need adjustment based on existing test patterns in the file.

**Step 2: Update handleExecuteBase to use Promise.all**

In `src/orchestrator/handlers/run-command.ts`, replace lines 169-186:

```typescript
    // Run all tests in parallel
    const testPromises = specsToRun.map(async (specPath) => {
      const baseName = path.basename(specPath, '.md');
      const testPath = path.resolve(
        this.projectRoot,
        this.config.generatedDir,
        `${baseName}.spec.ts`
      );

      console.log(`Running base test: ${baseName}`);
      const result = await runner.runTest(testPath);

      context.baseResults.set(specPath, result);

      if (result.status === 'errored') {
        console.warn(`Base test errored: ${baseName} - ${result.error}`);
        console.warn('Will continue but flag as no baseline available');
      }

      return { specPath, result };
    });

    await Promise.all(testPromises);
```

**Step 3: Run all tests**

```bash
cd "/Users/dylanr/Dropbox (Personal)/work/2389/visual-uat/.worktrees/parallel-io"
npm test
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/orchestrator/handlers/run-command.ts
git commit -m "feat: parallelize base test execution with Promise.all

Run all base tests concurrently instead of sequentially for faster
execution.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Parallelize handleExecuteCurrent

Same pattern as Task 2, for the current branch tests.

**Files:**
- Modify: `src/orchestrator/handlers/run-command.ts:207-223`

**Step 1: Update handleExecuteCurrent to use Promise.all**

In `src/orchestrator/handlers/run-command.ts`, replace lines 207-223:

```typescript
    // Run all tests in parallel
    const testPromises = specsToRun.map(async (specPath) => {
      const baseName = path.basename(specPath, '.md');
      const testPath = path.resolve(
        context.worktrees!.current,
        this.config.generatedDir,
        `${baseName}.spec.ts`
      );

      console.log(`Running current test: ${baseName}`);
      const result = await runner.runTest(testPath);

      context.currentResults.set(specPath, result);

      if (result.status === 'errored') {
        console.warn(`Current test errored: ${baseName} - ${result.error}`);
      }

      return { specPath, result };
    });

    await Promise.all(testPromises);
```

**Step 2: Run all tests**

```bash
cd "/Users/dylanr/Dropbox (Personal)/work/2389/visual-uat/.worktrees/parallel-io"
npm test
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/orchestrator/handlers/run-command.ts
git commit -m "feat: parallelize current test execution with Promise.all

Run all current branch tests concurrently for faster execution.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Parallelize handleCompareAndEvaluate with Promise.allSettled

Convert checkpoint comparison loop to Promise.allSettled for partial results.

**Files:**
- Modify: `src/orchestrator/handlers/run-command.ts:284-365`

**Step 1: Update handleCompareAndEvaluate to use Promise.allSettled**

In `src/orchestrator/handlers/run-command.ts`, replace the for loop at lines 284-365 with:

```typescript
      // Compare all checkpoints in parallel with partial results
      const checkpointPromises = baseResult.screenshots.map(async (checkpointName, i) => {
        const baseImagePath = path.join(
          this.projectRoot,
          '.visual-uat/screenshots/base',
          checkpointName
        );
        const currentImagePath = path.join(
          this.projectRoot,
          '.visual-uat/screenshots/current',
          checkpointName
        );

        // Load images as Screenshot objects
        const baseImageData = fs.readFileSync(baseImagePath);
        const currentImageData = fs.readFileSync(currentImagePath);

        const baseScreenshot: import('../../types/plugins').Screenshot = {
          data: baseImageData,
          width: 0,
          height: 0,
          checkpoint: path.basename(checkpointName, '.png')
        };

        const currentScreenshot: import('../../types/plugins').Screenshot = {
          data: currentImageData,
          width: 0,
          height: 0,
          checkpoint: path.basename(checkpointName, '.png')
        };

        const diffResult = await this.plugins.differ.compare(
          baseScreenshot,
          currentScreenshot
        );

        let evaluation;

        // Only evaluate if there are differences
        if (diffResult.pixelDiffPercent > 0) {
          evaluation = await this.plugins.evaluator.evaluate({
            intent: specContent,
            checkpoint: path.basename(checkpointName, '.png'),
            diffResult: diffResult,
            baselineImage: baseImageData,
            currentImage: currentImageData,
            codeChanges: context.codeChangeSummary || undefined
          });
        } else {
          // No differences, auto-pass
          evaluation = {
            pass: true,
            confidence: 1.0,
            reason: 'No visual differences detected',
            needsReview: false
          };
        }

        // Save diff image to disk
        const diffImagePath = path.join(
          this.projectRoot,
          '.visual-uat/diffs',
          checkpointName
        );
        const diffDir = path.dirname(diffImagePath);
        if (!fs.existsSync(diffDir)) {
          fs.mkdirSync(diffDir, { recursive: true });
        }
        fs.writeFileSync(diffImagePath, diffResult.diffImage);

        return {
          name: path.basename(checkpointName, '.png'),
          baselineImage: baseImagePath,
          currentImage: currentImagePath,
          diffImage: diffImagePath,
          diffMetrics: {
            pixelDiffPercent: diffResult.pixelDiffPercent,
            changedRegions: diffResult.changedRegions
          },
          evaluation: evaluation
        };
      });

      const settled = await Promise.allSettled(checkpointPromises);

      // Extract results, log failures
      const checkpoints: import('../types/results').CheckpointResult[] = [];
      for (const [i, outcome] of settled.entries()) {
        if (outcome.status === 'fulfilled') {
          checkpoints.push(outcome.value);
        } else {
          console.warn(`Checkpoint ${baseResult.screenshots[i]} failed: ${outcome.reason}`);
        }
      }
```

**Step 2: Run all tests**

```bash
cd "/Users/dylanr/Dropbox (Personal)/work/2389/visual-uat/.worktrees/parallel-io"
npm test
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/orchestrator/handlers/run-command.ts
git commit -m "feat: parallelize checkpoint comparison with Promise.allSettled

Compare and evaluate all checkpoints concurrently. Uses allSettled
so partial results are available even if some checkpoints fail.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Parallelize report generation

Run terminal and HTML reporters concurrently.

**Files:**
- Modify: `src/orchestrator/handlers/run-command.ts:459-475`

**Step 1: Update handleStoreResults to parallelize reporters**

In `src/orchestrator/handlers/run-command.ts`, replace lines 457-475 with:

```typescript
      // Run reporters in parallel
      const reporterPromises: Promise<void>[] = [];

      // Terminal reporter (unless disabled)
      const terminalEnabled = this.config.reporters?.terminal?.enabled !== false;
      if (terminalEnabled) {
        reporterPromises.push(
          this.plugins.terminalReporter.generate(context.runResult!, reporterOptions)
            .catch((error) => {
              console.error('Terminal reporter failed:', error);
            })
        );
      }

      // HTML reporter (unless --no-html or disabled)
      const htmlEnabled = this.config.reporters?.html?.enabled !== false;
      if (!this.runOptions?.noHtml && htmlEnabled) {
        reporterPromises.push(
          this.plugins.htmlReporter.generate(context.runResult!, reporterOptions)
            .catch((error) => {
              console.error('HTML reporter failed:', error);
            })
        );
      }

      await Promise.all(reporterPromises);
```

**Step 2: Run all tests**

```bash
cd "/Users/dylanr/Dropbox (Personal)/work/2389/visual-uat/.worktrees/parallel-io"
npm test
```

Expected: PASS

**Step 3: Commit**

```bash
git add src/orchestrator/handlers/run-command.ts
git commit -m "feat: parallelize report generation with Promise.all

Run terminal and HTML reporters concurrently for faster completion.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Final integration test and cleanup

Run full test suite and verify build.

**Files:**
- All modified files

**Step 1: Run full test suite**

```bash
cd "/Users/dylanr/Dropbox (Personal)/work/2389/visual-uat/.worktrees/parallel-io"
npm test
```

Expected: All tests pass

**Step 2: Run TypeScript build**

```bash
cd "/Users/dylanr/Dropbox (Personal)/work/2389/visual-uat/.worktrees/parallel-io"
npm run build
```

Expected: Build succeeds with no errors

**Step 3: Update ROADMAP.md**

Mark "Make it faster" as complete in `docs/ROADMAP.md`.

**Step 4: Final commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark parallel I/O as completed in roadmap

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Convert TestRunner to async | test-runner.ts, test-runner.test.ts |
| 2 | Parallelize handleExecuteBase | run-command.ts |
| 3 | Parallelize handleExecuteCurrent | run-command.ts |
| 4 | Parallelize handleCompareAndEvaluate | run-command.ts |
| 5 | Parallelize report generation | run-command.ts |
| 6 | Integration test and cleanup | ROADMAP.md |

Total: 6 tasks, ~30-45 minutes estimated
