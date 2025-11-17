// ABOUTME: Determines whether to run full test suite, incremental tests, or skip based on git changes and spec manifest.
// ABOUTME: Combines git diff detection (codebase changes) with manifest hashing (spec changes).

import { execSync } from 'child_process';
import { readdirSync } from 'fs';
import * as path from 'path';
import { Config } from '../../types/config';
import { SpecManifest } from '../../specs/manifest';

export type ExecutionScope = 'full' | 'incremental' | 'skip';

export interface RunOptions {
  all?: boolean;
  baseBranch?: string;
}

export class ChangeDetector {
  constructor(
    private config: Config,
    private manifest: SpecManifest,
    private projectRoot: string
  ) {}

  determineScope(options: RunOptions): ExecutionScope {
    // Explicit flag overrides all
    if (options.all) {
      return 'full';
    }

    // Check if codebase changed since base branch
    const baseBranch = options.baseBranch || this.config.baseBranch;
    if (this.hasCodebaseChanges(baseBranch)) {
      return 'full';
    }

    // Check if specs changed via manifest
    const specFiles = this.findSpecFiles();
    const changes = this.manifest.detectChanges(specFiles);

    if (changes.new.length > 0 || changes.modified.length > 0) {
      return 'incremental';
    }

    // Nothing changed
    return 'skip';
  }

  getSpecsToGenerate(scope: ExecutionScope): string[] {
    if (scope === 'full') {
      return this.findSpecFiles();
    } else if (scope === 'incremental') {
      const changes = this.manifest.detectChanges(this.findSpecFiles());
      return [...changes.new, ...changes.modified];
    }
    return [];
  }

  private hasCodebaseChanges(baseBranch: string): boolean {
    try {
      execSync(
        `git diff --quiet ${baseBranch}..HEAD -- src/`,
        { cwd: this.projectRoot, stdio: 'pipe' }
      );
      return false; // No differences (exit code 0)
    } catch (error: any) {
      // Exit code 1 means differences exist, which is expected
      if (error.status === 1) {
        return true;
      }
      // Any other error should be thrown
      throw error;
    }
  }

  private findSpecFiles(): string[] {
    const files = readdirSync(this.config.specsDir);
    return files
      .filter(f => f.endsWith('.md') && !f.toUpperCase().startsWith('README'))
      .map(f => path.join(this.config.specsDir, f));
  }
}
