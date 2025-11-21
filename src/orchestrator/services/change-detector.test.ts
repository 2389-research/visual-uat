// src/orchestrator/services/change-detector.test.ts
import { ChangeDetector } from './change-detector';
import { Config } from '../../types/config';
import { SpecManifest } from '../../specs/manifest';
import { spawnSync } from 'child_process';
import * as fs from 'fs';

jest.mock('child_process');
jest.mock('fs');

const mockSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;
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
        targetRunner: '@visual-uat/web-runner',
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
      mockSpawnSync.mockReturnValueOnce({
        status: 1, // git diff returns exit code 1 (differences exist)
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        error: undefined
      } as any);

      const scope = detector.determineScope({ all: false });
      expect(scope).toBe('full');
    });

    it('should throw error when git command fails with non-1 exit code', () => {
      mockSpawnSync.mockReturnValueOnce({
        status: 128, // git error for invalid branch
        stdout: Buffer.from(''),
        stderr: Buffer.from('fatal: bad revision'),
        error: undefined
      } as any);

      expect(() => detector.determineScope({ all: false })).toThrow('fatal: bad revision');
    });

    it('should return "incremental" when specs changed but not codebase', () => {
      mockSpawnSync.mockReturnValueOnce({
        status: 0, // git diff returns 0 (no differences)
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        error: undefined
      } as any);

      jest.spyOn(manifest, 'detectChanges').mockReturnValue({
        new: ['tests/new-test.md'],
        modified: [],
        deleted: []
      });

      const scope = detector.determineScope({ all: false });
      expect(scope).toBe('incremental');
    });

    it('should return "skip" when nothing changed', () => {
      mockSpawnSync.mockReturnValueOnce({
        status: 0, // git diff returns 0 (no differences)
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        error: undefined
      } as any);

      jest.spyOn(manifest, 'detectChanges').mockReturnValue({
        new: [],
        modified: [],
        deleted: []
      });

      const scope = detector.determineScope({ all: false });
      expect(scope).toBe('skip');
    });

    it('should use custom base branch from options', () => {
      mockSpawnSync.mockReturnValueOnce({
        status: 0,
        stdout: Buffer.from(''),
        stderr: Buffer.from(''),
        error: undefined
      } as any);
      jest.spyOn(manifest, 'detectChanges').mockReturnValue({
        new: [],
        modified: [],
        deleted: []
      });

      detector.determineScope({ all: false, baseBranch: 'develop' });

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        expect.arrayContaining(['diff', '--quiet', 'develop..HEAD', '--', 'src/']),
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

    it('should include spec files that start with "readme" but are not README.md', () => {
      mockReaddirSync.mockReturnValueOnce(['readme-login-test.md', 'README-flows.md', 'README.md'] as any);

      const specs = detector.getSpecsToGenerate('full');
      expect(specs).toEqual(['tests/readme-login-test.md', 'tests/README-flows.md']);
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
