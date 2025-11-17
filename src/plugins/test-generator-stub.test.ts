// ABOUTME: Tests for stub test generator (template-based, no LLM)
// ABOUTME: Validates basic test script generation from natural language specs

import { StubTestGenerator } from './test-generator-stub';
import type { TestSpec, CodebaseContext } from '../types/plugins';

describe('StubTestGenerator', () => {
  const generator = new StubTestGenerator();

  it('should generate basic Playwright test', async () => {
    const spec: TestSpec = {
      path: 'test.md',
      content: 'Navigate to homepage and verify title',
      intent: 'Verify homepage loads with correct title'
    };

    const context: CodebaseContext = {
      files: [],
      structure: ''
    };

    const result = await generator.generate(spec, context);

    expect(result.language).toBe('typescript');
    expect(result.code).toContain('test(');
    expect(result.code).toContain('page.goto');
    expect(result.checkpoints.length).toBeGreaterThan(0);
  });

  it('should extract checkpoint names from spec', async () => {
    const spec: TestSpec = {
      path: 'test.md',
      content: 'Step 1: Login\nCheckpoint: after-login\nStep 2: View dashboard\nCheckpoint: dashboard-loaded',
      intent: 'Verify login flow and dashboard loading'
    };

    const context: CodebaseContext = {
      files: [],
      structure: ''
    };

    const result = await generator.generate(spec, context);

    expect(result.checkpoints).toContain('after-login');
    expect(result.checkpoints).toContain('dashboard-loaded');
  });
});
