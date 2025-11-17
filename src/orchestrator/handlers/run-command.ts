// ABOUTME: Handles the 'run' command, orchestrating the full test execution workflow.
// ABOUTME: Coordinates generation, execution in worktrees, screenshot comparison, and LLM evaluation.

import { Config } from '../../types/config';
import { LoadedPlugins } from '../services/plugin-registry';
import { ChangeDetector, ExecutionScope, RunOptions } from '../services/change-detector';
import { SpecManifest } from '../../specs/manifest';
import { TestSpec, CodebaseContext } from '../../types/plugins';
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
    return this.changeDetector.determineScope(options);
  }

  async generateTests(
    scope: ExecutionScope,
    options: { failFast?: boolean } = {}
  ): Promise<GenerationResult> {
    const specsToGenerate = this.changeDetector.getSpecsToGenerate(scope);
    const results: GenerationResult = { success: [], failed: [] };

    // Ensure generated directory exists
    if (!fs.existsSync(this.config.generatedDir)) {
      fs.mkdirSync(this.config.generatedDir, { recursive: true });
    }

    for (const specPath of specsToGenerate) {
      try {
        await this.generateSingleTest(specPath);
        results.success.push(specPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failed.push({ spec: specPath, error: errorMessage });

        if (options.failFast) {
          throw error;
        }
      }
    }

    return results;
  }

  private async generateSingleTest(specPath: string): Promise<void> {
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
  }

  async execute(options: RunOptions): Promise<number> {
    // To be implemented in subsequent steps
    throw new Error('Not yet implemented');
  }
}
