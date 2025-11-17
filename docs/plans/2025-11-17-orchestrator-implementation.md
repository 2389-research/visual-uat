# Orchestrator Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the orchestrator that coordinates all plugins to execute the complete visual acceptance testing workflow.

**Architecture:** Command Handler pattern with dedicated handlers for each CLI command (run, generate, report), supported by shared services (ChangeDetector, PluginRegistry, ResultStore, WorktreeManager).

**Tech Stack:** TypeScript, Node.js, Jest, Commander.js, existing plugin interfaces

---

## Task 1: Result Type Definitions

**Files:**
- Create: `src/orchestrator/types/results.ts`
- Test: `src/orchestrator/types/results.test.ts`

**Step 1: Write the failing test**

```typescript
// src/orchestrator/types/results.test.ts
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
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/orchestrator/types/results.test.ts`
Expected: FAIL with "Cannot find module './results'"

**Step 3: Create directory structure**

Run: `mkdir -p src/orchestrator/types src/orchestrator/services src/orchestrator/handlers`

**Step 4: Write minimal implementation**

```typescript
// src/orchestrator/types/results.ts
// ABOUTME: Type definitions for test execution results, including checkpoints, tests, and full run summaries.
// ABOUTME: These structures are persisted to JSON and used by the report viewer.

import { Config } from '../../types/config';
import { BoundingBox } from '../../types/plugins';

export interface CheckpointResult {
  name: string;
  baselineImage: string; // relative path
  currentImage: string;
  diffImage: string;
  diffMetrics: {
    pixelDiffPercent: number;
    changedRegions: BoundingBox[];
  };
  evaluation: {
    pass: boolean;
    confidence: number;
    reason: string;
    needsReview: boolean;
  };
}

export interface TestResult {
  specPath: string;
  generatedPath: string;
  status: 'passed' | 'failed' | 'errored' | 'needs-review';
  checkpoints: CheckpointResult[];
  error?: string;
  duration: number;
}

export interface RunResult {
  timestamp: number;
  baseBranch: string;
  currentBranch: string;
  config: Config;
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errored: number;
    needsReview: number;
  };
}
```

**Step 5: Run test to verify it passes**

Run: `npm test -- src/orchestrator/types/results.test.ts`
Expected: PASS (3 tests)

**Step 6: Commit**

```bash
git add src/orchestrator/types/results.ts src/orchestrator/types/results.test.ts
git commit -m "feat(orchestrator): add result type definitions"
```

---

## Task 2: ChangeDetector Service

**Files:**
- Create: `src/orchestrator/services/change-detector.ts`
- Test: `src/orchestrator/services/change-detector.test.ts`

**Step 1: Write the failing test**

```typescript
// src/orchestrator/services/change-detector.test.ts
import { ChangeDetector } from './change-detector';
import { Config } from '../../types/config';
import { SpecManifest } from '../../specs/manifest';
import { execSync } from 'child_process';

jest.mock('child_process');
jest.mock('fs');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('ChangeDetector', () => {
  let detector: ChangeDetector;
  let config: Config;
  let manifest: SpecManifest;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/playwright-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    manifest = new SpecManifest('/fake/path');
    detector = new ChangeDetector(config, manifest, '/fake/project');
  });

  describe('determineScope', () => {
    it('should return "full" when --all flag is set', () => {
      const scope = detector.determineScope({ all: true });
      expect(scope).toBe('full');
    });

    it('should return "full" when codebase changed', () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('exit code 1'); // git diff returns non-zero
      });

      const scope = detector.determineScope({ all: false });
      expect(scope).toBe('full');
    });

    it('should return "incremental" when specs changed but not codebase', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from('')); // git diff returns 0

      jest.spyOn(manifest, 'detectChanges').mockReturnValue({
        new: ['tests/new-test.md'],
        modified: [],
        deleted: []
      });

      const scope = detector.determineScope({ all: false });
      expect(scope).toBe('incremental');
    });

    it('should return "skip" when nothing changed', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''));

      jest.spyOn(manifest, 'detectChanges').mockReturnValue({
        new: [],
        modified: [],
        deleted: []
      });

      const scope = detector.determineScope({ all: false });
      expect(scope).toBe('skip');
    });

    it('should use custom base branch from options', () => {
      mockExecSync.mockReturnValueOnce(Buffer.from(''));
      jest.spyOn(manifest, 'detectChanges').mockReturnValue({
        new: [],
        modified: [],
        deleted: []
      });

      detector.determineScope({ all: false, baseBranch: 'develop' });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('develop..HEAD'),
        expect.any(Object)
      );
    });
  });

  describe('getSpecsToGenerate', () => {
    it('should return all specs for full run', () => {
      const fs = require('fs');
      fs.readdirSync = jest.fn().mockReturnValue(['test1.md', 'test2.md', 'README.md']);

      const specs = detector.getSpecsToGenerate('full');
      expect(specs).toEqual(['tests/test1.md', 'tests/test2.md']);
    });

    it('should return only new/modified specs for incremental run', () => {
      jest.spyOn(manifest, 'detectChanges').mockReturnValue({
        new: ['tests/new.md'],
        modified: ['tests/updated.md'],
        deleted: []
      });

      const specs = detector.getSpecsToGenerate('incremental');
      expect(specs).toEqual(['tests/new.md', 'tests/updated.md']);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/orchestrator/services/change-detector.test.ts`
