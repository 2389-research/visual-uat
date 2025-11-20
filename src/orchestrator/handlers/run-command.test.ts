import { RunCommandHandler } from './run-command';
import { Config } from '../../types/config';
import { LoadedPlugins } from '../services/plugin-registry';
import { ExecutionContext } from './execution-states';
import { WorktreeManager } from '../services/worktree-manager';
import { TestRunner } from '../services/test-runner';
import * as fs from 'fs';
import * as child_process from 'child_process';

jest.mock('fs');
jest.mock('../services/worktree-manager');
jest.mock('../services/test-runner');
jest.mock('child_process');

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
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    mockPlugins = {
      testGenerator: { generate: jest.fn() } as any,
      targetRunner: { start: jest.fn(), stop: jest.fn(), isReady: jest.fn() } as any,
      differ: { compare: jest.fn() } as any,
      evaluator: { evaluate: jest.fn() } as any,
      terminalReporter: { generate: jest.fn() } as any,
      htmlReporter: { generate: jest.fn() } as any
    };

    // Mock fs for SpecManifest
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);

    jest.clearAllMocks();
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
    const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
    mockReaddirSync.mockReturnValue(['test1.md'] as any);

    const handler = new RunCommandHandler(
      config,
      mockPlugins,
      '/fake/project'
    );

    const scope = await handler.determineScope({ all: true });
    expect(scope.type).toBe('full');
    expect(scope.baseBranch).toBe('main');
    expect(scope.specsToGenerate).toBeDefined();
  });
});

describe('RunCommandHandler - Generation Phase', () => {
  let config: Config;
  let mockPlugins: LoadedPlugins;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    mockPlugins = {
      testGenerator: { generate: jest.fn() } as any,
      targetRunner: { start: jest.fn(), stop: jest.fn(), isReady: jest.fn() } as any,
      differ: { compare: jest.fn() } as any,
      evaluator: { evaluate: jest.fn() } as any,
      terminalReporter: { generate: jest.fn() } as any,
      htmlReporter: { generate: jest.fn() } as any
    };

    jest.clearAllMocks();
  });

  it('should generate tests for all specs in full mode', async () => {
    const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
    const mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockStatSync = fs.statSync as jest.MockedFunction<typeof fs.statSync>;

    // Mock for SpecManifest constructor - it tries to read manifest.json
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);

    mockReaddirSync.mockReturnValue(['test1.md', 'test2.md'] as any);
    // Smart mock: return JSON for manifest.json, 'Test content' for spec files
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });
    mockWriteFileSync.mockReturnValue(undefined);
    mockStatSync.mockReturnValue({ mtimeMs: 123456789 } as any);

    mockPlugins.testGenerator.generate = jest.fn().mockResolvedValue({
      code: 'test code',
      language: 'typescript',
      checkpoints: ['checkpoint1']
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Now set up mocks for the actual test run
    mockExistsSync.mockReturnValue(true);

    const scope = {
      type: 'full' as const,
      baseBranch: 'main',
      specsToGenerate: ['./tests/test1.md', './tests/test2.md']
    };
    const results = await handler.generateTests(scope);

    expect(mockPlugins.testGenerator.generate).toHaveBeenCalledTimes(2);
    expect(results.success).toHaveLength(2);
    expect(results.failed).toHaveLength(0);
  });

  it('should continue on generation failure when not fail-fast', async () => {
    const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
    const mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockStatSync = fs.statSync as jest.MockedFunction<typeof fs.statSync>;

    // Mock for SpecManifest constructor - it tries to read manifest.json
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);

    mockReaddirSync.mockReturnValue(['test1.md', 'test2.md'] as any);
    // Smart mock: return JSON for manifest.json, 'Test content' for spec files
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });
    mockWriteFileSync.mockReturnValue(undefined);
    mockStatSync.mockReturnValue({ mtimeMs: 123456789 } as any);

    mockPlugins.testGenerator.generate = jest.fn()
      .mockRejectedValueOnce(new Error('LLM timeout'))
      .mockResolvedValueOnce({
        code: 'test code',
        language: 'typescript',
        checkpoints: ['checkpoint1']
      });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Now set up mocks for the actual test run
    mockExistsSync.mockReturnValue(true);

    const scope = {
      type: 'full' as const,
      baseBranch: 'main',
      specsToGenerate: ['./tests/test1.md', './tests/test2.md']
    };
    const results = await handler.generateTests(scope, { failFast: false });

    expect(mockPlugins.testGenerator.generate).toHaveBeenCalledTimes(2);
    expect(results.success).toHaveLength(1);
    expect(results.failed).toHaveLength(1);
  });

  it('should exit immediately on generation failure with fail-fast', async () => {
    const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockStatSync = fs.statSync as jest.MockedFunction<typeof fs.statSync>;

    // Mock for SpecManifest constructor - it tries to read manifest.json
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);

    mockReaddirSync.mockReturnValue(['test1.md', 'test2.md'] as any);
    // Smart mock: return JSON for manifest.json, 'Test content' for spec files
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });
    mockStatSync.mockReturnValue({ mtimeMs: 123456789 } as any);

    mockPlugins.testGenerator.generate = jest.fn()
      .mockRejectedValueOnce(new Error('LLM timeout'));

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Now set up mocks for the actual test run
    mockExistsSync.mockReturnValue(true);

    const scope = {
      type: 'full' as const,
      baseBranch: 'main',
      specsToGenerate: ['./tests/test1.md', './tests/test2.md']
    };
    await expect(handler.generateTests(scope, { failFast: true }))
      .rejects.toThrow('LLM timeout');
  });
});

