# Execution Phase Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the execution phase state machine that runs tests in worktrees, captures screenshots, compares differences, and evaluates with LLM.

**Architecture:** State machine with 8 explicit states (SETUP, EXECUTE_BASE, EXECUTE_CURRENT, COMPARE_AND_EVALUATE, STORE_RESULTS, CLEANUP, COMPLETE, FAILED). Each state is a handler method that returns the next state.

**Tech Stack:** TypeScript, Node.js, Jest, Playwright, child_process (spawnSync), existing plugin interfaces

**Related Design:** docs/plans/2025-11-17-execution-phase-design.md

---

## Task 1: Execution State Types

**Files:**
- Create: `src/orchestrator/handlers/execution-states.ts`
- Test: `src/orchestrator/handlers/execution-states.test.ts`

**Step 1: Write the failing test**

```typescript
// src/orchestrator/handlers/execution-states.test.ts
import { ExecutionState, ExecutionContext, RawTestResult } from './execution-states';

describe('Execution State Types', () => {
  it('should create valid ExecutionContext', () => {
    const context: ExecutionContext = {
      scope: {
        type: 'full',
        baseBranch: 'main',
        specsToGenerate: ['tests/login.md']
      },
      worktrees: null,
      baseResults: new Map<string, RawTestResult>(),
      currentResults: new Map<string, RawTestResult>(),
      runResult: null,
      keepWorktrees: false
    };

    expect(context.scope.type).toBe('full');
    expect(context.baseResults.size).toBe(0);
    expect(context.keepWorktrees).toBe(false);
  });

  it('should allow all valid ExecutionState values', () => {
    const states: ExecutionState[] = [
      'SETUP',
      'EXECUTE_BASE',
      'EXECUTE_CURRENT',
      'COMPARE_AND_EVALUATE',
      'STORE_RESULTS',
      'CLEANUP',
      'COMPLETE',
      'FAILED'
    ];

    states.forEach(state => {
      const s: ExecutionState = state;
      expect(s).toBe(state);
    });
  });

  it('should create valid RawTestResult', () => {
    const result: RawTestResult = {
      testPath: 'tests/generated/login.spec.ts',
      status: 'passed',
      duration: 1500,
      screenshots: ['initial.png', 'after-login.png']
    };

    expect(result.status).toBe('passed');
    expect(result.screenshots.length).toBe(2);
  });

  it('should include error for errored RawTestResult', () => {
    const result: RawTestResult = {
      testPath: 'tests/generated/broken.spec.ts',
      status: 'errored',
      duration: 30000,
      screenshots: [],
      error: 'Server timeout'
    };

    expect(result.status).toBe('errored');
    expect(result.error).toBe('Server timeout');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/dylanr/work/2389/visual-uat/.worktrees/execution-phase
npm test -- execution-states.test.ts
```

Expected: FAIL with "Cannot find module './execution-states'"

**Step 3: Write minimal implementation**

```typescript
// src/orchestrator/handlers/execution-states.ts
// ABOUTME: Type definitions for execution phase state machine.
// ABOUTME: Defines states, context, and raw test results from Playwright.

import { WorktreePaths } from '../services/worktree-manager';
import { ExecutionScope } from '../services/change-detector';
import { RunResult } from '../types/results';

export type ExecutionState =
  | 'SETUP'
  | 'EXECUTE_BASE'
  | 'EXECUTE_CURRENT'
  | 'COMPARE_AND_EVALUATE'
  | 'STORE_RESULTS'
  | 'CLEANUP'
  | 'COMPLETE'
  | 'FAILED';

export interface RawTestResult {
  testPath: string;
  status: 'passed' | 'failed' | 'errored';
  duration: number;
  screenshots: string[];
  error?: string;
}

export interface ExecutionContext {
  scope: ExecutionScope | null;
  worktrees: WorktreePaths | null;
  baseResults: Map<string, RawTestResult>;
  currentResults: Map<string, RawTestResult>;
  runResult: RunResult | null;
  keepWorktrees: boolean;
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- execution-states.test.ts
```

Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/orchestrator/handlers/execution-states.ts src/orchestrator/handlers/execution-states.test.ts
git commit -m "feat(orchestrator): add execution state types"
```

---

## Task 2: Playwright Helper Function

**Files:**
- Create: `src/playwright/helpers.ts`
- Test: `src/playwright/helpers.test.ts`

**Step 1: Write the failing test**

```typescript
// src/playwright/helpers.test.ts
import { screenshotCheckpoint } from './helpers';
import * as path from 'path';
import * as fs from 'fs';

// Mock Playwright types
interface MockPage {
  screenshot: jest.Mock;
}

