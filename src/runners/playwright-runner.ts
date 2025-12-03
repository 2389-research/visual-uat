// ABOUTME: Playwright test runner plugin for BDD-to-test generation
// ABOUTME: Uses LLM to translate BDD specs to executable Playwright code

import Anthropic from '@anthropic-ai/sdk';
import { BDDSpec, TestRunnerPlugin, TestExecutionContext } from '../types/plugins';
import { TestResult } from '../orchestrator/types/results';
import { spawnSync } from 'child_process';

export class PlaywrightRunner implements TestRunnerPlugin {
  name = 'playwright';
  fileExtension = '.spec.ts';

  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async generate(spec: BDDSpec): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: this.buildPrompt(spec)
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from LLM');
    }

    return this.addFileHeader(content.text, spec);
  }

  async execute(testPath: string, context: TestExecutionContext): Promise<TestResult> {
    const result = spawnSync('npx', ['playwright', 'test', testPath, '--reporter=json'], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        BASE_URL: context.baseUrl,
        SCREENSHOT_DIR: context.screenshotDir,
        ...context.environment
      }
    });

    // Parse result and return TestResult
    // This is a simplified version - full implementation would parse JSON output
    return {
      specPath: testPath,
      generatedPath: testPath,
      status: result.status === 0 ? 'passed' : 'failed',
      checkpoints: [],
      duration: 0
    };
  }

  private buildPrompt(spec: BDDSpec): string {
    return `Generate a Playwright test file from this BDD specification.

## BDD Spec
Feature: ${spec.feature}

${spec.scenarios.map(s => `
Scenario: ${s.name}
${s.steps.map(step => `  ${step.type.charAt(0).toUpperCase() + step.type.slice(1)} ${step.text}`).join('\n')}
${s.checkpoints.map(cp => `
  Checkpoint: ${cp.name}
    capture: ${cp.capture}
    focus: ${JSON.stringify(cp.focus || [])}`).join('\n')}
`).join('\n')}

## Requirements
- Use TypeScript with Playwright test imports
- Include screenshotCheckpoint calls for each checkpoint
- Use process.env.BASE_URL for the base URL
- Import screenshotCheckpoint from 'visual-uat/playwright'
- Add assertions for "then" steps using expect()
- Return ONLY the code, no markdown fences or explanation`;
  }

  private addFileHeader(code: string, spec: BDDSpec): string {
    const header = `// ABOUTME: Auto-generated Playwright test from ${spec.path}
// ABOUTME: Source story: ${spec.sourceStory} - DO NOT EDIT DIRECTLY

`;
    return header + code;
  }
}
