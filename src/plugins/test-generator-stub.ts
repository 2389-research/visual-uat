// ABOUTME: Stub test generator using template-based approach
// ABOUTME: Generates basic Playwright tests without LLM (placeholder for MVP)

import type { TestGenerator, TestSpec, CodebaseContext, GeneratedTest } from '../types/plugins';

export class StubTestGenerator implements TestGenerator {
  async generate(spec: TestSpec, context: CodebaseContext): Promise<GeneratedTest> {
    // Extract checkpoints from spec (lines starting with "Checkpoint:")
    let checkpoints = this.extractCheckpoints(spec.content);

    // If no checkpoints found, add a default one
    if (checkpoints.length === 0) {
      checkpoints = ['default'];
    }

    // Generate basic Playwright test template
    const code = this.generatePlaywrightTest(spec.content, checkpoints);

    return {
      code,
      language: 'typescript',
      checkpoints
    };
  }

  private extractCheckpoints(content: string): string[] {
    const checkpointRegex = /Checkpoint:\s*([a-z0-9-]+)/gi;
    const matches = [...content.matchAll(checkpointRegex)];
    return matches.map(m => m[1]);
  }

  private generatePlaywrightTest(content: string, checkpoints: string[]): string {
    const steps = content.split('\n').filter(line => line.trim().length > 0);

    let code = `import { test, expect, Page } from '@playwright/test';
import { screenshotCheckpoint } from 'visual-uat/playwright';

test('${steps[0] || 'visual test'}', async ({ page }) => {
  // Navigate to base URL (from config)
  await page.goto(process.env.BASE_URL || 'http://localhost:3000');

`;

    // Add checkpoints
    checkpoints.forEach((checkpoint, idx) => {
      code += `  // Checkpoint ${idx + 1}: ${checkpoint}\n`;
      code += `  await screenshotCheckpoint(page, '${checkpoint}');\n\n`;
    });

    code += `});\n`;

    return code;
  }
}
