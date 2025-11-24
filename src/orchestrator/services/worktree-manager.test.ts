// src/orchestrator/services/worktree-manager.test.ts
import { WorktreeManager } from './worktree-manager';
import { spawnSync } from 'child_process';
import * as fs from 'fs';

jest.mock('child_process');
jest.mock('fs');

const mockSpawnSync = spawnSync as jest.MockedFunction<typeof spawnSync>;

describe('WorktreeManager', () => {
  let manager: WorktreeManager;
  const projectRoot = '/fake/project';

  beforeEach(() => {
    manager = new WorktreeManager(projectRoot);
    jest.clearAllMocks();
  });

  describe('createWorktrees', () => {
    it('should create worktree for base branch and use working directory for current', async () => {
      mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as any);
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      mockExistsSync.mockReturnValue(true); // package.json exists

      const paths = await manager.createWorktrees('main');

      // Should only create base worktree
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', '.worktrees/base', 'main'],
        expect.any(Object)
      );

      // Should NOT create current worktree
      expect(mockSpawnSync).not.toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', '.worktrees/current', 'feature/test'],
        expect.any(Object)
      );

      expect(paths.base).toContain('.worktrees/base');
      expect(paths.current).toBe(projectRoot); // Uses working directory
    });

    it('should run npm install in base worktree only', async () => {
      mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as any);
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      mockExistsSync.mockReturnValue(true);

      await manager.createWorktrees('main');

      // Should run npm install in base worktree
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'npm',
        ['install'],
        expect.objectContaining({ cwd: expect.stringContaining('.worktrees/base') })
      );

      // Should NOT run npm install in current (uses working directory with existing deps)
      const npmCalls = mockSpawnSync.mock.calls.filter(call => call[0] === 'npm');
      expect(npmCalls).toHaveLength(1); // Only one npm install call
    });

    it('should skip npm install if package.json does not exist', async () => {
      mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as any);
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      mockExistsSync.mockReturnValue(false);

      await manager.createWorktrees('main');

      const npmInstallCalls = mockSpawnSync.mock.calls.filter(
        call => call[0] === 'npm'
      );
      expect(npmInstallCalls).toHaveLength(0);
    });

    it('should reuse existing checkout if base branch is already checked out', async () => {
      const existingPath = '/fake/project/main-working-tree';
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      mockExistsSync.mockReturnValue(true);

      mockSpawnSync
        .mockReturnValueOnce({
          status: 1,
          stderr: Buffer.from(`fatal: 'main' is already used by worktree at '${existingPath}'`),
          error: undefined
        } as any) // git worktree add - fails with "already used"
        .mockReturnValueOnce({ status: 0, error: undefined } as any); // npm install - succeeds

      const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

      const paths = await manager.createWorktrees('main');

      expect(paths.base).toBe(existingPath);
      expect(paths.current).toBe(projectRoot);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Base branch 'main' already checked out at ${existingPath}`)
      );

      consoleLogSpy.mockRestore();
    });

    it('should throw error if git worktree fails for other reasons', async () => {
      mockSpawnSync.mockReturnValueOnce({
        status: 1,
        stderr: Buffer.from('fatal: some other git error'),
        error: new Error('git worktree failed')
      } as any);

      await expect(manager.createWorktrees('main'))
        .rejects.toThrow('Failed to create base worktree');
    });

    it('should throw error if npm install fails in base worktree', async () => {
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      mockExistsSync.mockReturnValue(true);

      mockSpawnSync
        .mockReturnValueOnce({ status: 0, error: undefined } as any) // git worktree add base - success
        .mockReturnValueOnce({ status: 1, error: undefined } as any); // npm install base - fail

      await expect(manager.createWorktrees('main'))
        .rejects.toThrow('npm install failed in base worktree');
    });
  });

  describe('cleanup', () => {
    it('should remove base worktree only', () => {
      mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as any);

      manager.cleanup();

      // Should remove base worktree
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['worktree', 'remove', '.worktrees/base'],
        expect.any(Object)
      );

      // Should NOT remove current worktree (uses working directory)
      expect(mockSpawnSync).not.toHaveBeenCalledWith(
        'git',
        ['worktree', 'remove', '.worktrees/current'],
        expect.any(Object)
      );
    });

    it('should force remove if normal removal fails', () => {
      mockSpawnSync
        .mockReturnValueOnce({ status: 1, error: undefined } as any) // First remove fails
        .mockReturnValueOnce({ status: 0, error: undefined } as any); // Force remove succeeds

      manager.cleanup();

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['worktree', 'remove', '--force', '.worktrees/base'],
        expect.any(Object)
      );
    });
  });
});
