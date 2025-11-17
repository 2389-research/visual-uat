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
