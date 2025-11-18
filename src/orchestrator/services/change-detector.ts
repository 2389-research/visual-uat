// ABOUTME: Determines whether to run full test suite, incremental tests, or skip based on git changes and spec manifest.
// ABOUTME: Combines git diff detection (codebase changes) with manifest hashing (spec changes).

import { spawnSync } from 'child_process';
import { readdirSync } from 'fs';
import * as path from 'path';
import { Config } from '../../types/config';
import { SpecManifest } from '../../specs/manifest';

type ScopeType = 'full' | 'incremental' | 'skip';

export interface RunOptions {
  all?: boolean;
  baseBranch?: string;
  failFast?: boolean;
  keepWorktrees?: boolean;
}

export class ChangeDetector {
  constructor(
    private config: Config,
    private manifest: SpecManifest,
    private projectRoot: string
  ) {}

  determineScope(options: RunOptions): ScopeType {
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

  getSpecsToGenerate(scope: ScopeType): string[] {
    if (scope === 'full') {
      return this.findSpecFiles();
    } else if (scope === 'incremental') {
      const changes = this.manifest.detectChanges(this.findSpecFiles());
      return [...changes.new, ...changes.modified];
    }
    return [];
  }

  private hasCodebaseChanges(baseBranch: string): boolean {
    const result = spawnSync(
      'git',
      ['diff', '--quiet', `${baseBranch}..HEAD`, '--', 'src/'],
      { cwd: this.projectRoot, stdio: 'pipe' }
    );

    // Exit code 0 means no differences
    if (result.status === 0) {
      return false;
    }

    // Exit code 1 means differences exist
    if (result.status === 1) {
      return true;
    }

    // Any other status is an error
    throw new Error(`Git diff failed with status ${result.status}: ${result.stderr}`);
  }

  private findSpecFiles(): string[] {
    const files = readdirSync(this.config.specsDir);
    return files
      .filter(f => {
        if (!f.endsWith('.md')) return false;
        // Only exclude files where basename (without extension) is exactly "README"
        const basename = path.basename(f, '.md');
        return basename.toUpperCase() !== 'README';
      })
      .map(f => path.join(this.config.specsDir, f));
  }
}
