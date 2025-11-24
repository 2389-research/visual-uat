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

  it('should include status banner and filter buttons with counts', async () => {
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

    // Verify status banner is present
    expect(content).toContain('class="status-banner"');
    expect(content).toContain('feature/test');
    expect(content).toContain('main');

    // Verify filter buttons with counts
    expect(content).toContain('Passed (5)');
    expect(content).toContain('Needs Review (2)');
    expect(content).toContain('Failed (2)');
    expect(content).toContain('Errored (1)');
    expect(content).toContain('All (10)');
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
    // Check filter buttons show zero counts
    expect(content).toContain('All (0)');
    expect(content).toContain('Passed (0)');
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

    // Passed and errored tests should not auto-expand
    expect(content).toContain('class="test-card passed"');
    expect(content).toContain('class="test-card errored"');

    // Failed and needs-review tests should auto-expand
    expect(content).toContain('class="test-card failed expanded"');
    expect(content).toContain('class="test-card needs-review expanded"');

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

  describe('Checkpoint Display with Image Overlay', () => {
    it('should display checkpoint details with image comparison slider', async () => {
      const reporter = new HTMLReporter();
      const result: RunResult = {
        runId: 'a3f7b9c',
        timestamp: Date.now(),
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [
          {
            specPath: 'tests/dashboard.md',
            generatedPath: 'tests/generated/dashboard.spec.ts',
            status: 'needs-review',
            checkpoints: [
              {
                name: 'initial',
                baselineImage: '.visual-uat/screenshots/base/dashboard/initial.png',
                currentImage: '.visual-uat/screenshots/current/dashboard/initial.png',
                diffImage: '.visual-uat/diffs/dashboard/initial.png',
                diffMetrics: { pixelDiffPercent: 2.3, changedRegions: [] },
                evaluation: {
                  pass: false,
                  confidence: 0.8,
                  reason: 'Layout shifted slightly',
                  needsReview: true
                }
              }
            ],
            duration: 2100,
            baselineAvailable: true
          }
        ],
        summary: { total: 1, passed: 0, failed: 0, errored: 0, needsReview: 1 }
      };

      await reporter.generate(result, { outputDir: testOutputDir });

      const files = fs.readdirSync(testOutputDir);
      const htmlFile = path.join(testOutputDir, files[0]);
      const content = fs.readFileSync(htmlFile, 'utf-8');

      // Verify checkpoint structure exists
      expect(content).toContain('class="checkpoint');

      // Verify checkpoint name
      expect(content).toContain('initial');

      // Verify diff percentage
      expect(content).toContain('2.3%');

      // Verify evaluation reasoning
      expect(content).toContain('Layout shifted');

      // Verify image comparison structure
      expect(content).toContain('class="image-comparison');

      // Verify slider control exists
      expect(content).toContain('type="range"');

      // Verify view mode buttons
      expect(content).toContain('>Overlay<');
      expect(content).toContain('>Diff<');
      expect(content).toContain('>Side by Side<');

      // Verify JavaScript functions for image comparison
      expect(content).toContain('updateSlider');
      expect(content).toContain('setViewMode');

      // Verify auto-expand logic exists
      expect(content).toContain('.test-card.needs-review');
      expect(content).toContain('.test-card.failed');
      expect(content).toContain('expanded');
    });

    it('should escape image paths with special characters to prevent XSS', async () => {
      const reporter = new HTMLReporter();
      const result: RunResult = {
        runId: 'a3f7b9c',
        timestamp: Date.now(),
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [
          {
            specPath: 'tests/malicious.md',
            generatedPath: 'tests/generated/malicious.spec.ts',
            status: 'needs-review',
            checkpoints: [
              {
                name: 'xss-attempt',
                baselineImage: 'path/with"quotes\'and<tags>&ampersand.png',
                currentImage: 'path/with"quotes\'and<tags>&ampersand-current.png',
                diffImage: 'path/with"quotes\'and<tags>&ampersand-diff.png',
                diffMetrics: { pixelDiffPercent: 1.5, changedRegions: [] },
                evaluation: {
                  pass: false,
                  confidence: 0.9,
                  reason: 'Testing XSS prevention',
                  needsReview: true
                }
              }
            ],
            duration: 1500,
            baselineAvailable: true
          }
        ],
        summary: { total: 1, passed: 0, failed: 0, errored: 0, needsReview: 1 }
      };

      await reporter.generate(result, { outputDir: testOutputDir });

      const files = fs.readdirSync(testOutputDir);
      const htmlFile = path.join(testOutputDir, files[0]);
      const content = fs.readFileSync(htmlFile, 'utf-8');

      // Verify special characters are properly escaped in image src attributes
      expect(content).toContain('&quot;quotes&#39;and&lt;tags&gt;&amp;ampersand');

      // Verify the unescaped version is NOT present (would be XSS vulnerability)
      expect(content).not.toContain('src="path/with"quotes');
      expect(content).not.toContain('path/with"quotes\'and<tags>&ampersand.png"');
    });
  });

  describe('Filter Bar', () => {
    it('should include filter bar with status buttons and search input', async () => {
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

      // Filter bar container
      expect(content).toContain('class="filter-bar"');

      // Status filter buttons
      expect(content).toContain('data-filter="all"');
      expect(content).toContain('data-filter="passed"');
      expect(content).toContain('data-filter="needs-review"');
      expect(content).toContain('data-filter="failed"');
      expect(content).toContain('data-filter="errored"');

      // Button text with counts
      expect(content).toContain('All (0)');
      expect(content).toContain('Passed (0)');
      expect(content).toContain('Needs Review (0)');
      expect(content).toContain('Failed (0)');
      expect(content).toContain('Errored (0)');

      // Search input
      expect(content).toContain('id="search-input"');
      expect(content).toContain('type="text"');
      expect(content).toContain('placeholder="Search tests');
    });

    it('should include JavaScript filtering logic', async () => {
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
          }
        ],
        summary: { total: 1, passed: 1, failed: 0, errored: 0, needsReview: 0 }
      };

      await reporter.generate(result, { outputDir: testOutputDir });

      const files = fs.readdirSync(testOutputDir);
      const htmlFile = path.join(testOutputDir, files[0]);
      const content = fs.readFileSync(htmlFile, 'utf-8');

      // Check for script tag with filtering logic
      expect(content).toContain('<script>');
      expect(content).toContain('</script>');

      // Check for key filtering functions/logic
      expect(content).toContain('addEventListener');
      expect(content).toContain('querySelectorAll');
      expect(content).toContain('.test-card');

      // Check for status filtering logic
      expect(content).toContain('data-filter');
      expect(content).toContain('data-status');

      // Check for search filtering logic
      expect(content).toContain('search');
      expect(content).toContain('toLowerCase');
    });

    it('should have filter buttons with counts', async () => {
      const reporter = new HTMLReporter();
      const result: RunResult = {
        runId: 'a3f7b9c',
        timestamp: Date.now(),
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [],
        summary: { total: 4, passed: 2, failed: 1, errored: 0, needsReview: 1 }
      };

      await reporter.generate(result, { outputDir: testOutputDir });

      const files = fs.readdirSync(testOutputDir);
      const htmlFile = path.join(testOutputDir, files[0]);
      const content = fs.readFileSync(htmlFile, 'utf-8');

      // Filter buttons should have data-filter attribute
      expect(content).toContain('class="filter-button filter-passed" data-filter="passed"');
      expect(content).toContain('class="filter-button filter-needs-review" data-filter="needs-review"');
      expect(content).toContain('class="filter-button filter-failed" data-filter="failed"');
      expect(content).toContain('class="filter-button filter-errored" data-filter="errored"');

      // Should have status banner
      expect(content).toContain('status-banner');
    });
  });

  describe('HTMLReporter - calculateOverallStatus', () => {
    let reporter: HTMLReporter;

    beforeEach(() => {
      reporter = new HTMLReporter();
    });

    it('should return "passed" when all tests passed', () => {
      const result: Partial<RunResult> = {
        summary: { total: 5, passed: 5, needsReview: 0, failed: 0, errored: 0 }
      };
      // @ts-ignore - accessing private method for testing
      expect(reporter.calculateOverallStatus(result.summary)).toBe('passed');
    });

    it('should return "needs-review" when only passed and needs-review', () => {
      const result: Partial<RunResult> = {
        summary: { total: 5, passed: 3, needsReview: 2, failed: 0, errored: 0 }
      };
      // @ts-ignore
      expect(reporter.calculateOverallStatus(result.summary)).toBe('needs-review');
    });

    it('should return "failed" when any tests failed', () => {
      const result: Partial<RunResult> = {
        summary: { total: 5, passed: 3, needsReview: 1, failed: 1, errored: 0 }
      };
      // @ts-ignore
      expect(reporter.calculateOverallStatus(result.summary)).toBe('failed');
    });

    it('should return "failed" when any tests errored', () => {
      const result: Partial<RunResult> = {
        summary: { total: 5, passed: 4, needsReview: 0, failed: 0, errored: 1 }
      };
      // @ts-ignore
      expect(reporter.calculateOverallStatus(result.summary)).toBe('failed');
    });
  });

  describe('HTMLReporter - generateStatusBanner', () => {
    let reporter: HTMLReporter;

    beforeEach(() => {
      reporter = new HTMLReporter();
    });

    it('should generate green banner for passed status', () => {
      const result: RunResult = {
        currentBranch: 'feature/test',
        baseBranch: 'main',
        runId: 'abc123',
        timestamp: 1700000000000,
        summary: { total: 5, passed: 5, needsReview: 0, failed: 0, errored: 0 },
        tests: [],
        config: {} as any
      };
      // @ts-ignore
      const html = reporter.generateStatusBanner(result);
      expect(html).toContain('background: #10b981');
      expect(html).toContain('color: white');
      expect(html).toContain('All Tests Passed');
      expect(html).toContain('feature/test');
      expect(html).toContain('main');
      expect(html).toContain('5 tests');
    });

    it('should generate amber banner for needs-review status', () => {
      const result: RunResult = {
        currentBranch: 'feature/test',
        baseBranch: 'main',
        runId: 'abc123',
        timestamp: 1700000000000,
        summary: { total: 5, passed: 3, needsReview: 2, failed: 0, errored: 0 },
        tests: [],
        config: {} as any
      };
      // @ts-ignore
      const html = reporter.generateStatusBanner(result);
      expect(html).toContain('background: #f59e0b');
      expect(html).toContain('color: white');
      expect(html).toContain('2 Tests Need Review');
    });

    it('should generate red banner for failed status', () => {
      const result: RunResult = {
        currentBranch: 'feature/test',
        baseBranch: 'main',
        runId: 'abc123',
        timestamp: 1700000000000,
        summary: { total: 5, passed: 2, needsReview: 1, failed: 1, errored: 1 },
        tests: [],
        config: {} as any
      };
      // @ts-ignore
      const html = reporter.generateStatusBanner(result);
      expect(html).toContain('background: #ef4444');
      expect(html).toContain('color: white');
      expect(html).toContain('Tests Failed');
    });
  });

  describe('HTMLReporter - generateTooltipContent', () => {
    let reporter: HTMLReporter;

    beforeEach(() => {
      reporter = new HTMLReporter();
    });

    it('should generate percentage breakdown for "all" filter', () => {
      const summary = { passed: 2, needsReview: 1, failed: 1, errored: 1, total: 5 };
      // @ts-ignore
      const tooltip = reporter.generateAllTooltip(summary);
      expect(tooltip).toContain('Passed: 2 (40%)');
      expect(tooltip).toContain('Needs Review: 1 (20%)');
      expect(tooltip).toContain('Failed: 1 (20%)');
      expect(tooltip).toContain('Errored: 1 (20%)');
    });

    it('should generate test names list for status filter', () => {
      const tests = [
        { specPath: 'tests/specs/login.md', status: 'failed' },
        { specPath: 'tests/specs/checkout.md', status: 'failed' },
        { specPath: 'tests/specs/profile.md', status: 'failed' }
      ];
      // @ts-ignore
      const tooltip = reporter.generateStatusTooltip(tests as any, 'failed');
      expect(tooltip).toContain('login');
      expect(tooltip).toContain('checkout');
      expect(tooltip).toContain('profile');
    });

    it('should limit test names to 4 and show ellipsis', () => {
      const tests = [
        { specPath: 'tests/specs/test1.md', status: 'passed' },
        { specPath: 'tests/specs/test2.md', status: 'passed' },
        { specPath: 'tests/specs/test3.md', status: 'passed' },
        { specPath: 'tests/specs/test4.md', status: 'passed' },
        { specPath: 'tests/specs/test5.md', status: 'passed' },
        { specPath: 'tests/specs/test6.md', status: 'passed' }
      ];
      // @ts-ignore
      const tooltip = reporter.generateStatusTooltip(tests as any, 'passed');
      expect(tooltip).toContain('test1');
      expect(tooltip).toContain('test4');
      expect(tooltip).toContain('...and 2 more');
      expect(tooltip).not.toContain('test5');
    });
  });

  describe('HTMLReporter - generateFilterButtonGroup', () => {
    let reporter: HTMLReporter;

    beforeEach(() => {
      reporter = new HTMLReporter();
    });

    it('should generate buttons with counts', () => {
      const result: RunResult = {
        summary: { total: 4, passed: 2, needsReview: 1, failed: 1, errored: 0 },
        tests: [],
        currentBranch: 'feature/test',
        baseBranch: 'main',
        runId: 'abc123',
        timestamp: Date.now(),
        config: {} as any
      };
      // @ts-ignore
      const html = reporter.generateFilterButtonGroup(result);
      expect(html).toContain('All (4)');
      expect(html).toContain('Passed (2)');
      expect(html).toContain('Needs Review (1)');
      expect(html).toContain('Failed (1)');
      expect(html).toContain('Errored (0)');
    });

    it('should add disabled attribute to zero-count buttons', () => {
      const result: RunResult = {
        summary: { total: 5, passed: 5, needsReview: 0, failed: 0, errored: 0 },
        tests: [],
        currentBranch: 'feature/test',
        baseBranch: 'main',
        runId: 'abc123',
        timestamp: Date.now(),
        config: {} as any
      };
      // @ts-ignore
      const html = reporter.generateFilterButtonGroup(result);
      expect(html).toContain('data-count="0"');
      expect(html).toContain('disabled');
    });

    it('should include tooltips on buttons', () => {
      const result: RunResult = {
        summary: { total: 2, passed: 2, needsReview: 1, failed: 1, errored: 0 },
        tests: [
          { specPath: 'tests/login.md', status: 'failed', checkpoints: [], duration: 1000, generatedPath: '', baselineAvailable: true }
        ],
        currentBranch: 'feature/test',
        baseBranch: 'main',
        runId: 'abc123',
        timestamp: Date.now(),
        config: {} as any
      };
      // @ts-ignore
      const html = reporter.generateFilterButtonGroup(result);
      expect(html).toContain('class="tooltip"');
    });
  });
});