describe('RunCommandHandler.handleSetup', () => {
  let config: Config;
  let mockPlugins: LoadedPlugins;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    mockPlugins = {
      testGenerator: { generate: jest.fn() } as any,
      targetRunner: { start: jest.fn(), stop: jest.fn(), isReady: jest.fn() } as any,
      differ: { compare: jest.fn() } as any,
      evaluator: { evaluate: jest.fn() } as any,
      terminalReporter: { generate: jest.fn() } as any,
      htmlReporter: { generate: jest.fn() } as any
    };

    jest.clearAllMocks();
  });

  it('should transition to EXECUTE_BASE on success', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
    const mockWriteFileSync = fs.writeFileSync as jest.MockedFunction<typeof fs.writeFileSync>;
    const mockStatSync = fs.statSync as jest.MockedFunction<typeof fs.statSync>;
    const mockExecSync = child_process.execSync as jest.MockedFunction<typeof child_process.execSync>;
    const mockSpawnSync = child_process.spawnSync as jest.MockedFunction<typeof child_process.spawnSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });
    mockWriteFileSync.mockReturnValue(undefined);

    // Mock for change detector
    mockReaddirSync.mockReturnValue(['test1.md'] as any);
    mockStatSync.mockReturnValue({ mtimeMs: 123456789 } as any);

    // Mock for git diff (used by ChangeDetector)
    mockSpawnSync.mockReturnValue({
      status: 0,
      stdout: '',
      stderr: '',
      error: undefined
    } as any);

    // Mock for git branch --show-current
    mockExecSync.mockReturnValue('feature/test-branch' as any);

    // Mock WorktreeManager
    const mockCreateWorktrees = jest.fn().mockResolvedValue({
      base: '/fake/project/.worktrees/base',
      current: '/fake/project/.worktrees/current'
    });
    (WorktreeManager as jest.Mock).mockImplementation(() => ({
      createWorktrees: mockCreateWorktrees
    }));

    // Mock test generator
    mockPlugins.testGenerator.generate = jest.fn().mockResolvedValue({
      code: 'test code',
      language: 'typescript',
      checkpoints: ['checkpoint1']
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Set up mocks for the actual test run
    mockExistsSync.mockReturnValue(true);

    // We need to access the private method for testing
    const context: ExecutionContext = {
      scope: null,
      worktrees: null,
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleSetup(context, { force: true });

    expect(nextState).toBe('EXECUTE_BASE');
    expect(context.worktrees).not.toBeNull();
    expect(mockCreateWorktrees).toHaveBeenCalled();
  });
});

