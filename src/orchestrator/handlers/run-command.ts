// ABOUTME: Handles the 'run' command, orchestrating the full test execution workflow.
// ABOUTME: Coordinates generation, execution in worktrees, screenshot comparison, and LLM evaluation.

import { Config } from '../../types/config';
import { LoadedPlugins } from '../services/plugin-registry';
import { ChangeDetector, ExecutionScope, RunOptions } from '../services/change-detector';
import { SpecManifest } from '../../specs/manifest';
import * as path from 'path';

export class RunCommandHandler {
  private changeDetector: ChangeDetector;

  constructor(
    private config: Config,
    private plugins: LoadedPlugins,
    private projectRoot: string
  ) {
    const manifest = new SpecManifest(projectRoot);
    this.changeDetector = new ChangeDetector(config, manifest, projectRoot);
  }

  async determineScope(options: RunOptions): Promise<ExecutionScope> {
    return this.changeDetector.determineScope(options);
  }

  async execute(options: RunOptions): Promise<number> {
    // To be implemented in subsequent steps
    throw new Error('Not yet implemented');
  }
}
