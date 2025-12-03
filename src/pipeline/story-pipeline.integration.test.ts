// ABOUTME: Integration test for full story → BDD → test pipeline
// ABOUTME: Tests end-to-end generation with real file system

import * as fs from 'fs';
import * as path from 'path';
import { GeneratePipeline } from './generate-pipeline';

// Skip in CI without API key
const describeWithApi = process.env.ANTHROPIC_API_KEY
  ? describe
  : describe.skip;

describeWithApi('Story Pipeline Integration', () => {
  const testDir = path.join(__dirname, '__integration_test__');

  beforeAll(() => {
    // Create test structure
    const storiesDir = path.join(testDir, 'tests/stories');
    fs.mkdirSync(storiesDir, { recursive: true });

    fs.writeFileSync(
      path.join(storiesDir, 'login.story.md'),
      `# User Login

As a registered user, I want to log into my account so I can access my dashboard.

## Scenario

1. I go to the login page
2. I enter my username and password
3. I click the "Login" button
4. I should see my dashboard

## Visual Checkpoints

- Login form visible and styled correctly
- Dashboard loads after successful login
`
    );
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should generate BDD spec and Playwright test from story', async () => {
    const pipeline = new GeneratePipeline(testDir, {
      storiesDir: 'tests/stories',
      runner: 'playwright'
    });

    const result = await pipeline.run();

    expect(result.generated).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Check BDD spec was created
    const specPath = path.join(testDir, '.visual-uat/specs/login.spec.md');
    expect(fs.existsSync(specPath)).toBe(true);

    const specContent = fs.readFileSync(specPath, 'utf-8');
    expect(specContent).toContain('Given');
    expect(specContent).toContain('When');
    expect(specContent).toContain('Then');

    // Check test was created
    const testPath = path.join(testDir, '.visual-uat/generated/login.spec.ts');
    expect(fs.existsSync(testPath)).toBe(true);

    const testContent = fs.readFileSync(testPath, 'utf-8');
    expect(testContent).toContain('import { test');
    expect(testContent).toContain('playwright');
  }, 60000); // 60s timeout for LLM calls
});