describe('RunCommandHandler.handleExecuteBase', () => {
  let config: Config;
  let mockPlugins: LoadedPlugins;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    mockPlugins = {
      testGenerator: { generate: jest.fn() } as any,
      targetRunner: { start: jest.fn(), stop: jest.fn(), isReady: jest.fn() } as any,
      differ: { compare: jest.fn() } as any,
      evaluator: { evaluate: jest.fn() } as any,
      terminalReporter: { generate: jest.fn() } as any,
      htmlReporter: { generate: jest.fn() } as any
    };

    jest.clearAllMocks();
  });

  it('should run tests in base worktree and transition to EXECUTE_CURRENT', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const mockRunTest = jest.fn().mockReturnValue({
      testPath: 'tests/generated/login.spec.ts',
      status: 'passed',
      duration: 1500,
      screenshots: ['initial.png']
    });

    // Mock TestRunner
    (TestRunner as jest.Mock).mockImplementation(() => ({
      runTest: mockRunTest
    }));

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    const context: ExecutionContext = {
      scope: {
        type: 'full',
        baseBranch: 'main',
        specsToGenerate: ['tests/login.md']
      },
      worktrees: {
        base: '/worktrees/base',
        current: '/worktrees/current'
      },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleExecuteBase(context);

    expect(nextState).toBe('EXECUTE_CURRENT');
    expect(context.baseResults.size).toBe(1);
  });

  it('should continue execution and store result when base test errors', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const mockRunTest = jest.fn().mockReturnValue({
      testPath: 'tests/generated/broken.spec.ts',
      status: 'errored',
      duration: 0,
      screenshots: [],
      error: 'Test crashed'
    });

    // Mock TestRunner
    (TestRunner as jest.Mock).mockImplementation(() => ({
      runTest: mockRunTest
    }));

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    const context: ExecutionContext = {
      scope: {
        type: 'full',
        baseBranch: 'main',
        specsToGenerate: ['tests/broken.md']
      },
      worktrees: {
        base: '/worktrees/base',
        current: '/worktrees/current'
      },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleExecuteBase(context);

    expect(nextState).toBe('EXECUTE_CURRENT');
    expect(context.baseResults.get('tests/broken.md')?.status).toBe('errored');
  });
});

describe('RunCommandHandler.handleExecuteCurrent', () => {
  let config: Config;
  let mockPlugins: LoadedPlugins;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    mockPlugins = {
      testGenerator: { generate: jest.fn() } as any,
      targetRunner: { start: jest.fn(), stop: jest.fn(), isReady: jest.fn() } as any,
      differ: { compare: jest.fn() } as any,
      evaluator: { evaluate: jest.fn() } as any,
      terminalReporter: { generate: jest.fn() } as any,
      htmlReporter: { generate: jest.fn() } as any
    };

    jest.clearAllMocks();
  });

  it('should run tests in current worktree and transition to COMPARE_AND_EVALUATE', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const mockRunTest = jest.fn().mockReturnValue({
      testPath: 'tests/generated/login.spec.ts',
      status: 'passed',
      duration: 1500,
      screenshots: ['initial.png', 'after-login.png']
    });

    // Mock TestRunner
    (TestRunner as jest.Mock).mockImplementation(() => ({
      runTest: mockRunTest
    }));

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    const context: ExecutionContext = {
      scope: {
        type: 'full',
        baseBranch: 'main',
        specsToGenerate: ['tests/login.md']
      },
      worktrees: {
        base: '/worktrees/base',
        current: '/worktrees/current'
      },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
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

    const nextState = await (handler as any).handleExecuteCurrent(context);

    expect(nextState).toBe('COMPARE_AND_EVALUATE');
    expect(context.currentResults.size).toBe(1);
  });

  it('should continue execution and store result when current test errors', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const mockRunTest = jest.fn().mockReturnValue({
      testPath: 'tests/generated/broken.spec.ts',
      status: 'errored',
      duration: 0,
      screenshots: [],
      error: 'Test crashed'
    });

    // Mock TestRunner
    (TestRunner as jest.Mock).mockImplementation(() => ({
      runTest: mockRunTest
    }));

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    const context: ExecutionContext = {
      scope: {
        type: 'full',
        baseBranch: 'main',
        specsToGenerate: ['tests/broken.md']
      },
      worktrees: {
        base: '/worktrees/base',
        current: '/worktrees/current'
      },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map([
        ['tests/broken.md', {
          testPath: 'tests/generated/broken.spec.ts',
          status: 'passed',
          duration: 1400,
          screenshots: ['initial.png']
        }]
      ]),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleExecuteCurrent(context);

    expect(nextState).toBe('COMPARE_AND_EVALUATE');
    expect(context.currentResults.get('tests/broken.md')?.status).toBe('errored');
  });
});

