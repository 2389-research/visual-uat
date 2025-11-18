// ABOUTME: Handles the 'run' command, orchestrating the full test execution workflow.
// ABOUTME: Coordinates generation, execution in worktrees, screenshot comparison, and LLM evaluation.

import { Config } from '../../types/config';
import { LoadedPlugins } from '../services/plugin-registry';
import { ChangeDetector, RunOptions } from '../services/change-detector';
import { SpecManifest } from '../../specs/manifest';
import { TestSpec, CodebaseContext } from '../../types/plugins';
import { ExecutionState, ExecutionContext, ExecutionScope } from './execution-states';
import { WorktreeManager } from '../services/worktree-manager';
import { execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface GenerationResult {
  success: string[];
  failed: Array<{ spec: string; error: string }>;
}

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
    const scopeType = this.changeDetector.determineScope(options);
    const baseBranch = options.baseBranch || this.config.baseBranch;
    const specsToGenerate = this.changeDetector.getSpecsToGenerate(scopeType);

    return {
      type: scopeType,
      baseBranch,
      specsToGenerate
    };
  }

  async generateTests(
    scope: ExecutionScope,
    options: { failFast?: boolean } = {}
  ): Promise<GenerationResult> {
    const specsToGenerate = scope.specsToGenerate;
    const results: GenerationResult = { success: [], failed: [] };
    const manifest = new SpecManifest(this.projectRoot);

    // Ensure generated directory exists
    if (!fs.existsSync(this.config.generatedDir)) {
      fs.mkdirSync(this.config.generatedDir, { recursive: true });
    }

    for (const specPath of specsToGenerate) {
      try {
        const generatedPath = await this.generateSingleTest(specPath);
        manifest.updateSpec(specPath, generatedPath);
        results.success.push(specPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failed.push({ spec: specPath, error: errorMessage });

        if (options.failFast) {
          throw error;
        }
      }
    }

    manifest.save();
    return results;
  }

  private async generateSingleTest(specPath: string): Promise<string> {
    const content = fs.readFileSync(specPath, 'utf-8');
    const spec: TestSpec = {
      path: specPath,
      content,
      intent: content
    };

    const context: CodebaseContext = {
      files: [],
      structure: ''
    };

    const generated = await this.plugins.testGenerator.generate(spec, context);

    const baseName = path.basename(specPath, '.md');
    const outputPath = path.join(this.config.generatedDir, `${baseName}.spec.ts`);

    fs.writeFileSync(outputPath, generated.code);
    return outputPath;
  }

  private async handleSetup(
    context: ExecutionContext,
    options: RunOptions
  ): Promise<ExecutionState> {
    try {
      // Determine scope
      context.scope = await this.determineScope(options);

      if (context.scope.type === 'skip') {
        console.log('No changes detected, skipping tests');
        return 'COMPLETE';
      }

      // Generate tests
      await this.generateTests(context.scope);

      // Get current branch
      const currentBranch = execSync('git branch --show-current', {
        cwd: this.projectRoot,
        encoding: 'utf-8'
      }).trim();

      // Create worktrees
      const worktreeManager = new WorktreeManager(this.projectRoot);
      context.worktrees = await worktreeManager.createWorktrees(
        context.scope.baseBranch,
        currentBranch
      );

      return 'EXECUTE_BASE';
    } catch (error) {
      console.error('Setup failed:', error);
      return 'FAILED';
    }
  }

  async execute(options: RunOptions): Promise<number> {
    // To be implemented in subsequent steps
    throw new Error('Not yet implemented');
  }
}