Expected: FAIL with "Cannot find module './change-detector'"

**Step 3: Write minimal implementation**

```typescript
// src/orchestrator/services/change-detector.ts
// ABOUTME: Determines whether to run full test suite, incremental tests, or skip based on git changes and spec manifest.
// ABOUTME: Combines git diff detection (codebase changes) with manifest hashing (spec changes).

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import * as path from 'path';
import { Config } from '../../types/config';
import { SpecManifest } from '../../specs/manifest';

export type ExecutionScope = 'full' | 'incremental' | 'skip';

export interface RunOptions {
  all?: boolean;
  baseBranch?: string;
}

export class ChangeDetector {
  constructor(
    private config: Config,
    private manifest: SpecManifest,
    private projectRoot: string
  ) {}

  determineScope(options: RunOptions): ExecutionScope {
    // Explicit flag overrides all
    if (options.all) {
      return 'full';
    }

    // Check if codebase changed since base branch
    const baseBranch = options.baseBranch || this.config.baseBranch;
    if (this.hasCodebaseChanges(baseBranch)) {
      return 'full';
    }

    // Check if specs changed via manifest
    const specFiles = this.findSpecFiles();
    const changes = this.manifest.detectChanges(specFiles);

    if (changes.new.length > 0 || changes.modified.length > 0) {
      return 'incremental';
    }

    // Nothing changed
    return 'skip';
  }

  getSpecsToGenerate(scope: ExecutionScope): string[] {
    if (scope === 'full') {
      return this.findSpecFiles();
    } else if (scope === 'incremental') {
      const changes = this.manifest.detectChanges(this.findSpecFiles());
      return [...changes.new, ...changes.modified];
    }
    return [];
  }

  private hasCodebaseChanges(baseBranch: string): boolean {
    try {
      execSync(
        `git diff --quiet ${baseBranch}..HEAD -- src/`,
        { cwd: this.projectRoot, stdio: 'pipe' }
      );
      return false; // No differences (exit code 0)
    } catch (error: any) {
      // Exit code 1 means differences exist, which is expected
      if (error.status === 1) {
        return true;
      }
      // Any other error should be thrown
      throw error;
    }
  }

  private findSpecFiles(): string[] {
    const files = readdirSync(this.config.specsDir);
    return files
      .filter(f => {
        if (!f.endsWith('.md')) return false;
        // Only exclude files where basename (without extension) is exactly "README"
        const basename = path.basename(f, '.md');
        return basename.toUpperCase() !== 'README';
      })
      .map(f => path.join(this.config.specsDir, f));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/orchestrator/services/change-detector.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/orchestrator/services/change-detector.ts src/orchestrator/services/change-detector.test.ts
git commit -m "feat(orchestrator): add ChangeDetector service for smart test detection"
```

---

## Task 3: PluginRegistry Service

**Files:**
- Create: `src/orchestrator/services/plugin-registry.ts`
- Test: `src/orchestrator/services/plugin-registry.test.ts`

**Step 1: Write the failing test**

```typescript
// src/orchestrator/services/plugin-registry.test.ts
import { PluginRegistry } from './plugin-registry';
import { Config } from '../../types/config';
import { TestGenerator, TargetRunner, Differ, Evaluator } from '../../types/plugins';

describe('PluginRegistry', () => {
  let config: Config;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/playwright-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      },
      evaluator: {
        autoPassThreshold: 0.95,
        autoFailThreshold: 0.3
      }
    } as Config;
  });

  describe('loadPlugin', () => {
    it('should load built-in TestGenerator plugin', () => {
      const registry = new PluginRegistry(config);
      const plugin = registry.loadPlugin('testGenerator');

      expect(plugin).toBeDefined();
      expect(typeof (plugin as TestGenerator).generate).toBe('function');
    });

    it('should load built-in TargetRunner plugin', () => {
      const registry = new PluginRegistry(config);
      const plugin = registry.loadPlugin('targetRunner');

      expect(plugin).toBeDefined();
      expect(typeof (plugin as TargetRunner).start).toBe('function');
      expect(typeof (plugin as TargetRunner).stop).toBe('function');
      expect(typeof (plugin as TargetRunner).isReady).toBe('function');
    });

    it('should load built-in Differ plugin', () => {
      const registry = new PluginRegistry(config);
      const plugin = registry.loadPlugin('differ');

      expect(plugin).toBeDefined();
      expect(typeof (plugin as Differ).compare).toBe('function');
    });

    it('should load built-in Evaluator plugin', () => {
      const registry = new PluginRegistry(config);
      const plugin = registry.loadPlugin('evaluator');

      expect(plugin).toBeDefined();
      expect(typeof (plugin as Evaluator).evaluate).toBe('function');
    });

    it('should throw error for unknown plugin', () => {
      config.plugins.testGenerator = '@unknown/plugin';
      const registry = new PluginRegistry(config);

      expect(() => registry.loadPlugin('testGenerator')).toThrow('Unknown plugin');
    });
  });

  describe('loadAll', () => {
    it('should load all plugins at once', () => {
      const registry = new PluginRegistry(config);
      const plugins = registry.loadAll();

      expect(plugins.testGenerator).toBeDefined();
      expect(plugins.targetRunner).toBeDefined();
      expect(plugins.differ).toBeDefined();
      expect(plugins.evaluator).toBeDefined();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/orchestrator/services/plugin-registry.test.ts`