describe('screenshotCheckpoint', () => {
  let mockPage: MockPage;
  const originalEnv = process.env.SCREENSHOT_DIR;

  beforeEach(() => {
    mockPage = {
      screenshot: jest.fn()
    };
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.SCREENSHOT_DIR = originalEnv;
    } else {
      delete process.env.SCREENSHOT_DIR;
    }
  });

  it('should call page.screenshot with correct path', async () => {
    process.env.SCREENSHOT_DIR = '/tmp/screenshots';

    await screenshotCheckpoint(mockPage as any, 'initial');

    expect(mockPage.screenshot).toHaveBeenCalledWith({
      path: '/tmp/screenshots/initial.png',
      fullPage: true
    });
  });

  it('should throw if SCREENSHOT_DIR not set', async () => {
    delete process.env.SCREENSHOT_DIR;

    await expect(
      screenshotCheckpoint(mockPage as any, 'test')
    ).rejects.toThrow('SCREENSHOT_DIR environment variable not set');
  });

  it('should handle checkpoint names with spaces', async () => {
    process.env.SCREENSHOT_DIR = '/tmp/screenshots';

    await screenshotCheckpoint(mockPage as any, 'after login');

    expect(mockPage.screenshot).toHaveBeenCalledWith({
      path: '/tmp/screenshots/after login.png',
      fullPage: true
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- helpers.test.ts
```

Expected: FAIL with "Cannot find module './helpers'"

**Step 3: Write minimal implementation**

```typescript
// src/playwright/helpers.ts
// ABOUTME: Helper functions for generated Playwright tests.
// ABOUTME: Provides screenshotCheckpoint() for capturing screenshots at specific test points.

import * as path from 'path';

/**
 * Capture a screenshot at a named checkpoint during test execution.
 * The SCREENSHOT_DIR environment variable must be set by the orchestrator.
 *
 * @param page - Playwright Page object
 * @param name - Checkpoint name (becomes filename)
 */
export async function screenshotCheckpoint(
  page: { screenshot: (options: any) => Promise<void> },
  name: string
): Promise<void> {
  const screenshotDir = process.env.SCREENSHOT_DIR;
  if (!screenshotDir) {
    throw new Error('SCREENSHOT_DIR environment variable not set');
  }

  const screenshotPath = path.join(screenshotDir, `${name}.png`);

  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- helpers.test.ts
```

Expected: PASS (3 tests)

**Step 5: Update package.json exports**

Add to package.json:

```json
"exports": {
  ".": "./dist/index.js",
  "./playwright": "./dist/playwright/helpers.js"
}
```

**Step 6: Commit**

```bash
git add src/playwright/helpers.ts src/playwright/helpers.test.ts package.json
git commit -m "feat(playwright): add screenshotCheckpoint helper"
```

---

## Task 3: Test Runner Service

**Files:**
- Create: `src/orchestrator/services/test-runner.ts`
- Test: `src/orchestrator/services/test-runner.test.ts`

**Step 1: Write the failing test**

```typescript
// src/orchestrator/services/test-runner.test.ts
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
```

**Step 2: Run test to verify it fails**

```bash
npm test -- test-runner.test.ts
```

Expected: FAIL with "Cannot find module './test-runner'"

**Step 3: Write minimal implementation**

```typescript
// src/orchestrator/services/test-runner.ts
// ABOUTME: Service for running Playwright tests in worktrees.
// ABOUTME: Executes tests, parses output, and captures screenshot paths.

import { spawnSync } from 'child_process';
import { RawTestResult } from '../handlers/execution-states';

export class TestRunner {
  constructor(
    private worktreePath: string,
    private screenshotDir: string
  ) {}

  async runTest(testPath: string): Promise<RawTestResult> {
    const result = spawnSync(
      'npx',
      ['playwright', 'test', testPath, '--reporter=json'],
      {
        cwd: this.worktreePath,
        env: {
          ...process.env,
          SCREENSHOT_DIR: this.screenshotDir
        },
        encoding: 'utf-8'
      }
    );

    if (result.error) {
      return {
        testPath,
        status: 'errored',
        duration: 0,
        screenshots: [],
        error: result.error.message
      };
    }

    if (result.status !== 0) {
      return {
        testPath,
        status: 'errored',
        duration: 0,
        screenshots: [],
        error: result.stderr || 'Test execution failed'
      };
    }

    // TODO: Parse JSON output to get screenshots and duration
    return {
      testPath,
      status: 'passed',
      duration: 0,
      screenshots: []
    };
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- test-runner.test.ts
```

Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/orchestrator/services/test-runner.ts src/orchestrator/services/test-runner.test.ts
git commit -m "feat(orchestrator): add test runner service"
```

---

## Task 4: Update RunOptions and CLI

**Files:**
- Modify: `src/orchestrator/services/change-detector.ts`
- Modify: `src/cli.ts`
- Test: `src/cli.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to src/cli.test.ts
describe('CLI run command with keepWorktrees', () => {
  it('should pass keepWorktrees flag to handler', async () => {
    // Mock setup
    const mockExecute = jest.fn().mockResolvedValue(0);

    // Parse args with --keep-worktrees
    await cli.parseAsync(['node', 'visual-uat', 'run', '--keep-worktrees']);

    // Verify execute called with keepWorktrees: true
    expect(mockExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        keepWorktrees: true
      })
    );
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- cli.test.ts -t "keepWorktrees"
```

Expected: FAIL

**Step 3: Update RunOptions type**

```typescript
// In src/orchestrator/services/change-detector.ts
export interface RunOptions {
  baseBranch?: string;
  force?: boolean;
  keepWorktrees?: boolean; // ADD THIS
}
```

**Step 4: Update CLI**

```typescript
// In src/cli.ts, modify the run command:
program
  .command('run')
  .description('Run visual acceptance tests')
  .option('--base-branch <branch>', 'Base branch for comparison', 'main')
  .option('--force', 'Force full run even if no changes detected')
  .option('--keep-worktrees', 'Keep worktrees after execution for debugging') // ADD THIS
  .action(async (options) => {
    const config = loadConfig(process.cwd());
    const registry = new PluginRegistry(config);
    const plugins = await registry.loadAll();
    const handler = new RunCommandHandler(config, plugins, process.cwd());

    const exitCode = await handler.execute({
      baseBranch: options.baseBranch,
      force: options.force,
      keepWorktrees: options.keepWorktrees // ADD THIS
    });

    process.exit(exitCode);
  });
```

**Step 5: Run test to verify it passes**

```bash
npm test -- cli.test.ts -t "keepWorktrees"
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/orchestrator/services/change-detector.ts src/cli.ts src/cli.test.ts
git commit -m "feat(cli): add --keep-worktrees flag to run command"
```

---

## Task 5: SETUP State Handler

**Files:**
- Modify: `src/orchestrator/handlers/run-command.ts`
- Test: `src/orchestrator/handlers/run-command.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to src/orchestrator/handlers/run-command.test.ts
import { WorktreeManager } from '../services/worktree-manager';

jest.mock('../services/worktree-manager');

describe('RunCommandHandler.handleSetup', () => {
  it('should transition to EXECUTE_BASE on success', async () => {
    const mockCreateWorktrees = jest.fn().mockResolvedValue({
      basePath: '/worktrees/base',
      currentPath: '/worktrees/current'
    });
    (WorktreeManager as jest.Mock).mockImplementation(() => ({
      createWorktrees: mockCreateWorktrees
    }));

    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');
    const context: ExecutionContext = {
      scope: null,
      worktrees: null,
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await handler['handleSetup'](context, { force: true });

    expect(nextState).toBe('EXECUTE_BASE');
    expect(context.worktrees).not.toBeNull();
    expect(mockCreateWorktrees).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- run-command.test.ts -t "handleSetup"
```

Expected: FAIL with "handleSetup is not a function"

**Step 3: Implement handleSetup**

```typescript
// In src/orchestrator/handlers/run-command.ts
import { ExecutionState, ExecutionContext } from './execution-states';
import { WorktreeManager } from '../services/worktree-manager';
import { execSync } from 'child_process';

// Add to RunCommandHandler class:

private async handleSetup(
  context: ExecutionContext,
  options: RunOptions
): Promise<ExecutionState> {
  try {
    // Determine scope
    context.scope = await this.determineScope(options);

    if (context.scope.type === 'skip') {
      console.log('No changes detected, skipping tests');
      return 'COMPLETE';
    }

    // Generate tests
    await this.generateTests(context.scope);

    // Get current branch
    const currentBranch = execSync('git branch --show-current', {
      cwd: this.projectRoot,
      encoding: 'utf-8'
    }).trim();

    // Create worktrees
    const worktreeManager = new WorktreeManager(this.projectRoot);
    context.worktrees = await worktreeManager.createWorktrees(
      context.scope.baseBranch,
      currentBranch
    );

    return 'EXECUTE_BASE';
  } catch (error) {
    console.error('Setup failed:', error);
    return 'FAILED';
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- run-command.test.ts -t "handleSetup"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/orchestrator/handlers/run-command.ts src/orchestrator/handlers/run-command.test.ts
git commit -m "feat(orchestrator): implement SETUP state handler"
```

---

## Task 6: EXECUTE_BASE State Handler

**Files:**
- Modify: `src/orchestrator/handlers/run-command.ts`
- Test: `src/orchestrator/handlers/run-command.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to run-command.test.ts
describe('RunCommandHandler.handleExecuteBase', () => {
  it('should run tests in base worktree and transition to EXECUTE_CURRENT', async () => {
    const mockRunTest = jest.fn().mockResolvedValue({
      testPath: 'tests/generated/login.spec.ts',
      status: 'passed',
      duration: 1500,
      screenshots: ['initial.png']
    });

    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');
    handler['testRunner'] = { runTest: mockRunTest } as any;

    const context: ExecutionContext = {
      scope: {
        type: 'full',
        baseBranch: 'main',
        specsToGenerate: ['tests/login.md']
      },
      worktrees: {
        basePath: '/worktrees/base',
        currentPath: '/worktrees/current'
      },
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await handler['handleExecuteBase'](context);

    expect(nextState).toBe('EXECUTE_CURRENT');
    expect(context.baseResults.size).toBe(1);
  });

  it('should continue on base test error and set baselineAvailable flag', async () => {
    const mockRunTest = jest.fn().mockResolvedValue({
      testPath: 'tests/generated/broken.spec.ts',
      status: 'errored',
      duration: 0,
      screenshots: [],
      error: 'Test crashed'
    });

    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');
    handler['testRunner'] = { runTest: mockRunTest } as any;

    const context: ExecutionContext = {
      scope: {
        type: 'full',
        baseBranch: 'main',
        specsToGenerate: ['tests/broken.md']
      },
      worktrees: {
        basePath: '/worktrees/base',
        currentPath: '/worktrees/current'
      },
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await handler['handleExecuteBase'](context);

    expect(nextState).toBe('EXECUTE_CURRENT');
    expect(context.baseResults.get('tests/broken.md')?.status).toBe('errored');
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- run-command.test.ts -t "handleExecuteBase"
```

Expected: FAIL

**Step 3: Implement handleExecuteBase**

```typescript
// Add to RunCommandHandler class
import { TestRunner } from '../services/test-runner';
import * as path from 'path';

private async handleExecuteBase(
  context: ExecutionContext
): Promise<ExecutionState> {
  try {
    const screenshotDir = path.join(
      this.projectRoot,
      '.visual-uat/screenshots/base'
    );
    const runner = new TestRunner(context.worktrees!.basePath, screenshotDir);

    // Get list of generated tests
    const specsToRun = context.scope!.specsToGenerate;

    for (const specPath of specsToRun) {
      const baseName = path.basename(specPath, '.md');
      const testPath = path.join(
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
    }

    return 'EXECUTE_CURRENT';
  } catch (error) {
    console.error('Base execution failed:', error);
    return 'FAILED';
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- run-command.test.ts -t "handleExecuteBase"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/orchestrator/handlers/run-command.ts src/orchestrator/handlers/run-command.test.ts
git commit -m "feat(orchestrator): implement EXECUTE_BASE state handler"
```

---

## Task 7: EXECUTE_CURRENT State Handler

**Files:**
- Modify: `src/orchestrator/handlers/run-command.ts`
- Test: `src/orchestrator/handlers/run-command.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to run-command.test.ts
describe('RunCommandHandler.handleExecuteCurrent', () => {
  it('should run tests in current worktree and transition to COMPARE_AND_EVALUATE', async () => {
    const mockRunTest = jest.fn().mockResolvedValue({
      testPath: 'tests/generated/login.spec.ts',
      status: 'passed',
      duration: 1500,
      screenshots: ['initial.png', 'after-login.png']
    });

    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');
    handler['testRunner'] = { runTest: mockRunTest } as any;

    const context: ExecutionContext = {
      scope: {
        type: 'full',
        baseBranch: 'main',
        specsToGenerate: ['tests/login.md']
      },
      worktrees: {
        basePath: '/worktrees/base',
        currentPath: '/worktrees/current'
      },
      baseResults: new Map([
        ['tests/login.md', {
          testPath: 'tests/generated/login.spec.ts',
          status: 'passed',
          duration: 1400,
          screenshots: ['initial.png', 'after-login.png']
        }]
      ]),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await handler['handleExecuteCurrent'](context);

    expect(nextState).toBe('COMPARE_AND_EVALUATE');
    expect(context.currentResults.size).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- run-command.test.ts -t "handleExecuteCurrent"
```

Expected: FAIL

**Step 3: Implement handleExecuteCurrent**

```typescript
// Add to RunCommandHandler class

private async handleExecuteCurrent(
  context: ExecutionContext
): Promise<ExecutionState> {
  try {
    const screenshotDir = path.join(
      this.projectRoot,
      '.visual-uat/screenshots/current'
    );
    const runner = new TestRunner(context.worktrees!.currentPath, screenshotDir);

    const specsToRun = context.scope!.specsToGenerate;

    for (const specPath of specsToRun) {
      const baseName = path.basename(specPath, '.md');
      const testPath = path.join(
        this.config.generatedDir,
        `${baseName}.spec.ts`
      );

      console.log(`Running current test: ${baseName}`);
      const result = await runner.runTest(testPath);

      context.currentResults.set(specPath, result);

      if (result.status === 'errored') {
        console.warn(`Current test errored: ${baseName} - ${result.error}`);
      }
    }

    return 'COMPARE_AND_EVALUATE';
  } catch (error) {
    console.error('Current execution failed:', error);
    return 'FAILED';
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- run-command.test.ts -t "handleExecuteCurrent"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/orchestrator/handlers/run-command.ts src/orchestrator/handlers/run-command.test.ts
git commit -m "feat(orchestrator): implement EXECUTE_CURRENT state handler"
```

---

## Task 8: COMPARE_AND_EVALUATE State Handler

**Files:**
- Modify: `src/orchestrator/handlers/run-command.ts`
- Test: `src/orchestrator/handlers/run-command.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to run-command.test.ts
describe('RunCommandHandler.handleCompareAndEvaluate', () => {
  it('should skip evaluation if no pixel differences', async () => {
    const mockCompare = jest.fn().mockResolvedValue({
      pixelDiffPercent: 0,
      changedRegions: []
    });

    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');
    handler['plugins'] = {
      ...mockPlugins,
      differ: { compare: mockCompare, generateDiff: jest.fn() }
    } as any;

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: ['tests/login.md'] },
      worktrees: { basePath: '/base', currentPath: '/current' },
      baseResults: new Map([
        ['tests/login.md', {
          testPath: 'tests/generated/login.spec.ts',
          status: 'passed',
          duration: 1400,
          screenshots: ['initial.png']
        }]
      ]),
      currentResults: new Map([
        ['tests/login.md', {
          testPath: 'tests/generated/login.spec.ts',
          status: 'passed',
          duration: 1500,
          screenshots: ['initial.png']
        }]
      ]),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await handler['handleCompareAndEvaluate'](context);

    expect(nextState).toBe('STORE_RESULTS');
    expect(mockCompare).toHaveBeenCalled();
    // Evaluator should NOT be called for 0% diff
    expect(handler['plugins'].evaluator.evaluate).not.toHaveBeenCalled();
  });

  it('should evaluate differences when pixels changed', async () => {
    const mockCompare = jest.fn().mockResolvedValue({
      pixelDiffPercent: 2.5,
      changedRegions: [{ x: 10, y: 20, width: 100, height: 50 }]
    });
    const mockEvaluate = jest.fn().mockResolvedValue({
      pass: true,
      confidence: 0.95,
      reason: 'Expected button color change',
      needsReview: false
    });

    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');
    handler['plugins'] = {
      ...mockPlugins,
      differ: { compare: mockCompare, generateDiff: jest.fn() },
      evaluator: { evaluate: mockEvaluate }
    } as any;

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: ['tests/login.md'] },
      worktrees: { basePath: '/base', currentPath: '/current' },
      baseResults: new Map([
        ['tests/login.md', {
          testPath: 'tests/generated/login.spec.ts',
          status: 'passed',
          duration: 1400,
          screenshots: ['initial.png']
        }]
      ]),
      currentResults: new Map([
        ['tests/login.md', {
          testPath: 'tests/generated/login.spec.ts',
          status: 'passed',
          duration: 1500,
          screenshots: ['initial.png']
        }]
      ]),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await handler['handleCompareAndEvaluate'](context);

    expect(nextState).toBe('STORE_RESULTS');
    expect(mockEvaluate).toHaveBeenCalled();
  });

  it('should handle missing baseline gracefully', async () => {
    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: ['tests/broken.md'] },
      worktrees: { basePath: '/base', currentPath: '/current' },
      baseResults: new Map([
        ['tests/broken.md', {
          testPath: 'tests/generated/broken.spec.ts',
          status: 'errored',
          duration: 0,
          screenshots: [],
          error: 'Test crashed'
        }]
      ]),
      currentResults: new Map([
        ['tests/broken.md', {
          testPath: 'tests/generated/broken.spec.ts',
          status: 'passed',
          duration: 1500,
          screenshots: ['initial.png']
        }]
      ]),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await handler['handleCompareAndEvaluate'](context);

    expect(nextState).toBe('STORE_RESULTS');
    // Should create TestResult with baselineAvailable: false
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- run-command.test.ts -t "handleCompareAndEvaluate"
```

Expected: FAIL

**Step 3: Update TestResult type**

```typescript
// Add to src/orchestrator/types/results.ts
export interface TestResult {
  specPath: string;
  generatedPath: string;
  status: 'passed' | 'failed' | 'errored' | 'needs_review';
  checkpoints: CheckpointResult[];
  duration: number;
  error?: string;
  baselineAvailable?: boolean; // ADD THIS - false if base test errored
}
```

**Step 4: Implement handleCompareAndEvaluate**

```typescript
// Add to RunCommandHandler class
import { TestResult, CheckpointResult, RunResult } from '../types/results';
import * as fs from 'fs';

private async handleCompareAndEvaluate(
  context: ExecutionContext
): Promise<ExecutionState> {
  try {
    const tests: TestResult[] = [];

    for (const specPath of context.scope!.specsToGenerate) {
      const baseResult = context.baseResults.get(specPath);
      const currentResult = context.currentResults.get(specPath);

      if (!baseResult || !currentResult) {
        continue;
      }

      const baseName = path.basename(specPath, '.md');
      const generatedPath = path.join(
        this.config.generatedDir,
        `${baseName}.spec.ts`
      );

      // If base errored, mark as no baseline
      if (baseResult.status === 'errored') {
        tests.push({
          specPath,
          generatedPath,
          status: 'errored',
          checkpoints: [],
          duration: currentResult.duration,
          error: `No baseline available: ${baseResult.error}`,
          baselineAvailable: false
        });
        continue;
      }

      // If current errored, mark as errored
      if (currentResult.status === 'errored') {
        tests.push({
          specPath,
          generatedPath,
          status: 'errored',
          checkpoints: [],
          duration: currentResult.duration,
          error: currentResult.error,
          baselineAvailable: true
        });
        continue;
      }

      // Compare screenshots for each checkpoint
      const checkpoints: CheckpointResult[] = [];
      const specContent = fs.readFileSync(specPath, 'utf-8');

      for (let i = 0; i < baseResult.screenshots.length; i++) {
        const checkpointName = baseResult.screenshots[i];
        const baseImage = path.join(
          this.projectRoot,
          '.visual-uat/screenshots/base',
          baseName,
          checkpointName
        );
        const currentImage = path.join(
          this.projectRoot,
          '.visual-uat/screenshots/current',
          baseName,
          checkpointName
        );

        const diffMetrics = await this.plugins.differ.compare(
          baseImage,
          currentImage
        );

        let evaluation = null;
        let diffImage = null;

        // Only evaluate if there are differences
        if (diffMetrics.pixelDiffPercent > 0) {
          diffImage = path.join(
            this.projectRoot,
            '.visual-uat/diffs',
            baseName,
            checkpointName
          );

          await this.plugins.differ.generateDiff(
            baseImage,
            currentImage,
            diffImage
          );

          evaluation = await this.plugins.evaluator.evaluate({
            spec: { path: specPath, content: specContent, intent: specContent },
            baselineImage: baseImage,
            currentImage: currentImage,
            diffImage: diffImage,
            diffMetrics: diffMetrics
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

        checkpoints.push({
          name: path.basename(checkpointName, '.png'),
          baselineImage: baseImage,
          currentImage: currentImage,
          diffImage: diffImage,
          diffMetrics: diffMetrics,
          evaluation: evaluation
        });
      }

      // Determine overall test status
      let status: TestResult['status'] = 'passed';
      if (checkpoints.some(c => c.evaluation?.needsReview)) {
        status = 'needs_review';
      } else if (checkpoints.some(c => !c.evaluation?.pass)) {
        status = 'failed';
      }

      tests.push({
        specPath,
        generatedPath,
        status,
        checkpoints,
        duration: currentResult.duration,
        baselineAvailable: true
      });
    }

    // Build RunResult
    const currentBranch = execSync('git branch --show-current', {
      cwd: this.projectRoot,
      encoding: 'utf-8'
    }).trim();

    context.runResult = {
      timestamp: Date.now(),
      baseBranch: context.scope!.baseBranch,
      currentBranch: currentBranch,
      config: this.config,
      tests: tests,
      summary: {
        total: tests.length,
        passed: tests.filter(t => t.status === 'passed').length,
        failed: tests.filter(t => t.status === 'failed').length,
        errored: tests.filter(t => t.status === 'errored').length,
        needsReview: tests.filter(t => t.status === 'needs_review').length
      }
    };

    return 'STORE_RESULTS';
  } catch (error) {
    console.error('Comparison and evaluation failed:', error);
    return 'FAILED';
  }
}
```

**Step 5: Run test to verify it passes**

```bash
npm test -- run-command.test.ts -t "handleCompareAndEvaluate"
```

Expected: PASS

**Step 6: Commit**

```bash
git add src/orchestrator/types/results.ts src/orchestrator/handlers/run-command.ts src/orchestrator/handlers/run-command.test.ts
git commit -m "feat(orchestrator): implement COMPARE_AND_EVALUATE state handler"
```

---

## Task 9: STORE_RESULTS and CLEANUP State Handlers

**Files:**
- Modify: `src/orchestrator/handlers/run-command.ts`
- Test: `src/orchestrator/handlers/run-command.test.ts`

**Step 1: Write the failing tests**

```typescript
// Add to run-command.test.ts
describe('RunCommandHandler.handleStoreResults', () => {
  it('should save results and transition to CLEANUP', async () => {
    const mockSave = jest.fn();
    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');
    handler['resultStore'] = { saveResult: mockSave } as any;

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { basePath: '/base', currentPath: '/current' },
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: mockConfig,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await handler['handleStoreResults'](context);

    expect(nextState).toBe('CLEANUP');
    expect(mockSave).toHaveBeenCalledWith(context.runResult);
  });
});

describe('RunCommandHandler.handleCleanup', () => {
  it('should cleanup worktrees and transition to COMPLETE', async () => {
    const mockCleanup = jest.fn();
    (WorktreeManager as jest.Mock).mockImplementation(() => ({
      cleanup: mockCleanup
    }));

    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');
    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { basePath: '/base', currentPath: '/current' },
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await handler['handleCleanup'](context);

    expect(nextState).toBe('COMPLETE');
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('should skip cleanup if keepWorktrees flag set', async () => {
    const mockCleanup = jest.fn();
    (WorktreeManager as jest.Mock).mockImplementation(() => ({
      cleanup: mockCleanup
    }));

    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');
    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { basePath: '/base', currentPath: '/current' },
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: true
    };

    const nextState = await handler['handleCleanup'](context);

    expect(nextState).toBe('COMPLETE');
    expect(mockCleanup).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
npm test -- run-command.test.ts -t "handleStoreResults|handleCleanup"
```

Expected: FAIL

**Step 3: Implement handlers**

```typescript
// Add to RunCommandHandler class
import { ResultStore } from '../services/result-store';

private resultStore: ResultStore;

constructor(
  private config: Config,
  private plugins: LoadedPlugins,
  private projectRoot: string
) {
  const manifest = new SpecManifest(projectRoot);
  this.changeDetector = new ChangeDetector(config, manifest, projectRoot);
  this.resultStore = new ResultStore(projectRoot); // ADD THIS
}

private async handleStoreResults(
  context: ExecutionContext
): Promise<ExecutionState> {
  try {
    await this.resultStore.saveResult(context.runResult!);
    console.log('Results saved');
    return 'CLEANUP';
  } catch (error) {
    console.error('Failed to store results:', error);
    return 'FAILED';
  }
}

private async handleCleanup(
  context: ExecutionContext
): Promise<ExecutionState> {
  try {
    if (!context.keepWorktrees) {
      const worktreeManager = new WorktreeManager(this.projectRoot);
      worktreeManager.cleanup();
      console.log('Worktrees cleaned up');
    } else {
      console.log('Keeping worktrees for debugging');
    }
    return 'COMPLETE';
  } catch (error) {
    console.warn('Cleanup failed:', error);
    // Don't fail the whole run if cleanup fails
    return 'COMPLETE';
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
npm test -- run-command.test.ts -t "handleStoreResults|handleCleanup"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/orchestrator/handlers/run-command.ts src/orchestrator/handlers/run-command.test.ts
git commit -m "feat(orchestrator): implement STORE_RESULTS and CLEANUP handlers"
```

---

## Task 10: State Machine Execute Loop

**Files:**
- Modify: `src/orchestrator/handlers/run-command.ts`
- Test: `src/orchestrator/handlers/run-command.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to run-command.test.ts
describe('RunCommandHandler.execute', () => {
  it('should run through all states and return 0 on success', async () => {
    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');

    // Mock all state handlers
    handler['handleSetup'] = jest.fn().mockResolvedValue('EXECUTE_BASE');
    handler['handleExecuteBase'] = jest.fn().mockResolvedValue('EXECUTE_CURRENT');
    handler['handleExecuteCurrent'] = jest.fn().mockResolvedValue('COMPARE_AND_EVALUATE');
    handler['handleCompareAndEvaluate'] = jest.fn().mockResolvedValue('STORE_RESULTS');
    handler['handleStoreResults'] = jest.fn().mockResolvedValue('CLEANUP');
    handler['handleCleanup'] = jest.fn().mockResolvedValue('COMPLETE');

    const exitCode = await handler.execute({ force: true });

    expect(exitCode).toBe(0);
    expect(handler['handleSetup']).toHaveBeenCalled();
    expect(handler['handleExecuteBase']).toHaveBeenCalled();
    expect(handler['handleExecuteCurrent']).toHaveBeenCalled();
    expect(handler['handleCompareAndEvaluate']).toHaveBeenCalled();
    expect(handler['handleStoreResults']).toHaveBeenCalled();
    expect(handler['handleCleanup']).toHaveBeenCalled();
  });

  it('should return 1 on FAILED state', async () => {
    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');

    handler['handleSetup'] = jest.fn().mockResolvedValue('FAILED');

    const exitCode = await handler.execute({ force: true });

    expect(exitCode).toBe(1);
  });

  it('should cleanup worktrees on error', async () => {
    const mockCleanup = jest.fn();
    (WorktreeManager as jest.Mock).mockImplementation(() => ({
      cleanup: mockCleanup
    }));

    const handler = new RunCommandHandler(mockConfig, mockPlugins, '/project');
    handler['handleSetup'] = jest.fn().mockRejectedValue(new Error('Setup crashed'));

    const exitCode = await handler.execute({ force: true });

    expect(exitCode).toBe(1);
    expect(mockCleanup).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- run-command.test.ts -t "execute"
```

Expected: FAIL with "Not yet implemented"

**Step 3: Implement execute loop**

```typescript
// Replace the stubbed execute() in RunCommandHandler class

async execute(options: RunOptions): Promise<number> {
  let state: ExecutionState = 'SETUP';
  const context: ExecutionContext = {
    scope: null,
    worktrees: null,
    baseResults: new Map<string, RawTestResult>(),
    currentResults: new Map<string, RawTestResult>(),
    runResult: null,
    keepWorktrees: options.keepWorktrees || false
  };

  try {
    while (state !== 'COMPLETE' && state !== 'FAILED') {
      switch (state) {
        case 'SETUP':
          state = await this.handleSetup(context, options);
          break;
        case 'EXECUTE_BASE':
          state = await this.handleExecuteBase(context);
          break;
        case 'EXECUTE_CURRENT':
          state = await this.handleExecuteCurrent(context);
          break;
        case 'COMPARE_AND_EVALUATE':
          state = await this.handleCompareAndEvaluate(context);
          break;
        case 'STORE_RESULTS':
          state = await this.handleStoreResults(context);
          break;
        case 'CLEANUP':
          state = await this.handleCleanup(context);
          break;
      }
    }

    return state === 'COMPLETE' ? 0 : 1;
  } catch (error) {
    console.error('Execution error:', error);

    // Attempt cleanup before failing
    if (!context.keepWorktrees && context.worktrees) {
      try {
        const worktreeManager = new WorktreeManager(this.projectRoot);
        worktreeManager.cleanup();
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }

    return 1;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- run-command.test.ts -t "execute"
```

Expected: PASS

**Step 5: Run full test suite**

```bash
npm test
```

Expected: All tests pass

**Step 6: Commit**

```bash
git add src/orchestrator/handlers/run-command.ts src/orchestrator/handlers/run-command.test.ts
git commit -m "feat(orchestrator): implement state machine execute loop"
```

---

## Task 11: Update Test Generator to Import Helper

**Files:**
- Modify: `src/plugins/test-generator-stub.ts`
- Test: `src/plugins/test-generator-stub.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to test-generator-stub.test.ts
describe('TestGeneratorStub with screenshotCheckpoint', () => {
  it('should include screenshotCheckpoint import in generated code', async () => {
    const generator = new TestGeneratorStub();
    const spec: TestSpec = {
      path: 'tests/example.md',
      content: 'Test login flow',
      intent: 'Test login flow'
    };

    const result = await generator.generate(spec, {} as any);

    expect(result.code).toContain("import { screenshotCheckpoint } from 'visual-uat/playwright'");
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test -- test-generator-stub.test.ts -t "screenshotCheckpoint"
```

Expected: FAIL

**Step 3: Update generator stub**

```typescript
// Modify src/plugins/test-generator-stub.ts
async generate(spec: TestSpec, context: CodebaseContext): Promise<GeneratedTest> {
  const testName = spec.path.replace(/\.md$/, '').replace(/[^a-zA-Z0-9]/g, '_');

  const code = `import { test, expect } from '@playwright/test';
import { screenshotCheckpoint } from 'visual-uat/playwright';

test('${testName}', async ({ page }) => {
  // Generated from: ${spec.path}
  // Intent: ${spec.intent}

  await page.goto('http://localhost:3000');
  await screenshotCheckpoint(page, 'initial');

  // TODO: Implement test based on spec

  expect(true).toBe(true);
});
`;

  return {
    code,
    metadata: {
      specPath: spec.path,
      generatedAt: new Date().toISOString()
    }
  };
}
```

**Step 4: Run test to verify it passes**

```bash
npm test -- test-generator-stub.test.ts -t "screenshotCheckpoint"
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/test-generator-stub.ts src/plugins/test-generator-stub.test.ts
git commit -m "feat(generator): add screenshotCheckpoint import to generated tests"
```

---

## Task 12: Final Integration Test

**Files:**
- Create: `tests/integration/execution-phase.test.md`

**Step 1: Create manual integration test**

```markdown
# Execution Phase Integration Test

This is a manual test to verify the execution phase end-to-end.

## Prerequisites

1. A test application running on localhost:3000
2. Git repository with main branch
3. Current branch with visual changes

## Setup

```bash
cd /Users/dylanr/work/2389/visual-uat/.worktrees/execution-phase
npm run build
```

## Test 1: Full Run

```bash
# From main branch
npm run visual-uat run --base-branch main
```

**Expected:**
- Worktrees created in .worktrees/
- Tests run in both base and current
- Screenshots captured in .visual-uat/screenshots/
- Diffs generated for changes
- Results saved to .visual-uat/results/
- Worktrees cleaned up
- Exit code 0

## Test 2: Run with Keep Worktrees

```bash
npm run visual-uat run --base-branch main --keep-worktrees
```

**Expected:**
- Same as Test 1
- Worktrees NOT cleaned up
- Can inspect .worktrees/base and .worktrees/current

**Cleanup:**
```bash
git worktree remove .worktrees/base
git worktree remove .worktrees/current
```

## Test 3: Base Test Error

Create a spec that crashes in base branch:

```bash
# Checkout base, introduce breaking change, commit
# Checkout feature branch, fix the break
npm run visual-uat run --base-branch main
```

**Expected:**
- Base test errors logged
- Current test still runs
- Result marked with baselineAvailable: false
- Exit code 1 (has errors)

## Test 4: No Changes Detected

```bash
# From main branch with no spec changes
npm run visual-uat run --base-branch main
```

**Expected:**
- Scope determined as 'skip'
- No worktrees created
- Message: "No changes detected, skipping tests"
- Exit code 0

## Verification

All integration tests should pass. If any fail:
1. Check logs for error details
2. Inspect worktrees (use --keep-worktrees)
3. Verify screenshot and diff directories
4. Check .visual-uat/results/ for saved results
```

**Step 2: Document integration test**

```bash
git add tests/integration/execution-phase.test.md
git commit -m "test: add execution phase integration test"
```

---

## Completion Checklist

When all tasks complete:

- [ ] All unit tests pass (npm test)
- [ ] Manual integration tests pass
- [ ] State machine implements all 8 states
- [ ] Test runner executes Playwright tests
- [ ] Screenshot helper available for imports
- [ ] Comparison and evaluation logic complete
- [ ] Results stored to disk
- [ ] Worktree cleanup respects --keep-worktrees flag
- [ ] CLI integrated with new flag
- [ ] Documentation updated

## Next Steps After Implementation

1. Run full integration test with real test application
2. Collect feedback on LLM evaluation quality
3. Optimize parallel execution (future iteration)
4. Build HTML reporter (future iteration)
5. Add screenshot history tracking (future iteration)
