// ABOUTME: Manages git worktrees for isolated branch testing, creating and cleaning up worktrees.
// ABOUTME: Handles dependency installation (npm install) in each worktree.

import { execSync } from 'child_process';
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

    // Create worktrees
    execSync(`git worktree add .worktrees/base ${baseBranch}`, {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    execSync(`git worktree add .worktrees/current ${currentBranch}`, {
      cwd: this.projectRoot,
      stdio: 'inherit'
    });

    // Install dependencies if package.json exists
    if (fs.existsSync(path.join(basePath, 'package.json'))) {
      execSync('npm install', { cwd: basePath, stdio: 'inherit' });
    }

    if (fs.existsSync(path.join(currentPath, 'package.json'))) {
      execSync('npm install', { cwd: currentPath, stdio: 'inherit' });
    }

    return {
      base: basePath,
      current: currentPath
    };
  }

  async cleanup(): Promise<void> {
    try {
      execSync('git worktree remove .worktrees/base', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
    } catch (error) {
      // Force remove if locked
      execSync('git worktree remove --force .worktrees/base', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
    }

    try {
      execSync('git worktree remove .worktrees/current', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
    } catch (error) {
      execSync('git worktree remove --force .worktrees/current', {
        cwd: this.projectRoot,
        stdio: 'inherit'
      });
    }
  }
}