Expected: FAIL with "Cannot find module './plugin-registry'"

**Step 3: Write minimal implementation**

```typescript
// src/orchestrator/services/plugin-registry.ts
// ABOUTME: Loads and validates plugins from configuration, instantiating built-in plugins.
// ABOUTME: Future enhancement: support external plugins via npm packages.

import { Config } from '../../types/config';
import { TestGenerator, TargetRunner, Differ, Evaluator } from '../../types/plugins';
import { StubTestGenerator } from '../../plugins/test-generator-stub';
import { PlaywrightRunner } from '../../plugins/playwright-runner';
import { PixelmatchDiffer } from '../../plugins/pixelmatch-differ';
import { ClaudeEvaluator } from '../../plugins/claude-evaluator';

type PluginType = 'testGenerator' | 'targetRunner' | 'differ' | 'evaluator';

export interface LoadedPlugins {
  testGenerator: TestGenerator;
  targetRunner: TargetRunner;
  differ: Differ;
  evaluator: Evaluator;
}

export class PluginRegistry {
  private builtins: Record<string, any> = {
    '@visual-uat/stub-generator': StubTestGenerator,
    '@visual-uat/playwright-runner': PlaywrightRunner,
    '@visual-uat/pixelmatch-differ': PixelmatchDiffer,
    '@visual-uat/claude-evaluator': ClaudeEvaluator
  };

  constructor(private config: Config) {}

  loadPlugin(type: PluginType): TestGenerator | TargetRunner | Differ | Evaluator {
    const pluginName = this.config.plugins[type];

    if (pluginName in this.builtins) {
      const PluginClass = this.builtins[pluginName];
      return new PluginClass(this.config);
    }

    // Future: External plugins
    // const Plugin = require(pluginName);
    // return new Plugin(this.config);

    throw new Error(`Unknown plugin: ${pluginName}`);
  }

  loadAll(): LoadedPlugins {
    return {
      testGenerator: this.loadPlugin('testGenerator') as TestGenerator,
      targetRunner: this.loadPlugin('targetRunner') as TargetRunner,
      differ: this.loadPlugin('differ') as Differ,
      evaluator: this.loadPlugin('evaluator') as Evaluator
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/orchestrator/services/plugin-registry.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/orchestrator/services/plugin-registry.ts src/orchestrator/services/plugin-registry.test.ts
git commit -m "feat(orchestrator): add PluginRegistry service for loading plugins"
```

---

## Task 4: ResultStore Service

**Files:**
- Create: `src/orchestrator/services/result-store.ts`
- Test: `src/orchestrator/services/result-store.test.ts`

**Step 1: Write the failing test**

```typescript
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
      const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
      const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

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
      const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
      mockReaddirSync.mockReturnValue([] as any);

      const result = await store.loadLatestResult();
      expect(result).toBeNull();
    });
  });

  describe('ensureDirectories', () => {
    it('should create all required directories', () => {
      const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;

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
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/orchestrator/services/result-store.test.ts`
Expected: FAIL with "Cannot find module './result-store'"

**Step 3: Write minimal implementation**

