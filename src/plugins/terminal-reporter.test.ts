// ABOUTME: Test suite for TerminalReporter plugin that verifies output formatting for all verbosity levels.
// ABOUTME: Uses console mocking to capture and verify terminal output.

import { TerminalReporter } from './terminal-reporter';
import { RunResult } from '../orchestrator/types/results';
import { ReporterOptions } from '../types/plugins';

describe('TerminalReporter', () => {
  let output: string[];
  let originalLog: typeof console.log;

  beforeEach(() => {
    output = [];
    originalLog = console.log;
    console.log = jest.fn((...args) => {
      output.push(args.join(' '));
    });
  });

  afterEach(() => {
    console.log = originalLog;
  });

  describe('quiet mode', () => {
    it('should show only summary in quiet mode', async () => {
      const reporter = new TerminalReporter();
      const result: RunResult = {
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
            specPath: 'tests/broken.md',
            generatedPath: 'tests/generated/broken.spec.ts',
            status: 'failed',
            checkpoints: [],
            duration: 800,
            baselineAvailable: true
          }
        ],
        summary: {
          total: 2,
          passed: 1,
          failed: 1,
          errored: 0,
          needsReview: 0
        }
      };

      const options: ReporterOptions = {
        verbosity: 'quiet',
        outputDir: '.visual-uat/reports'
      };

      await reporter.generate(result, options);

      // Should show summary line
      expect(output.some(line => line.includes('Visual UAT Complete'))).toBe(true);
      expect(output.some(line => line.includes('1 passed'))).toBe(true);
      expect(output.some(line => line.includes('1 failed'))).toBe(true);

      // Should NOT show individual test lines
      expect(output.some(line => line.includes('login'))).toBe(false);
      expect(output.some(line => line.includes('broken'))).toBe(false);
    });

    it('should show report path if outputDir provided', async () => {
      const reporter = new TerminalReporter();
      const result: RunResult = {
        timestamp: 1700000000000,
        baseBranch: 'main',
        currentBranch: 'feature/test',
        config: {} as any,
        tests: [],
        summary: { total: 0, passed: 0, failed: 0, errored: 0, needsReview: 0 }
      };

      await reporter.generate(result, { verbosity: 'quiet', outputDir: '.visual-uat/reports' });

      expect(output.some(line => line.includes('Report:'))).toBe(true);
      expect(output.some(line => line.includes('.visual-uat/reports'))).toBe(true);
    });
  });
});
