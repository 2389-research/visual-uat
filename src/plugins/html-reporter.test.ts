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
});