```typescript
// src/orchestrator/services/result-store.ts
// ABOUTME: Persists test artifacts (screenshots, diffs) and results to .visual-uat/ directory.
// ABOUTME: Handles JSON serialization and directory structure management.

import * as fs from 'fs';
import * as path from 'path';
import { RunResult } from '../types/results';

export class ResultStore {
  private visualUatDir: string;

  constructor(private projectRoot: string) {
    this.visualUatDir = path.join(projectRoot, '.visual-uat');
  }

  async saveRunResult(result: RunResult): Promise<string> {
    const resultsDir = path.join(this.visualUatDir, 'results');

    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `run-${result.timestamp}.json`;
    const filePath = path.join(resultsDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));

    return filePath;
  }

  async loadLatestResult(): Promise<RunResult | null> {
    const resultsDir = path.join(this.visualUatDir, 'results');

    if (!fs.existsSync(resultsDir)) {
      return null;
    }

    const files = fs.readdirSync(resultsDir)
      .filter(f => f.startsWith('run-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return null;
    }

    const latestFile = path.join(resultsDir, files[0]);
    const content = fs.readFileSync(latestFile, 'utf-8');
    return JSON.parse(content);
  }

  async loadResult(timestamp: number): Promise<RunResult | null> {
    const filePath = path.join(this.visualUatDir, 'results', `run-${timestamp}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  ensureDirectories(): void {
    const dirs = [
      path.join(this.visualUatDir, 'screenshots', 'base'),
      path.join(this.visualUatDir, 'screenshots', 'current'),
      path.join(this.visualUatDir, 'diffs'),
      path.join(this.visualUatDir, 'results')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  getScreenshotPath(branch: 'base' | 'current', testName: string, checkpoint: string): string {
    return path.join(
      this.visualUatDir,
      'screenshots',
      branch,
      testName,
      `${checkpoint}.png`
    );
  }

  getDiffPath(testName: string, checkpoint: string): string {
    return path.join(
      this.visualUatDir,
      'diffs',
      testName,
      `${checkpoint}.png`
    );
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/orchestrator/services/result-store.test.ts`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/orchestrator/services/result-store.ts src/orchestrator/services/result-store.test.ts
git commit -m "feat(orchestrator): add ResultStore service for persisting results"
```

---

## Task 5: WorktreeManager Service

**Files:**
- Create: `src/orchestrator/services/worktree-manager.ts`
- Test: `src/orchestrator/services/worktree-manager.test.ts`

**Step 1: Write the failing test**

```typescript
// src/orchestrator/services/worktree-manager.test.ts
import { WorktreeManager } from './worktree-manager';
import { execSync } from 'child_process';
import * as fs from 'fs';

jest.mock('child_process');
jest.mock('fs');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;

describe('WorktreeManager', () => {
  let manager: WorktreeManager;
  const projectRoot = '/fake/project';

  beforeEach(() => {
    manager = new WorktreeManager(projectRoot);
    jest.clearAllMocks();
  });

  describe('createWorktrees', () => {
    it('should create worktrees for base and current branches', async () => {
      mockExecSync.mockReturnValue(Buffer.from(''));
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      mockExistsSync.mockReturnValue(true); // package.json exists

      const paths = await manager.createWorktrees('main', 'feature/test');

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git worktree add .worktrees/base main'),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git worktree add .worktrees/current feature/test'),
        expect.any(Object)
      );

      expect(paths.base).toContain('.worktrees/base');
      expect(paths.current).toContain('.worktrees/current');
    });

    it('should run npm install in each worktree', async () => {
      mockExecSync.mockReturnValue(Buffer.from(''));
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      mockExistsSync.mockReturnValue(true);

      await manager.createWorktrees('main', 'feature/test');

      expect(mockExecSync).toHaveBeenCalledWith(
        'npm install',
        expect.objectContaining({ cwd: expect.stringContaining('.worktrees/base') })
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        'npm install',
        expect.objectContaining({ cwd: expect.stringContaining('.worktrees/current') })
      );
    });

    it('should skip npm install if package.json does not exist', async () => {
      mockExecSync.mockReturnValue(Buffer.from(''));
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      mockExistsSync.mockReturnValue(false);

      await manager.createWorktrees('main', 'feature/test');

      const npmInstallCalls = mockExecSync.mock.calls.filter(
        call => call[0] === 'npm install'
      );
      expect(npmInstallCalls).toHaveLength(0);
    });

    it('should throw error if git worktree fails', async () => {
      mockExecSync.mockImplementationOnce(() => {
        throw new Error('git worktree failed');
      });

      await expect(manager.createWorktrees('main', 'feature/test'))
        .rejects.toThrow('git worktree failed');
    });
  });

  describe('cleanup', () => {
    it('should remove worktrees', async () => {
      mockExecSync.mockReturnValue(Buffer.from(''));

      await manager.cleanup();

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git worktree remove .worktrees/base'),
        expect.any(Object)
      );
      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git worktree remove .worktrees/current'),
        expect.any(Object)
      );
    });

    it('should force remove if normal removal fails', async () => {
      mockExecSync
        .mockImplementationOnce(() => {
          throw new Error('worktree locked');
        })
        .mockReturnValueOnce(Buffer.from('')); // Force removal succeeds

      await manager.cleanup();

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git worktree remove --force .worktrees/base'),
        expect.any(Object)
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/orchestrator/services/worktree-manager.test.ts`
Expected: FAIL with "Cannot find module './worktree-manager'"

**Step 3: Write minimal implementation**

```typescript
// src/orchestrator/services/worktree-manager.ts
// ABOUTME: Manages git worktrees for isolated branch testing, creating and cleaning up worktrees.
// ABOUTME: Handles dependency installation (npm install) in each worktree.

import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface WorktreePaths {
  base: string;
  current: string;
}

export class WorktreeManager {
  constructor(private projectRoot: string) {}

  async createWorktrees(baseBranch: string, currentBranch: string): Promise<WorktreePaths> {
    const basePath = path.join(this.projectRoot, '.worktrees/base');
    const currentPath = path.join(this.projectRoot, '.worktrees/current');

    // Create worktrees - using spawnSync with array args prevents shell injection
    const baseResult = spawnSync('git', ['worktree', 'add', '.worktrees/base', baseBranch], {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    if (baseResult.error || baseResult.status !== 0) {
      throw new Error(`Failed to create base worktree: ${baseResult.error?.message || 'git command failed'}`);
    }

    const currentResult = spawnSync('git', ['worktree', 'add', '.worktrees/current', currentBranch], {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    if (currentResult.error || currentResult.status !== 0) {
      throw new Error(`Failed to create current worktree: ${currentResult.error?.message || 'git command failed'}`);
    }

    // Install dependencies if package.json exists
    if (fs.existsSync(path.join(basePath, 'package.json'))) {
      spawnSync('npm', ['install'], { cwd: basePath, stdio: 'inherit' });
    }

    if (fs.existsSync(path.join(currentPath, 'package.json'))) {
      spawnSync('npm', ['install'], { cwd: currentPath, stdio: 'inherit' });
    }

    return {
      base: basePath,
      current: currentPath
    };
  }

  async cleanup(): Promise<void> {
    // Try to remove base worktree, force if it fails
    const baseResult = spawnSync('git', ['worktree', 'remove', '.worktrees/base'], {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    if (baseResult.status !== 0) {
      // Force remove if locked
      spawnSync('git', ['worktree', 'remove', '--force', '.worktrees/base'], {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
    }

    // Try to remove current worktree, force if it fails
    const currentResult = spawnSync('git', ['worktree', 'remove', '.worktrees/current'], {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    if (currentResult.status !== 0) {
      spawnSync('git', ['worktree', 'remove', '--force', '.worktrees/current'], {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/orchestrator/services/worktree-manager.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/orchestrator/services/worktree-manager.ts src/orchestrator/services/worktree-manager.test.ts
git commit -m "feat(orchestrator): add WorktreeManager service for git worktree management"
```

---

## Task 6: GenerateCommandHandler

**Files:**
- Create: `src/orchestrator/handlers/generate-command.ts`
- Test: `src/orchestrator/handlers/generate-command.test.ts`

**Step 1: Write the failing test**

```typescript
// src/orchestrator/handlers/generate-command.test.ts
import { GenerateCommandHandler } from './generate-command';
import { Config } from '../../types/config';
import { TestGenerator } from '../../types/plugins';
import * as fs from 'fs';

jest.mock('fs');

describe('GenerateCommandHandler', () => {
  let config: Config;
  let mockGenerator: jest.Mocked<TestGenerator>;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/playwright-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    mockGenerator = {
      generate: jest.fn()
    };

    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should generate tests for all specs', async () => {
      const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
      const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
      const mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

      mockReaddirSync.mockReturnValue(['test1.md', 'test2.md'] as any);
      mockReadFileSync.mockReturnValue('Test spec content');
      mockExistsSync.mockReturnValue(true);

      mockGenerator.generate.mockResolvedValue({
        code: 'test code',
        language: 'typescript',
        checkpoints: ['checkpoint1']
      });

      const handler = new GenerateCommandHandler(config, '/fake/project');
      const exitCode = await handler.execute(mockGenerator);

      expect(mockGenerator.generate).toHaveBeenCalledTimes(2);
      expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
      expect(exitCode).toBe(0);
    });

    it('should log error and continue if generation fails', async () => {
      const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
      const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

      mockReaddirSync.mockReturnValue(['test1.md', 'test2.md'] as any);
      mockReadFileSync.mockReturnValue('Test spec content');
      mockExistsSync.mockReturnValue(true);

      mockGenerator.generate
        .mockRejectedValueOnce(new Error('LLM timeout'))
        .mockResolvedValueOnce({
          code: 'test code',
          language: 'typescript',
          checkpoints: ['checkpoint1']
        });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const handler = new GenerateCommandHandler(config, '/fake/project');
      const exitCode = await handler.execute(mockGenerator);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('LLM timeout')
      );
      expect(mockGenerator.generate).toHaveBeenCalledTimes(2);
      expect(exitCode).toBe(0);

      consoleErrorSpy.mockRestore();
    });

    it('should create generated directory if it does not exist', async () => {
      const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
      const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
      const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;

      mockReaddirSync.mockReturnValue(['test1.md'] as any);
      mockReadFileSync.mockReturnValue('Test spec content');
      mockExistsSync.mockReturnValue(false);

      mockGenerator.generate.mockResolvedValue({
        code: 'test code',
        language: 'typescript',
        checkpoints: ['checkpoint1']
      });

      const handler = new GenerateCommandHandler(config, '/fake/project');
      await handler.execute(mockGenerator);

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('tests/generated'),
        { recursive: true }
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/orchestrator/handlers/generate-command.test.ts`
Expected: FAIL with "Cannot find module './generate-command'"

**Step 3: Write minimal implementation**

```typescript
// src/orchestrator/handlers/generate-command.ts
// ABOUTME: Handles the 'generate' command, regenerating all test scripts from specs without executing them.
// ABOUTME: Continues on generation failures, logging errors and providing summary.

import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../../types/config';
import { TestGenerator, TestSpec, CodebaseContext } from '../../types/plugins';

export class GenerateCommandHandler {
  constructor(
    private config: Config,
    private projectRoot: string
  ) {}

  async execute(generator: TestGenerator): Promise<number> {
    const specFiles = this.findSpecFiles();
    const results: { success: string[]; failed: Array<{ spec: string; error: string }> } = {
      success: [],
      failed: []
    };

    // Ensure generated directory exists
    if (!fs.existsSync(this.config.generatedDir)) {
      fs.mkdirSync(this.config.generatedDir, { recursive: true });
    }

    for (const specPath of specFiles) {
      try {
        await this.generateTest(specPath, generator);
        results.success.push(specPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failed.push({ spec: specPath, error: errorMessage });
        console.error(`Failed to generate test for ${specPath}: ${errorMessage}`);
      }
    }

    this.printSummary(results);
    return 0;
  }

  private async generateTest(specPath: string, generator: TestGenerator): Promise<void> {
    const content = fs.readFileSync(specPath, 'utf-8');
    const spec: TestSpec = {
      path: specPath,
      content,
      intent: content // For MVP, intent is the full content
    };

    const context: CodebaseContext = {
      files: [],
      structure: ''
    };

    const generated = await generator.generate(spec, context);

    const baseName = path.basename(specPath, '.md');
    const outputPath = path.join(this.config.generatedDir, `${baseName}.spec.ts`);

    fs.writeFileSync(outputPath, generated.code);
  }

  private findSpecFiles(): string[] {
    const files = fs.readdirSync(this.config.specsDir);
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(this.config.specsDir, f));
  }

  private printSummary(results: { success: string[]; failed: Array<{ spec: string; error: string }> }): void {
    const total = results.success.length + results.failed.length;

    console.log(`\nGenerated ${total} test scripts`);
    console.log(`✓ ${results.success.length} successful`);

    if (results.failed.length > 0) {
      console.log(`✗ ${results.failed.length} failed:`);
      results.failed.forEach(({ spec, error }) => {
        console.log(`  - ${spec}: ${error}`);
      });
    }
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/orchestrator/handlers/generate-command.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/orchestrator/handlers/generate-command.ts src/orchestrator/handlers/generate-command.test.ts
git commit -m "feat(orchestrator): add GenerateCommandHandler"
```

---

## Task 7: ReportCommandHandler (Stub)

**Files:**
- Create: `src/orchestrator/handlers/report-command.ts`
- Test: `src/orchestrator/handlers/report-command.test.ts`

**Step 1: Write the failing test**

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/orchestrator/handlers/report-command.test.ts`
Expected: FAIL with "Cannot find module './report-command'"

**Step 3: Write minimal implementation (stub for now)**

```typescript
// src/orchestrator/handlers/report-command.ts
// ABOUTME: Handles the 'report' command, displaying test results from previous runs.
// ABOUTME: Currently a stub implementation - HTML reporter to be implemented later.

import { ResultStore } from '../services/result-store';
import { RunResult } from '../types/results';

export class ReportCommandHandler {
  constructor(private resultStore: ResultStore) {}

  async execute(runId?: number): Promise<number> {
    const result = runId
      ? await this.resultStore.loadResult(runId)
      : await this.resultStore.loadLatestResult();

    if (!result) {
      console.error('No test results found');
      return 1;
    }

    this.printConsoleReport(result);
    return 0;
  }

  private printConsoleReport(result: RunResult): void {
    console.log('\nVisual UAT Results:');
    console.log(`✓ ${result.summary.passed} passed`);

    if (result.summary.failed > 0) {
      console.log(`✗ ${result.summary.failed} failed`);
    }

    if (result.summary.needsReview > 0) {
      console.log(`⚠ ${result.summary.needsReview} need manual review`);
    }

    if (result.summary.errored > 0) {
      console.log(`⊗ ${result.summary.errored} errored`);
    }

    // Print failed tests
    if (result.summary.failed > 0) {
      console.log('\nFailed tests:');
      result.tests
        .filter(t => t.status === 'failed')
        .forEach(t => {
          console.log(`  - ${t.specPath}`);
        });
    }

    // Print tests needing review
    if (result.summary.needsReview > 0) {
      console.log('\nReview needed:');
      result.tests
        .filter(t => t.status === 'needs-review')
        .forEach(t => {
          console.log(`  - ${t.specPath}`);
        });
    }

    console.log(`\nFull report: .visual-uat/results/run-${result.timestamp}.json`);
    console.log('Note: HTML reporter coming soon!');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/orchestrator/handlers/report-command.test.ts`
Expected: PASS (3 tests)

**Step 5: Commit**

```bash
git add src/orchestrator/handlers/report-command.ts src/orchestrator/handlers/report-command.test.ts
git commit -m "feat(orchestrator): add ReportCommandHandler (stub)"
```

---

## Task 8: RunCommandHandler (Part 1: Structure and Setup Phase)

**Files:**
- Create: `src/orchestrator/handlers/run-command.ts`
- Test: `src/orchestrator/handlers/run-command.test.ts`

**Note:** This is a complex handler, so we'll break it into multiple commits: structure, setup phase, generation phase, execution phase, evaluation phase.

**Step 1: Write the failing test for setup phase**

```typescript
// src/orchestrator/handlers/run-command.test.ts
import { RunCommandHandler } from './run-command';
import { Config } from '../../types/config';
import { LoadedPlugins } from '../services/plugin-registry';

describe('RunCommandHandler - Setup Phase', () => {
  let config: Config;
  let mockPlugins: LoadedPlugins;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/playwright-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    mockPlugins = {
      testGenerator: { generate: jest.fn() } as any,
      targetRunner: { start: jest.fn(), stop: jest.fn(), isReady: jest.fn() } as any,
      differ: { compare: jest.fn() } as any,
      evaluator: { evaluate: jest.fn() } as any
    };
  });

  it('should create handler with required dependencies', () => {
    const handler = new RunCommandHandler(
      config,
      mockPlugins,
      '/fake/project'
    );

    expect(handler).toBeDefined();
  });

  it('should determine execution scope on initialize', async () => {
    const handler = new RunCommandHandler(
      config,
      mockPlugins,
      '/fake/project'
    );

    const scope = await handler.determineScope({ all: true });
    expect(scope).toBe('full');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/orchestrator/handlers/run-command.test.ts`
Expected: FAIL with "Cannot find module './run-command'"

**Step 3: Write minimal implementation (structure only)**

```typescript
// src/orchestrator/handlers/run-command.ts
// ABOUTME: Handles the 'run' command, orchestrating the full test execution workflow.
// ABOUTME: Coordinates generation, execution in worktrees, screenshot comparison, and LLM evaluation.

import { Config } from '../../types/config';
import { LoadedPlugins } from '../services/plugin-registry';
import { ChangeDetector, ExecutionScope, RunOptions } from '../services/change-detector';
import { SpecManifest } from '../../specs/manifest';
import * as path from 'path';

export class RunCommandHandler {
  private changeDetector: ChangeDetector;

  constructor(
    private config: Config,
    private plugins: LoadedPlugins,
    private projectRoot: string
  ) {
    const manifest = new SpecManifest(projectRoot);
    this.changeDetector = new ChangeDetector(config, manifest, projectRoot);
  }

  async determineScope(options: RunOptions): Promise<ExecutionScope> {
    return this.changeDetector.determineScope(options);
  }

  async execute(options: RunOptions): Promise<number> {
    // To be implemented in subsequent steps
    throw new Error('Not yet implemented');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/orchestrator/handlers/run-command.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add src/orchestrator/handlers/run-command.ts src/orchestrator/handlers/run-command.test.ts
git commit -m "feat(orchestrator): add RunCommandHandler structure and setup"
```

---

## Task 9: RunCommandHandler (Part 2: Generation Phase)

**Step 1: Add tests for generation phase**

```typescript
// Add to src/orchestrator/handlers/run-command.test.ts
describe('RunCommandHandler - Generation Phase', () => {
  it('should generate tests for all specs in full mode', async () => {
    const fs = require('fs');
    fs.readdirSync = jest.fn().mockReturnValue(['test1.md', 'test2.md']);
    fs.readFileSync = jest.fn().mockReturnValue('Test content');
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(true);

    mockPlugins.testGenerator.generate = jest.fn().mockResolvedValue({
      code: 'test code',
      language: 'typescript',
      checkpoints: ['checkpoint1']
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');
    const results = await handler.generateTests('full');

    expect(mockPlugins.testGenerator.generate).toHaveBeenCalledTimes(2);
    expect(results.success).toHaveLength(2);
    expect(results.failed).toHaveLength(0);
  });

  it('should continue on generation failure when not fail-fast', async () => {
    const fs = require('fs');
    fs.readdirSync = jest.fn().mockReturnValue(['test1.md', 'test2.md']);
    fs.readFileSync = jest.fn().mockReturnValue('Test content');
    fs.writeFileSync = jest.fn();
    fs.existsSync = jest.fn().mockReturnValue(true);

    mockPlugins.testGenerator.generate = jest.fn()
      .mockRejectedValueOnce(new Error('LLM timeout'))
      .mockResolvedValueOnce({
        code: 'test code',
        language: 'typescript',
        checkpoints: ['checkpoint1']
      });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');
    const results = await handler.generateTests('full', { failFast: false });

    expect(mockPlugins.testGenerator.generate).toHaveBeenCalledTimes(2);
    expect(results.success).toHaveLength(1);
    expect(results.failed).toHaveLength(1);
  });

  it('should exit immediately on generation failure with fail-fast', async () => {
    const fs = require('fs');
    fs.readdirSync = jest.fn().mockReturnValue(['test1.md', 'test2.md']);
    fs.readFileSync = jest.fn().mockReturnValue('Test content');
    fs.existsSync = jest.fn().mockReturnValue(true);

    mockPlugins.testGenerator.generate = jest.fn()
      .mockRejectedValueOnce(new Error('LLM timeout'));

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    await expect(handler.generateTests('full', { failFast: true }))
      .rejects.toThrow('LLM timeout');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/orchestrator/handlers/run-command.test.ts`
Expected: FAIL with "handler.generateTests is not a function"

**Step 3: Implement generation phase**

```typescript
// Add to src/orchestrator/handlers/run-command.ts
import * as fs from 'fs';
import { TestSpec, CodebaseContext } from '../../types/plugins';

export interface GenerationResult {
  success: string[];
  failed: Array<{ spec: string; error: string }>;
}

export class RunCommandHandler {
  // ... existing code ...

  async generateTests(
    scope: ExecutionScope,
    options: { failFast?: boolean } = {}
  ): Promise<GenerationResult> {
    const specsToGenerate = this.changeDetector.getSpecsToGenerate(scope);
    const results: GenerationResult = { success: [], failed: [] };
    const manifest = new SpecManifest(this.projectRoot);

    // Ensure generated directory exists
    if (!fs.existsSync(this.config.generatedDir)) {
      fs.mkdirSync(this.config.generatedDir, { recursive: true });
    }

    for (const specPath of specsToGenerate) {
      try {
        const generatedPath = await this.generateSingleTest(specPath);
        manifest.updateSpec(specPath, generatedPath);
        results.success.push(specPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failed.push({ spec: specPath, error: errorMessage });

        if (options.failFast) {
          throw error;
        }
      }
    }

    manifest.save();
    return results;
  }

  private async generateSingleTest(specPath: string): Promise<string> {
    const content = fs.readFileSync(specPath, 'utf-8');
    const spec: TestSpec = {
      path: specPath,
      content,
      intent: content
    };

    const context: CodebaseContext = {
      files: [],
      structure: ''
    };

    const generated = await this.plugins.testGenerator.generate(spec, context);

    const baseName = path.basename(specPath, '.md');
    const outputPath = path.join(this.config.generatedDir, `${baseName}.spec.ts`);

    fs.writeFileSync(outputPath, generated.code);
    return outputPath;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/orchestrator/handlers/run-command.test.ts`
Expected: PASS (all tests including new generation tests)

**Step 5: Commit**

```bash
git add src/orchestrator/handlers/run-command.ts src/orchestrator/handlers/run-command.test.ts
git commit -m "feat(orchestrator): add RunCommandHandler generation phase"
```

---

## Task 10: CLI Integration

**Files:**
- Modify: `src/cli.ts`
- Test: `src/cli.test.ts` (update existing)

**Step 1: Write tests for CLI integration**

```typescript
// Update src/cli.test.ts to add integration tests
describe('CLI - Orchestrator Integration', () => {
  it('should wire up generate command to GenerateCommandHandler', () => {
    const program = createCLI();
    const generateCommand = program.commands.find(cmd => cmd.name() === 'generate');

    expect(generateCommand).toBeDefined();
    expect(generateCommand?.description()).toContain('Generate test scripts');
  });

  it('should wire up run command to RunCommandHandler', () => {
    const program = createCLI();
    const runCommand = program.commands.find(cmd => cmd.name() === 'run');

    expect(runCommand).toBeDefined();
    expect(runCommand?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flags: '--all' }),
        expect.objectContaining({ flags: '--base <branch>' }),
        expect.objectContaining({ flags: '--fail-fast' })
      ])
    );
  });

  it('should wire up report command to ReportCommandHandler', () => {
    const program = createCLI();
    const reportCommand = program.commands.find(cmd => cmd.name() === 'report');

    expect(reportCommand).toBeDefined();
    expect(reportCommand?.options).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ flags: '--latest' })
      ])
    );
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/cli.test.ts`
Expected: FAIL (orchestrator integration not implemented)

**Step 3: Implement CLI integration**

```typescript
// Update src/cli.ts
import { Command } from 'commander';
import { loadConfig } from './config/loader';
import { PluginRegistry } from './orchestrator/services/plugin-registry';
import { ResultStore } from './orchestrator/services/result-store';
import { GenerateCommandHandler } from './orchestrator/handlers/generate-command';
import { RunCommandHandler } from './orchestrator/handlers/run-command';
import { ReportCommandHandler } from './orchestrator/handlers/report-command';

const packageJson = require('../package.json');
const version = packageJson.version;

export function createCLI(): Command {
  const program = new Command();

  program
    .name('visual-uat')
    .description('Visual acceptance testing CLI tool')
    .version(version);

  program
    .command('generate')
    .description('Generate test scripts from specifications')
    .action(async () => {
      try {
        const projectRoot = process.cwd();
        const config = await loadConfig(projectRoot);
        const registry = new PluginRegistry(config);
        const testGenerator = registry.loadPlugin('testGenerator');

        const handler = new GenerateCommandHandler(config, projectRoot);
        const exitCode = await handler.execute(testGenerator);
        process.exit(exitCode);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(2);
      }
    });

  program
    .command('run')
    .description('Run visual acceptance tests')
    .option('--all', 'Force run all tests (ignore change detection)')
    .option('--base <branch>', 'Base branch to compare against')
    .option('--fail-fast', 'Stop on first error')
    .action(async (options) => {
      try {
        const projectRoot = process.cwd();
        const config = await loadConfig(projectRoot);
        const registry = new PluginRegistry(config);
        const plugins = registry.loadAll();

        const handler = new RunCommandHandler(config, plugins, projectRoot);
        const exitCode = await handler.execute({
          all: options.all,
          baseBranch: options.base,
          failFast: options.failFast
        });
        process.exit(exitCode);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(2);
      }
    });

  program
    .command('report')
    .description('View test results')
    .option('--latest', 'Show latest run (default)')
    .argument('[runId]', 'Specific run ID to view')
    .action(async (runId, options) => {
      try {
        const projectRoot = process.cwd();
        const resultStore = new ResultStore(projectRoot);

        const handler = new ReportCommandHandler(resultStore);
        const exitCode = await handler.execute(runId ? parseInt(runId) : undefined);
        process.exit(exitCode);
      } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(2);
      }
    });

  return program;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/cli.test.ts`
Expected: PASS (all CLI tests including integration)

**Step 5: Run all tests to ensure nothing broke**

Run: `npm test`
Expected: All tests pass

**Step 6: Commit**

```bash
git add src/cli.ts src/cli.test.ts
git commit -m "feat(orchestrator): integrate handlers with CLI"
```

---

## Note for Remaining Implementation

The following components are intentionally deferred to future iterations:

1. **RunCommandHandler execution, evaluation, and report phases**: Complex workflow requiring worktree execution, screenshot capture, diff comparison, and LLM evaluation. Will be implemented in a separate iteration.

2. **Playwright helper utilities** (`screenshotCheckpoint()`): Requires coordination with generated test scripts and screenshot directory management.

3. **HTML reporter**: Interactive web interface for viewing test results with manual override capabilities.

4. **Integration tests**: End-to-end tests using a real test application.

The current implementation provides:
- ✅ Core orchestrator structure (types, services, handlers)
- ✅ Smart change detection (full/incremental/skip)
- ✅ Test generation workflow
- ✅ Console-based reporting
- ✅ CLI integration with all commands

This establishes the foundation for the remaining phases while following TDD principles and maintaining code quality.
