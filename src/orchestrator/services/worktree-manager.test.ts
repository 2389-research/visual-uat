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
    it('should create worktrees for base and current branches', async () => {
      mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as any);
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      mockExistsSync.mockReturnValue(true); // package.json exists

      const paths = await manager.createWorktrees('main', 'feature/test');

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', '.worktrees/base', 'main'],
        expect.any(Object)
      );
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['worktree', 'add', '.worktrees/current', 'feature/test'],
        expect.any(Object)
      );

      expect(paths.base).toContain('.worktrees/base');
      expect(paths.current).toContain('.worktrees/current');
    });

    it('should run npm install in each worktree', async () => {
      mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as any);
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      mockExistsSync.mockReturnValue(true);

      await manager.createWorktrees('main', 'feature/test');

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'npm',
        ['install'],
        expect.objectContaining({ cwd: expect.stringContaining('.worktrees/base') })
      );
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'npm',
        ['install'],
        expect.objectContaining({ cwd: expect.stringContaining('.worktrees/current') })
      );
    });

    it('should skip npm install if package.json does not exist', async () => {
      mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as any);
      const mockExistsSync = fs.existsSync as jest.MockedFunction<typeof fs.existsSync>;
      mockExistsSync.mockReturnValue(false);

      await manager.createWorktrees('main', 'feature/test');

      const npmInstallCalls = mockSpawnSync.mock.calls.filter(
        call => call[0] === 'npm'
      );
      expect(npmInstallCalls).toHaveLength(0);
    });

    it('should throw error if git worktree fails', async () => {
      mockSpawnSync.mockReturnValueOnce({
        status: 1,
        error: new Error('git worktree failed')
      } as any);

      await expect(manager.createWorktrees('main', 'feature/test'))
        .rejects.toThrow('Failed to create base worktree');
    });
  });

  describe('cleanup', () => {
    it('should remove worktrees', async () => {
      mockSpawnSync.mockReturnValue({ status: 0, error: undefined } as any);

      await manager.cleanup();

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['worktree', 'remove', '.worktrees/base'],
        expect.any(Object)
      );
      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['worktree', 'remove', '.worktrees/current'],
        expect.any(Object)
      );
    });

    it('should force remove if normal removal fails', async () => {
      mockSpawnSync
        .mockReturnValueOnce({ status: 1, error: undefined } as any) // First remove fails
        .mockReturnValueOnce({ status: 0, error: undefined } as any) // Force remove succeeds
        .mockReturnValue({ status: 0, error: undefined } as any); // Current worktree removes succeed

      await manager.cleanup();

      expect(mockSpawnSync).toHaveBeenCalledWith(
        'git',
        ['worktree', 'remove', '--force', '.worktrees/base'],
        expect.any(Object)
      );
    });
  });
});
