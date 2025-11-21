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

  async createWorktrees(baseBranch: string): Promise<WorktreePaths> {
    const basePath = path.join(this.projectRoot, '.worktrees/base');

    // Current branch: use the working directory (already checked out)
    // Only create worktree for base branch
    const currentPath = this.projectRoot;

    // Create base worktree - using spawnSync with array args prevents shell injection
    const baseResult = spawnSync('git', ['worktree', 'add', '.worktrees/base', baseBranch], {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    if (baseResult.error || baseResult.status !== 0) {
      throw new Error(`Failed to create base worktree: ${baseResult.error?.message || 'git command failed'}`);
    }

    // Install dependencies in base worktree if package.json exists
    if (fs.existsSync(path.join(basePath, 'package.json'))) {
      const baseNpmResult = spawnSync('npm', ['install'], { cwd: basePath, stdio: 'inherit' });
      if (baseNpmResult.error || baseNpmResult.status !== 0) {
        throw new Error(
          `npm install failed in base worktree (${basePath}): ` +
          `exit code ${baseNpmResult.status}, error: ${baseNpmResult.error?.message || 'none'}`
        );
      }
    }

    // Current working directory should already have dependencies installed
    // No need to create worktree or reinstall

    return {
      base: basePath,
      current: currentPath
    };
  }

  cleanup(): void {
    // Only remove base worktree (current uses working directory)
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
  }
}
