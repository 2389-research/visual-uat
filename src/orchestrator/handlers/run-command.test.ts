import { RunCommandHandler } from './run-command';
import { Config } from '../../types/config';
import { LoadedPlugins } from '../services/plugin-registry';
import * as fs from 'fs';

jest.mock('fs');

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
    const handler = new RunCommandHandler(
      config,
      mockPlugins,
      '/fake/project'
    );

    const scope = await handler.determineScope({ all: true });
    expect(scope).toBe('full');
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

    // Mock for SpecManifest constructor - it tries to read manifest.json
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);

    mockReaddirSync.mockReturnValue(['test1.md', 'test2.md'] as any);
    mockReadFileSync.mockReturnValue('Test content');
    mockWriteFileSync.mockReturnValue(undefined);

    mockPlugins.testGenerator.generate = jest.fn().mockResolvedValue({
      code: 'test code',
      language: 'typescript',
      checkpoints: ['checkpoint1']
    });

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Now set up mocks for the actual test run
    mockExistsSync.mockReturnValue(true);

    const results = await handler.generateTests('full');

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

    // Mock for SpecManifest constructor - it tries to read manifest.json
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);

    mockReaddirSync.mockReturnValue(['test1.md', 'test2.md'] as any);
    mockReadFileSync.mockReturnValue('Test content');
    mockWriteFileSync.mockReturnValue(undefined);

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

    const results = await handler.generateTests('full', { failFast: false });

    expect(mockPlugins.testGenerator.generate).toHaveBeenCalledTimes(2);
    expect(results.success).toHaveLength(1);
    expect(results.failed).toHaveLength(1);
  });

  it('should exit immediately on generation failure with fail-fast', async () => {
    const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;
    const mockReadFileSync = fs.readFileSync as jest.MockedFunction<typeof fs.readFileSync>;
    const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
    const mockMkdirSync = fs.mkdirSync as jest.MockedFunction<typeof fs.mkdirSync>;

    // Mock for SpecManifest constructor - it tries to read manifest.json
    mockExistsSync.mockReturnValue(false);
    mockMkdirSync.mockReturnValue(undefined);

    mockReaddirSync.mockReturnValue(['test1.md', 'test2.md'] as any);
    mockReadFileSync.mockReturnValue('Test content');

    mockPlugins.testGenerator.generate = jest.fn()
      .mockRejectedValueOnce(new Error('LLM timeout'));

    const handler = new RunCommandHandler(config, mockPlugins, '/fake/project');

    // Now set up mocks for the actual test run
    mockExistsSync.mockReturnValue(true);

    await expect(handler.generateTests('full', { failFast: true }))
      .rejects.toThrow('LLM timeout');
  });
});
