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
  private createdWorktreePath: string | null = null;

  constructor(private projectRoot: string) {}

  async createWorktrees(baseBranch: string): Promise<WorktreePaths> {
    const worktreePath = path.join(this.projectRoot, '.worktrees/base');
    let basePath = worktreePath;

    // Current branch: use the working directory (already checked out)
    // Only create worktree for base branch
    const currentPath = this.projectRoot;

    // Create base worktree - using spawnSync with array args prevents shell injection
    const baseResult = spawnSync('git', ['worktree', 'add', '.worktrees/base', baseBranch], {
      cwd: this.projectRoot,
      stdio: 'pipe'
    });

    if (baseResult.error || baseResult.status !== 0) {
      // Check if the branch is already checked out in an existing worktree
      const stderr = baseResult.stderr?.toString() || '';
      const alreadyUsedMatch = stderr.match(/already used by worktree at '([^']+)'/);

      if (alreadyUsedMatch) {
        // The base branch is already checked out somewhere, use that path
        // Do NOT track this for cleanup - we didn't create it
        basePath = alreadyUsedMatch[1];
        console.log(`Base branch '${baseBranch}' already checked out at ${basePath}, reusing existing checkout`);
      } else {
        throw new Error(`Failed to create base worktree: ${baseResult.error?.message || stderr || 'git command failed'}`);
      }
    } else {
      // We successfully created this worktree, track it for cleanup
      this.createdWorktreePath = worktreePath;
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
    // Only remove worktree if we created it
    if (!this.createdWorktreePath) {
      return;
    }

    // Check if the worktree directory still exists
    if (!fs.existsSync(this.createdWorktreePath)) {
      this.createdWorktreePath = null;
      return;
    }

    // Remove the worktree we created
    const relativePath = path.relative(this.projectRoot, this.createdWorktreePath);
    const baseResult = spawnSync('git', ['worktree', 'remove', relativePath], {
      cwd: this.projectRoot,
      stdio: 'pipe'
    });

    if (baseResult.status !== 0) {
      // Force remove if locked
      spawnSync('git', ['worktree', 'remove', '--force', relativePath], {
        cwd: this.projectRoot,
        stdio: 'pipe'
      });
    }

    this.createdWorktreePath = null;
  }
}
