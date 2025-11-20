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
        targetRunner: '@visual-uat/web-runner',
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

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const handler = new GenerateCommandHandler(config, '/fake/project');
      const exitCode = await handler.execute(mockGenerator);

      expect(mockGenerator.generate).toHaveBeenCalledTimes(2);
      expect(mockWriteFileSync).toHaveBeenCalledTimes(2);
      expect(exitCode).toBe(0);

      consoleLogSpy.mockRestore();
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

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      const handler = new GenerateCommandHandler(config, '/fake/project');
      const exitCode = await handler.execute(mockGenerator);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('LLM timeout')
      );
      expect(mockGenerator.generate).toHaveBeenCalledTimes(2);
      expect(exitCode).toBe(0);

      consoleLogSpy.mockRestore();
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

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const handler = new GenerateCommandHandler(config, '/fake/project');
      await handler.execute(mockGenerator);

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('tests/generated'),
        { recursive: true }
      );

      consoleLogSpy.mockRestore();
    });
  });
});
