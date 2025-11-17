// src/orchestrator/services/change-detector.test.ts
import { ChangeDetector } from './change-detector';
import { Config } from '../../types/config';
import { SpecManifest } from '../../specs/manifest';
import { execSync } from 'child_process';
import * as fs from 'fs';

jest.mock('child_process');
jest.mock('fs');

const mockExecSync = execSync as jest.MockedFunction<typeof execSync>;
const mockReaddirSync = fs.readdirSync as jest.MockedFunction<typeof fs.readdirSync>;

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

    // Default mock for readdirSync
    mockReaddirSync.mockReturnValue(['test1.md', 'test2.md'] as any);
  });

  describe('determineScope', () => {
    it('should return "full" when --all flag is set', () => {
      const scope = detector.determineScope({ all: true });
      expect(scope).toBe('full');
    });

    it('should return "full" when codebase changed', () => {
      const error: any = new Error('exit code 1');
      error.status = 1;
      mockExecSync.mockImplementationOnce(() => {
        throw error; // git diff returns exit code 1 (differences exist)
      });

      const scope = detector.determineScope({ all: false });
      expect(scope).toBe('full');
    });

    it('should throw error when git command fails with non-1 exit code', () => {
      const error: any = new Error('fatal: bad revision');
      error.status = 128; // git error for invalid branch
      mockExecSync.mockImplementationOnce(() => {
        throw error;
      });

      expect(() => detector.determineScope({ all: false })).toThrow('fatal: bad revision');
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
    it('should return all specs for full run, excluding README files', () => {
      mockReaddirSync.mockReturnValueOnce(['test1.md', 'test2.md', 'README.md', 'readme.md'] as any);

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