describe('RunCommandHandler.handleCompareAndEvaluate', () => {
  let config: Config;
  let mockPlugins: LoadedPlugins;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    mockPlugins = {
      testGenerator: { generate: jest.fn() } as any,
      targetRunner: { start: jest.fn(), stop: jest.fn(), isReady: jest.fn() } as any,
      differ: { compare: jest.fn() } as any,
      evaluator: { evaluate: jest.fn() } as any,
      terminalReporter: { generate: jest.fn() } as any,
      htmlReporter: { generate: jest.fn() } as any
    };

    jest.clearAllMocks();
  });

  it('should skip evaluation if no pixel differences', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
    const mockExecSync = child_process.execSync as jest.MockedFunction<typeof child_process.execSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test spec content';
    });

    // Mock for git branch --show-current
    mockExecSync.mockReturnValue('feature/test-branch' as any);

    const mockCompare = jest.fn().mockResolvedValue({
      diffImage: Buffer.from(''),
      pixelDiffPercent: 0,
      changedRegions: [],
      identical: true
    });

    mockPlugins.differ.compare = mockCompare;

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: ['tests/login.md'] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
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

    const nextState = await (handler as any).handleCompareAndEvaluate(context);

    expect(nextState).toBe('STORE_RESULTS');
    expect(mockCompare).toHaveBeenCalled();
    // Evaluator should NOT be called for 0% diff
    expect(mockPlugins.evaluator.evaluate).not.toHaveBeenCalled();
    expect(context.runResult).not.toBeNull();
    expect(context.runResult?.tests[0].status).toBe('passed');
  });

  it('should evaluate differences when pixels changed', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
    const mockExecSync = child_process.execSync as jest.MockedFunction<typeof child_process.execSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test spec content';
    });

    // Mock for git branch --show-current
    mockExecSync.mockReturnValue('feature/test-branch' as any);

    const mockCompare = jest.fn().mockResolvedValue({
      diffImage: Buffer.from('mock-diff-image'),
      pixelDiffPercent: 2.5,
      changedRegions: [{ x: 10, y: 20, width: 100, height: 50 }],
      identical: false
    });
    const mockEvaluate = jest.fn().mockResolvedValue({
      pass: true,
      confidence: 0.95,
      reason: 'Expected button color change',
      needsReview: false
    });

    mockPlugins.differ.compare = mockCompare;
    mockPlugins.evaluator.evaluate = mockEvaluate;

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: ['tests/login.md'] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
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

    const nextState = await (handler as any).handleCompareAndEvaluate(context);

    expect(nextState).toBe('STORE_RESULTS');
    expect(mockEvaluate).toHaveBeenCalled();
    expect(context.runResult).not.toBeNull();
    expect(context.runResult?.tests[0].status).toBe('passed');
  });

  it('should handle missing baseline gracefully', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
    const mockExecSync = child_process.execSync as jest.MockedFunction<typeof child_process.execSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test spec content';
    });

    // Mock for git branch --show-current
    mockExecSync.mockReturnValue('feature/test-branch' as any);

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: ['tests/broken.md'] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
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

    const nextState = await (handler as any).handleCompareAndEvaluate(context);

    expect(nextState).toBe('STORE_RESULTS');
    expect(context.runResult).not.toBeNull();
    // Should create TestResult with baselineAvailable: false
    expect(context.runResult?.tests[0].status).toBe('errored');
    expect(context.runResult?.tests[0].error).toContain('No baseline available');
  });
});

