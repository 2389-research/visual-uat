// ABOUTME: Tests for HTMLReporter that generates single-page HTML reports with test results.
// ABOUTME: Verifies file generation, HTML structure, metadata display, and basic styling.

import { HTMLReporter } from './html-reporter';
import { RunResult } from '../orchestrator/types/results';
import * as fs from 'fs';
import * as path from 'path';

describe('HTMLReporter', () => {
  const testOutputDir = '.visual-uat/test-reports';

  beforeEach(() => {
    // Clean test output directory
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
    fs.mkdirSync(testOutputDir, { recursive: true });
  });

  afterEach(() => {
    // Cleanup
    if (fs.existsSync(testOutputDir)) {
      fs.rmSync(testOutputDir, { recursive: true });
    }
  });

  it('should generate HTML file with correct filename', async () => {
    const reporter = new HTMLReporter();
    const result: RunResult = {
      runId: 'a3f7b9c',
      timestamp: new Date('2024-11-18T14:30:22Z').getTime(),
      baseBranch: 'main',
      currentBranch: 'feature/test',
      config: {} as any,
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
    };

    await reporter.generate(result, { outputDir: testOutputDir });

    const expectedFile = path.join(testOutputDir, '2024-11-18-14-30-22-a3f7b9c.html');
    expect(fs.existsSync(expectedFile)).toBe(true);
  });

  it('should include basic HTML structure', async () => {
    const reporter = new HTMLReporter();
    const result: RunResult = {
      runId: 'a3f7b9c',
      timestamp: Date.now(),
      baseBranch: 'main',
      currentBranch: 'feature/test',
      config: {} as any,
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
    };

    await reporter.generate(result, { outputDir: testOutputDir });

    const files = fs.readdirSync(testOutputDir);
    const htmlFile = path.join(testOutputDir, files[0]);
    const content = fs.readFileSync(htmlFile, 'utf-8');

    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<html');
    expect(content).toContain('</html>');
    expect(content).toContain('<title>Visual UAT Report</title>');
  });

  it('should include run metadata in header', async () => {
    const reporter = new HTMLReporter();
    const result: RunResult = {
      runId: 'a3f7b9c',
      timestamp: Date.now(),
      baseBranch: 'main',
      currentBranch: 'feature/test',
      config: {} as any,
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
    };

    await reporter.generate(result, { outputDir: testOutputDir });

    const files = fs.readdirSync(testOutputDir);
    const htmlFile = path.join(testOutputDir, files[0]);
    const content = fs.readFileSync(htmlFile, 'utf-8');

    expect(content).toContain('feature/test');
    expect(content).toContain('main');
    expect(content).toContain('a3f7b9c');
  });

  it('should include summary boxes with counts', async () => {
    const reporter = new HTMLReporter();
    const result: RunResult = {
      runId: 'a3f7b9c',
      timestamp: Date.now(),
      baseBranch: 'main',
      currentBranch: 'feature/test',
      config: {} as any,
      tests: [],
      summary: { total: 10, passed: 5, failed: 2, errored: 1, needsReview: 2 }
    };

    await reporter.generate(result, { outputDir: testOutputDir });

    const files = fs.readdirSync(testOutputDir);
    const htmlFile = path.join(testOutputDir, files[0]);
    const content = fs.readFileSync(htmlFile, 'utf-8');

    // Verify counts are in proper HTML context
    expect(content).toContain('<div class="count">5</div>');
    expect(content).toContain('<div class="count">2</div>');
    expect(content).toContain('<div class="count">1</div>');

    // Verify labels are present
    expect(content).toContain('<div class="label">Passed</div>');
    expect(content).toContain('<div class="label">Needs Review</div>');
    expect(content).toContain('<div class="label">Failed</div>');
    expect(content).toContain('<div class="label">Errored</div>');

    expect(content).toContain('class="summary-box');
  });

  it('should list all tests with status', async () => {
    const reporter = new HTMLReporter();
    const result: RunResult = {
      runId: 'a3f7b9c',
      timestamp: Date.now(),
      baseBranch: 'main',
      currentBranch: 'feature/test',
      config: {} as any,
      tests: [
        {
          specPath: 'tests/login.md',
          generatedPath: 'tests/generated/login.spec.ts',
          status: 'passed',
          checkpoints: [],
          duration: 1200,
          baselineAvailable: true
        },
        {
          specPath: 'tests/dashboard.md',
          generatedPath: 'tests/generated/dashboard.spec.ts',
          status: 'needs-review',
          checkpoints: [],
          duration: 2100,
          baselineAvailable: true
        }
      ],
      summary: { total: 2, passed: 1, failed: 0, errored: 0, needsReview: 1 }
    };

    await reporter.generate(result, { outputDir: testOutputDir });

    const files = fs.readdirSync(testOutputDir);
    const htmlFile = path.join(testOutputDir, files[0]);
    const content = fs.readFileSync(htmlFile, 'utf-8');

    expect(content).toContain('login');
    expect(content).toContain('dashboard');
    expect(content).toContain('1.2s'); // formatted duration
    expect(content).toContain('2.1s');
    expect(content).toContain('class="test-card');
  });

  it('should handle empty test list', async () => {
    const reporter = new HTMLReporter();
    const result: RunResult = {
      runId: 'a3f7b9c',
      timestamp: Date.now(),
      baseBranch: 'main',
      currentBranch: 'feature/test',
      config: {} as any,
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
    };

    await reporter.generate(result, { outputDir: testOutputDir });

    const files = fs.readdirSync(testOutputDir);
    const htmlFile = path.join(testOutputDir, files[0]);
    const content = fs.readFileSync(htmlFile, 'utf-8');

    expect(content).toContain('<!DOCTYPE html>');
    expect(content).toContain('<div class="tests">');
    expect(content).not.toContain('class="test-card');
    expect(content).toContain('<div class="count">0</div>');
  });

  it('should display all status types correctly', async () => {
    const reporter = new HTMLReporter();
    const result: RunResult = {
      runId: 'a3f7b9c',
      timestamp: Date.now(),
      baseBranch: 'main',
      currentBranch: 'feature/test',
      config: {} as any,
      tests: [
        {
          specPath: 'tests/test-passed.md',
          generatedPath: 'tests/generated/test-passed.spec.ts',
          status: 'passed',
          checkpoints: [],
          duration: 1500,
          baselineAvailable: true
        },
        {
          specPath: 'tests/test-failed.md',
          generatedPath: 'tests/generated/test-failed.spec.ts',
          status: 'failed',
          checkpoints: [],
          duration: 2000,
          baselineAvailable: true
        },
        {
          specPath: 'tests/test-errored.md',
          generatedPath: 'tests/generated/test-errored.spec.ts',
          status: 'errored',
          checkpoints: [],
          duration: 500,
          baselineAvailable: false
        },
        {
          specPath: 'tests/test-needs-review.md',
          generatedPath: 'tests/generated/test-needs-review.spec.ts',
          status: 'needs-review',
          checkpoints: [],
          duration: 3200,
          baselineAvailable: true
        }
      ],
      summary: { total: 4, passed: 1, failed: 1, errored: 1, needsReview: 1 }
    };

    await reporter.generate(result, { outputDir: testOutputDir });

    const files = fs.readdirSync(testOutputDir);
    const htmlFile = path.join(testOutputDir, files[0]);
    const content = fs.readFileSync(htmlFile, 'utf-8');

    expect(content).toContain('test-passed');
    expect(content).toContain('test-failed');
    expect(content).toContain('test-errored');
    expect(content).toContain('test-needs-review');

    expect(content).toContain('class="test-card passed"');
    expect(content).toContain('class="test-card failed"');
    expect(content).toContain('class="test-card errored"');
    expect(content).toContain('class="test-card needs-review"');

    expect(content).toContain('class="test-status passed">passed</span>');
    expect(content).toContain('class="test-status failed">failed</span>');
    expect(content).toContain('class="test-status errored">errored</span>');
    expect(content).toContain('class="test-status needs-review">needs-review</span>');
  });

  it('should format millisecond durations correctly', async () => {
    const reporter = new HTMLReporter();
    const result: RunResult = {
      runId: 'a3f7b9c',
      timestamp: Date.now(),
      baseBranch: 'main',
      currentBranch: 'feature/test',
      config: {} as any,
      tests: [
        {
          specPath: 'tests/fast-test.md',
          generatedPath: 'tests/generated/fast-test.spec.ts',
          status: 'passed',
          checkpoints: [],
          duration: 250,
          baselineAvailable: true
        },
        {
          specPath: 'tests/slow-test.md',
          generatedPath: 'tests/generated/slow-test.spec.ts',
          status: 'passed',
          checkpoints: [],
          duration: 5432,
          baselineAvailable: true
        }
      ],
      summary: { total: 2, passed: 2, failed: 0, errored: 0, needsReview: 0 }
    };

    await reporter.generate(result, { outputDir: testOutputDir });

    const files = fs.readdirSync(testOutputDir);
    const htmlFile = path.join(testOutputDir, files[0]);
    const content = fs.readFileSync(htmlFile, 'utf-8');

    expect(content).toContain('250ms');
    expect(content).toContain('5.4s');
  });

  it('should escape HTML in test names to prevent XSS', async () => {
    const reporter = new HTMLReporter();
    const result: RunResult = {
      runId: 'a3f7b9c',
      timestamp: Date.now(),
      baseBranch: 'main',
      currentBranch: 'feature/test',
      config: {} as any,
      tests: [
        {
          specPath: 'tests/test-with-<html>-&-quotes".md',
          generatedPath: 'tests/generated/malicious.spec.ts',
          status: 'passed',
          checkpoints: [],
          duration: 1000,
          baselineAvailable: true
        }
      ],
      summary: { total: 1, passed: 1, failed: 0, errored: 0, needsReview: 0 }
    };

    await reporter.generate(result, { outputDir: testOutputDir });

    const files = fs.readdirSync(testOutputDir);
    const htmlFile = path.join(testOutputDir, files[0]);
    const content = fs.readFileSync(htmlFile, 'utf-8');

    expect(content).toContain('&lt;html&gt;');
    expect(content).toContain('&amp;');
    expect(content).toContain('&quot;');
    expect(content).not.toContain('test-with-<html>-&-quotes"');
  });
});
