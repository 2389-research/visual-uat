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

    const mockRunTest = jest.fn().mockResolvedValue({
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
      baseResults: new Map(),
      currentResults: new Map(),
      runResult: null,
      keepWorktrees: false
    };

    const nextState = await (handler as any).handleExecuteBase(context);

    expect(nextState).toBe('EXECUTE_CURRENT');
    expect(context.baseResults.size).toBe(1);
  });

  it('should continue on base test error and set baselineAvailable flag', async () => {
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

    const mockRunTest = jest.fn().mockResolvedValue({
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