describe('RunCommandHandler.handleStoreResults', () => {
  let config: Config;
  let mockPlugins: LoadedPlugins;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    mockPlugins = {
      testGenerator: { generate: jest.fn() } as any,
      targetRunner: { start: jest.fn(), stop: jest.fn(), isReady: jest.fn() } as any,
      differ: { compare: jest.fn() } as any,
      evaluator: { evaluate: jest.fn() } as any,
      terminalReporter: { generate: jest.fn() } as any,
      htmlReporter: { generate: jest.fn() } as any
    };

    jest.clearAllMocks();
  });

  it('should save results and transition to CLEANUP', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Mock the resultStore
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'testrun',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockSave).toHaveBeenCalledWith(context.runResult);
  });

  it('should generate runId when empty and save results', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Mock the resultStore
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: '',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(context.runResult!.runId).not.toBe('');
    expect(context.runResult!.runId).toHaveLength(7);
    expect(mockSave).toHaveBeenCalledWith(context.runResult);
  });

  it('should call terminal reporter and HTML reporter after storing results', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Mock the resultStore
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test123',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockPlugins.terminalReporter.generate).toHaveBeenCalledWith(
      context.runResult,
      expect.objectContaining({
        verbosity: 'normal',
        outputDir: '/fake/project/.visual-uat/reports',
        autoOpen: false
      })
    );
    expect(mockPlugins.htmlReporter.generate).toHaveBeenCalledWith(
      context.runResult,
      expect.objectContaining({
        verbosity: 'normal',
        outputDir: '/fake/project/.visual-uat/reports',
        autoOpen: false
      })
    );
  });

  it('should not fail run when reporter throws error', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Mock the resultStore
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    // Make terminal reporter fail
    mockPlugins.terminalReporter.generate = jest.fn().mockRejectedValue(new Error('Reporter crashed'));
    mockPlugins.htmlReporter.generate = jest.fn().mockResolvedValue(undefined);

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test456',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockPlugins.terminalReporter.generate).toHaveBeenCalled();
    expect(mockPlugins.htmlReporter.generate).toHaveBeenCalled();
  });

  it('should use quiet verbosity when quiet option is set', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Store runOptions with quiet flag
    (handler as any).runOptions = { quiet: true };

    // Mock the resultStore
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test123',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockPlugins.terminalReporter.generate).toHaveBeenCalledWith(
      context.runResult,
      expect.objectContaining({
        verbosity: 'quiet'
      })
    );
  });

  it('should use verbose verbosity when verbose option is set', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Store runOptions with verbose flag
    (handler as any).runOptions = { verbose: true };

    // Mock the resultStore
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test789',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockPlugins.terminalReporter.generate).toHaveBeenCalledWith(
      context.runResult,
      expect.objectContaining({
        verbosity: 'verbose'
      })
    );
  });

  it('should skip HTML reporter when noHtml flag is set', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Store runOptions with noHtml flag
    (handler as any).runOptions = { noHtml: true };

    // Mock the resultStore
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test999',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockPlugins.terminalReporter.generate).toHaveBeenCalled();
    expect(mockPlugins.htmlReporter.generate).not.toHaveBeenCalled();
  });

  it('should set autoOpen to true when open flag is set', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Store runOptions with open flag
    (handler as any).runOptions = { open: true };

    // Mock the resultStore
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test888',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockPlugins.terminalReporter.generate).toHaveBeenCalledWith(
      context.runResult,
      expect.objectContaining({
        autoOpen: true
      })
    );
    expect(mockPlugins.htmlReporter.generate).toHaveBeenCalledWith(
      context.runResult,
      expect.objectContaining({
        autoOpen: true
      })
    );
  });

  it('should warn when both quiet and verbose flags are set', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Store runOptions with both conflicting flags
    (handler as any).runOptions = { quiet: true, verbose: true };

    // Mock the resultStore
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    // Spy on console.warn
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test777',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(consoleWarnSpy).toHaveBeenCalledWith('Warning: Both --quiet and --verbose flags specified. Using --quiet.');
    expect(mockPlugins.terminalReporter.generate).toHaveBeenCalledWith(
      context.runResult,
      expect.objectContaining({
        verbosity: 'quiet'
      })
    );

    consoleWarnSpy.mockRestore();
  });
});

