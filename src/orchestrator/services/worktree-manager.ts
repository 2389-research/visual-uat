// ABOUTME: Manages git worktrees for isolated branch testing, creating and cleaning up worktrees.
// ABOUTME: Handles dependency installation (npm install) in each worktree.

import { spawnSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface WorktreePaths {
  base: string;
  current: string;
}

export class WorktreeManager {
  constructor(private projectRoot: string) {}

  async createWorktrees(baseBranch: string, currentBranch: string): Promise<WorktreePaths> {
    const basePath = path.join(this.projectRoot, '.worktrees/base');
    const currentPath = path.join(this.projectRoot, '.worktrees/current');

    // Create worktrees - using spawnSync with array args prevents shell injection
    const baseResult = spawnSync('git', ['worktree', 'add', '.worktrees/base', baseBranch], {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    if (baseResult.error || baseResult.status !== 0) {
      throw new Error(`Failed to create base worktree: ${baseResult.error?.message || 'git command failed'}`);
    }

    const currentResult = spawnSync('git', ['worktree', 'add', '.worktrees/current', currentBranch], {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    if (currentResult.error || currentResult.status !== 0) {
      throw new Error(`Failed to create current worktree: ${currentResult.error?.message || 'git command failed'}`);
    }

    // Install dependencies if package.json exists
    if (fs.existsSync(path.join(basePath, 'package.json'))) {
      const baseNpmResult = spawnSync('npm', ['install'], { cwd: basePath, stdio: 'inherit' });
      if (baseNpmResult.error || baseNpmResult.status !== 0) {
        throw new Error(
          `npm install failed in base worktree (${basePath}): ` +
          `exit code ${baseNpmResult.status}, error: ${baseNpmResult.error?.message || 'none'}`
        );
      }
    }

    if (fs.existsSync(path.join(currentPath, 'package.json'))) {
      const currentNpmResult = spawnSync('npm', ['install'], { cwd: currentPath, stdio: 'inherit' });
      if (currentNpmResult.error || currentNpmResult.status !== 0) {
        throw new Error(
          `npm install failed in current worktree (${currentPath}): ` +
          `exit code ${currentNpmResult.status}, error: ${currentNpmResult.error?.message || 'none'}`
        );
      }
    }

    return {
      base: basePath,
      current: currentPath
    };
  }

  async cleanup(): Promise<void> {
    // Try to remove base worktree, force if it fails
    const baseResult = spawnSync('git', ['worktree', 'remove', '.worktrees/base'], {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    if (baseResult.status !== 0) {
      // Force remove if locked
      spawnSync('git', ['worktree', 'remove', '--force', '.worktrees/base'], {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
    }

    // Try to remove current worktree, force if it fails
    const currentResult = spawnSync('git', ['worktree', 'remove', '.worktrees/current'], {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    if (currentResult.status !== 0) {
      spawnSync('git', ['worktree', 'remove', '--force', '.worktrees/current'], {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
    }
  }
}
