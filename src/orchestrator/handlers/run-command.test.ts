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