describe('RunCommandHandler.handleStoreResults - Reporter Config', () => {
  let mockPlugins: LoadedPlugins;

  beforeEach(() => {
    mockPlugins = {
      testGenerator: { generate: jest.fn() } as any,
      targetRunner: { start: jest.fn(), stop: jest.fn(), isReady: jest.fn() } as any,
      differ: { compare: jest.fn() } as any,
      evaluator: { evaluate: jest.fn() } as any,
      terminalReporter: { generate: jest.fn() } as any,
      htmlReporter: { generate: jest.fn() } as any
    };

    jest.clearAllMocks();
  });

  it('should skip terminal reporter when config.reporters.terminal.enabled is false', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const config: Config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      },
      targetRunner: {},
      evaluator: {},
      reporters: {
        terminal: {
          enabled: false
        }
      }
    } as Config;

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test123',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockPlugins.terminalReporter.generate).not.toHaveBeenCalled();
    expect(mockPlugins.htmlReporter.generate).toHaveBeenCalled();
  });

  it('should skip HTML reporter when config.reporters.html.enabled is false', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const config: Config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      },
      targetRunner: {},
      evaluator: {},
      reporters: {
        html: {
          enabled: false
        }
      }
    } as Config;

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test456',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockPlugins.terminalReporter.generate).toHaveBeenCalled();
    expect(mockPlugins.htmlReporter.generate).not.toHaveBeenCalled();
  });

  it('should use config.reporters.terminal.defaultVerbosity when no CLI flag provided', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const config: Config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      },
      targetRunner: {},
      evaluator: {},
      reporters: {
        terminal: {
          defaultVerbosity: 'verbose'
        }
      }
    } as Config;

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test789',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockPlugins.terminalReporter.generate).toHaveBeenCalledWith(
      context.runResult,
      expect.objectContaining({
        verbosity: 'verbose'
      })
    );
  });

  it('should override config verbosity with CLI flag', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const config: Config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      },
      targetRunner: {},
      evaluator: {},
      reporters: {
        terminal: {
          defaultVerbosity: 'verbose'
        }
      }
    } as Config;

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');
    (handler as any).runOptions = { quiet: true };
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test999',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockPlugins.terminalReporter.generate).toHaveBeenCalledWith(
      context.runResult,
      expect.objectContaining({
        verbosity: 'quiet'
      })
    );
  });

  it('should use CLI --no-html flag to override config.reporters.html.enabled', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const config: Config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      },
      targetRunner: {},
      evaluator: {},
      reporters: {
        html: {
          enabled: true
        }
      }
    } as Config;

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');
    (handler as any).runOptions = { noHtml: true };
    const mockSave = jest.fn().mockResolvedValue(undefined);
    (handler as any).resultStore = { saveRunResult: mockSave };

    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: {
        runId: 'test111',
        timestamp: 1234567890,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: config,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      },
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleStoreResults(context);

    expect(nextState).toBe('CLEANUP');
    expect(mockPlugins.htmlReporter.generate).not.toHaveBeenCalled();
  });
});

