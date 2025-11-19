// ABOUTME: Integration test script for terminal and HTML reporters with realistic test data.
// ABOUTME: Creates sample run results and validates reporter output in all modes.

import { TerminalReporter } from '../src/plugins/terminal-reporter';
import { HTMLReporter } from '../src/plugins/html-reporter';
import { RunResult, TestResult, CheckpointResult } from '../src/orchestrator/types/results';
import { ReporterOptions } from '../src/types/plugins';
import * as fs from 'fs';
import * as path from 'path';

// Create realistic test data with various statuses
function createSampleRunResult(): RunResult {
  const tests: TestResult[] = [
    {
      specPath: 'tests/specs/home-page.md',
      generatedPath: 'tests/generated/home-page.spec.ts',
      status: 'passed',
      checkpoints: [
        {
          name: 'home-initial',
          baselineImage: 'baseline/home-initial.png',
          currentImage: 'current/home-initial.png',
          diffImage: 'diff/home-initial.png',
          diffMetrics: {
            pixelDiffPercent: 0.1,
            changedRegions: []
          },
          evaluation: {
            pass: true,
            confidence: 0.98,
            reason: 'No significant visual changes detected',
            needsReview: false
          }
        },
        {
          name: 'header-loaded',
          baselineImage: 'baseline/header-loaded.png',
          currentImage: 'current/header-loaded.png',
          diffImage: 'diff/header-loaded.png',
          diffMetrics: {
            pixelDiffPercent: 0.05,
            changedRegions: []
          },
          evaluation: {
            pass: true,
            confidence: 0.99,
            reason: 'Gradient rendering is identical',
            needsReview: false
          }
        }
      ],
      duration: 2340,
      baselineAvailable: true
    },
    {
      specPath: 'tests/specs/contact-form.md',
      generatedPath: 'tests/generated/contact-form.spec.ts',
      status: 'needs-review',
      checkpoints: [
        {
          name: 'form-initial',
          baselineImage: 'baseline/form-initial.png',
          currentImage: 'current/form-initial.png',
          diffImage: 'diff/form-initial.png',
          diffMetrics: {
            pixelDiffPercent: 8.5,
            changedRegions: [{ x: 100, y: 200, width: 150, height: 40 }]
          },
          evaluation: {
            pass: false,
            confidence: 0.65,
            reason: 'Button color changed from blue gradient to pink gradient. This appears to be an intentional design change that affects visual hierarchy.',
            needsReview: true
          }
        }
      ],
      duration: 1890,
      baselineAvailable: true
    },
    {
      specPath: 'tests/specs/dashboard.md',
      generatedPath: 'tests/generated/dashboard.spec.ts',
      status: 'failed',
      checkpoints: [],
      duration: 450,
      baselineAvailable: true,
      error: 'Navigation timeout: page did not load within 30s'
    },
    {
      specPath: 'tests/specs/new-feature.md',
      generatedPath: 'tests/generated/new-feature.spec.ts',
      status: 'passed',
      checkpoints: [
        {
          name: 'feature-view',
          baselineImage: '',
          currentImage: 'current/feature-view.png',
          diffImage: '',
          diffMetrics: {
            pixelDiffPercent: 0,
            changedRegions: []
          },
          evaluation: {
            pass: true,
            confidence: 1.0,
            reason: 'New checkpoint - no baseline to compare',
            needsReview: false
          }
        }
      ],
      duration: 1560,
      baselineAvailable: false
    }
  ];

  return {
    runId: 'integration-test-' + Date.now(),
    timestamp: Date.now(),
    baseBranch: 'main',
    currentBranch: 'feature/reporter',
    config: {} as any,
    tests,
    summary: {
      total: 4,
      passed: 2,
      failed: 1,
      errored: 0,
      needsReview: 1
    }
  };
}

async function testTerminalReporter(): Promise<void> {
  console.log('\n=== Testing Terminal Reporter ===\n');

  const reporter = new TerminalReporter();
  const result = createSampleRunResult();

  console.log('--- QUIET MODE ---');
  await reporter.generate(result, { verbosity: 'quiet' });

  console.log('\n--- NORMAL MODE ---');
  await reporter.generate(result, { verbosity: 'normal' });

  console.log('\n--- VERBOSE MODE ---');
  await reporter.generate(result, { verbosity: 'verbose' });
}

async function testHtmlReporter(): Promise<void> {
  console.log('\n=== Testing HTML Reporter ===\n');

  const reporter = new HTMLReporter();
  const result = createSampleRunResult();
  const outputDir = path.join(process.cwd(), '.visual-uat', 'integration-test');

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  const options: ReporterOptions = {
    outputDir,
    verbosity: 'normal'
  };

  await reporter.generate(result, options);

  console.log('✓ HTML report generated');
  console.log(`  Output: ${outputDir}`);

  // Verify the HTML file was created
  const files = fs.readdirSync(outputDir);
  const htmlFile = files.find(f => f.endsWith('.html'));

  if (htmlFile) {
    const htmlPath = path.join(outputDir, htmlFile);
    const stats = fs.statSync(htmlPath);
    console.log(`  File: ${htmlFile}`);
    console.log(`  Size: ${(stats.size / 1024).toFixed(2)} KB`);

    // Basic content validation
    const content = fs.readFileSync(htmlPath, 'utf-8');
    const checks = [
      { name: 'Contains title', test: content.includes('Visual UAT Report') },
      { name: 'Contains summary boxes', test: content.includes('summary-box') },
      { name: 'Contains test cards', test: content.includes('test-card') },
      { name: 'Contains checkpoint data', test: content.includes('checkpoint') },
      { name: 'Contains filter buttons', test: content.includes('filter-button') },
      { name: 'Contains search input', test: content.includes('search-input') },
      { name: 'Contains image slider', test: content.includes('class="slider"') }
    ];

    console.log('\n  Content validation:');
    for (const check of checks) {
      console.log(`    ${check.test ? '✓' : '✗'} ${check.name}`);
    }

    const allPassed = checks.every(c => c.test);
    if (allPassed) {
      console.log('\n  ✓ All HTML content checks passed');
    } else {
      console.log('\n  ✗ Some HTML content checks failed');
      process.exit(1);
    }
  } else {
    console.log('  ✗ No HTML file found');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  try {
    await testTerminalReporter();
    await testHtmlReporter();

    console.log('\n=== Integration Test Summary ===');
    console.log('✓ Terminal reporter works in all modes (quiet, normal, verbose)');
    console.log('✓ HTML reporter generates valid report file');
    console.log('✓ All reporter features validated');
    console.log('\nIntegration tests passed!');
  } catch (error) {
    console.error('\n✗ Integration test failed:', error);
    process.exit(1);
  }
}

main();
