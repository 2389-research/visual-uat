// ABOUTME: Handles the 'generate' command, regenerating all test scripts from specs without executing them.
// ABOUTME: Continues on generation failures, logging errors and providing summary.

import * as fs from 'fs';
import * as path from 'path';
import { Config } from '../../types/config';
import { TestGenerator, TestSpec, CodebaseContext } from '../../types/plugins';

export class GenerateCommandHandler {
  constructor(
    private config: Config,
    private projectRoot: string
  ) {}

  async execute(generator: TestGenerator): Promise<number> {
    const specFiles = this.findSpecFiles();
    const results: { success: string[]; failed: Array<{ spec: string; error: string }> } = {
      success: [],
      failed: []
    };

    // Ensure generated directory exists
    if (!fs.existsSync(this.config.generatedDir)) {
      fs.mkdirSync(this.config.generatedDir, { recursive: true });
    }

    for (const specPath of specFiles) {
      try {
        await this.generateTest(specPath, generator);
        results.success.push(specPath);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        results.failed.push({ spec: specPath, error: errorMessage });
        console.error(`Failed to generate test for ${specPath}: ${errorMessage}`);
      }
    }

    this.printSummary(results);
    return 0;
  }

  private async generateTest(specPath: string, generator: TestGenerator): Promise<void> {
    const content = fs.readFileSync(specPath, 'utf-8');
    const spec: TestSpec = {
      path: specPath,
      content,
      intent: content // For MVP, intent is the full content
    };

    const context: CodebaseContext = {
      files: [],
      structure: ''
    };

    const generated = await generator.generate(spec, context);

    const baseName = path.basename(specPath, '.md');
    const outputPath = path.join(this.config.generatedDir, `${baseName}.spec.ts`);

    fs.writeFileSync(outputPath, generated.code);
  }

  private findSpecFiles(): string[] {
    const files = fs.readdirSync(this.config.specsDir);
    return files
      .filter(f => f.endsWith('.md'))
      .map(f => path.join(this.config.specsDir, f));
  }

  private printSummary(results: { success: string[]; failed: Array<{ spec: string; error: string }> }): void {
    const total = results.success.length + results.failed.length;

    console.log(`\nGenerated ${total} test scripts`);
    console.log(`✓ ${results.success.length} successful`);

    if (results.failed.length > 0) {
      console.log(`✗ ${results.failed.length} failed:`);
      results.failed.forEach(({ spec, error }) => {
        console.log(`  - ${spec}: ${error}`);
      });
    }
  }
}