describe('RunCommandHandler.handleCleanup', () => {
  let config: Config;
  let mockPlugins: LoadedPlugins;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    mockPlugins = {
      testGenerator: { generate: jest.fn() } as any,
      targetRunner: { start: jest.fn(), stop: jest.fn(), isReady: jest.fn() } as any,
      differ: { compare: jest.fn() } as any,
      evaluator: { evaluate: jest.fn() } as any,
      terminalReporter: { generate: jest.fn() } as any,
      htmlReporter: { generate: jest.fn() } as any
    };

    jest.clearAllMocks();
  });

  it('should cleanup worktrees and transition to COMPLETE', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const mockCleanup = jest.fn();
    (WorktreeManager as jest.Mock).mockImplementation(() => ({
      cleanup: mockCleanup
    }));

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');
    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleCleanup(context);

    expect(nextState).toBe('COMPLETE');
    expect(mockCleanup).toHaveBeenCalled();
  });

  it('should skip cleanup if keepWorktrees flag set', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const mockCleanup = jest.fn();
    (WorktreeManager as jest.Mock).mockImplementation(() => ({
      cleanup: mockCleanup
    }));

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');
    const context: ExecutionContext = {
      scope: { type: 'full', baseBranch: 'main', specsToGenerate: [] },
      worktrees: { base: '/base', current: '/current' },
      serverManager: { cleanup: jest.fn(), startServer: jest.fn() } as any,
      baseUrl: "http://localhost:34567",
      currentUrl: "http://localhost:34568",
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: true
    };

    const nextState = await (handler as any).handleCleanup(context);

    expect(nextState).toBe('COMPLETE');
    expect(mockCleanup).not.toHaveBeenCalled();
  });
});

describe('RunCommandHandler.execute', () => {
  let config: Config;
  let mockPlugins: LoadedPlugins;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/pixelmatch-differ',
        evaluator: '@visual-uat/claude-evaluator'
      }
    } as Config;

    mockPlugins = {
      testGenerator: { generate: jest.fn() } as any,
      targetRunner: { start: jest.fn(), stop: jest.fn(), isReady: jest.fn() } as any,
      differ: { compare: jest.fn() } as any,
      evaluator: { evaluate: jest.fn() } as any,
      terminalReporter: { generate: jest.fn() } as any,
      htmlReporter: { generate: jest.fn() } as any
    };

    jest.clearAllMocks();
  });

  it('should run through all states and return 0 on success', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Mock all state handlers
    (handler as any).handleSetup = jest.fn().mockResolvedValue('EXECUTE_BASE');
    (handler as any).handleExecuteBase = jest.fn().mockResolvedValue('EXECUTE_CURRENT');
    (handler as any).handleExecuteCurrent = jest.fn().mockResolvedValue('COMPARE_AND_EVALUATE');
    (handler as any).handleCompareAndEvaluate = jest.fn().mockResolvedValue('STORE_RESULTS');
    (handler as any).handleStoreResults = jest.fn().mockResolvedValue('CLEANUP');
    (handler as any).handleCleanup = jest.fn().mockResolvedValue('COMPLETE');

    const exitCode = await handler.execute({ all: true });

    expect(exitCode).toBe(0);
    expect((handler as any).handleSetup).toHaveBeenCalled();
    expect((handler as any).handleExecuteBase).toHaveBeenCalled();
    expect((handler as any).handleExecuteCurrent).toHaveBeenCalled();
    expect((handler as any).handleCompareAndEvaluate).toHaveBeenCalled();
    expect((handler as any).handleStoreResults).toHaveBeenCalled();
    expect((handler as any).handleCleanup).toHaveBeenCalled();
  });

  it('should return 1 on FAILED state', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    (handler as any).handleSetup = jest.fn().mockResolvedValue('FAILED');

    const exitCode = await handler.execute({ all: true });

    expect(exitCode).toBe(1);
  });

  it('should cleanup worktrees on error', async () => {
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;

    // Mock for SpecManifest constructor
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);
    mockReadFileSync.mockImplementation((path: any) => {
      if (path.includes('manifest.json')) {
        return '{}';
      }
      return 'Test content';
    });

    const mockCleanup = jest.fn();
    (WorktreeManager as jest.Mock).mockImplementation(() => ({
      cleanup: mockCleanup
    }));

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Mock handleSetup to succeed and set worktrees in context
    (handler as any).handleSetup = jest.fn().mockImplementation(async (context: any) => {
      context.worktrees = { base: '/worktrees/base', current: '/worktrees/current' };
      return 'EXECUTE_BASE';
    });
    // Mock handleExecuteBase to throw an error after worktrees are created
    (handler as any).handleExecuteBase = jest.fn().mockRejectedValue(new Error('Execution crashed'));

    const exitCode = await handler.execute({ all: true });

    expect(exitCode).toBe(1);
    expect(mockCleanup).toHaveBeenCalled();
  });
});
