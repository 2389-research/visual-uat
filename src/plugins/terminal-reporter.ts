// ABOUTME: Terminal reporter plugin that outputs test results to stdout with configurable verbosity.
// ABOUTME: Supports quiet (summary only), normal (per-test status), and verbose (full details) modes.

import { ReporterPlugin, ReporterOptions } from '../types/plugins';
import { RunResult } from '../orchestrator/types/results';
import * as path from 'path';

export class TerminalReporter implements ReporterPlugin {
  async generate(result: RunResult, options: ReporterOptions): Promise<void> {
    const verbosity = options.verbosity || 'normal';

    if (verbosity === 'quiet') {
      this.printQuiet(result, options);
    } else if (verbosity === 'normal') {
      this.printNormal(result, options);
    } else if (verbosity === 'verbose') {
      this.printVerbose(result, options);
    } else {
      // Fallback to normal for invalid values
      this.printNormal(result, options);
    }
  }

  private printQuiet(result: RunResult, options: ReporterOptions): void {
    console.log('Visual UAT Complete');

    const parts: string[] = [];
    if (result.summary.passed > 0) parts.push(`${result.summary.passed} passed`);
    if (result.summary.needsReview > 0) parts.push(`${result.summary.needsReview} needs review`);
    if (result.summary.failed > 0) parts.push(`${result.summary.failed} failed`);
    if (result.summary.errored > 0) parts.push(`${result.summary.errored} errored`);

    console.log('  ' + parts.join(', '));

    if (options.outputDir) {
      const reportPath = this.getReportPath(result.timestamp, result.runId, options.outputDir);
      console.log(`  Report: ${reportPath}`);
    }

    console.log(`  Run ID: ${result.runId}`);
  }

  private printNormal(result: RunResult, options: ReporterOptions): void {
    console.log(`Running tests: ${result.currentBranch} vs ${result.baseBranch}`);

    for (const test of result.tests) {
      const icon = this.getStatusIcon(test.status);
      const name = path.basename(test.specPath, '.md');
      const duration = this.formatDuration(test.duration);

      let line = `  ${icon} ${name} (${duration})`;

      if (test.status === 'needs-review' && test.checkpoints.length > 0) {
        const maxDiff = Math.max(...test.checkpoints.map(c => c.diffMetrics.pixelDiffPercent));
        line += ` - ${maxDiff.toFixed(1)}% diff, needs review`;
      } else if (test.status === 'failed' && test.error) {
        line += ` - ${test.error}`;
      }

      console.log(line);
    }

    console.log();
    this.printSummary(result);

    if (options.outputDir) {
      const reportPath = this.getReportPath(result.timestamp, result.runId, options.outputDir);
      console.log(`Report: ${reportPath}`);
    }
    console.log(`Run ID: ${result.runId}`);
  }

  private printVerbose(result: RunResult, options: ReporterOptions): void {
    console.log(`Running tests: ${result.currentBranch} vs ${result.baseBranch}`);

    for (const test of result.tests) {
      const icon = this.getStatusIcon(test.status);
      const name = path.basename(test.specPath, '.md');
      const duration = this.formatDuration(test.duration);

      console.log(`  ${icon} ${name} (${duration})`);

      if (!test.baselineAvailable) {
        console.log('      No baseline available');
      }

      for (const checkpoint of test.checkpoints) {
        const diffPercent = checkpoint.diffMetrics.pixelDiffPercent.toFixed(1);
        const evalIcon = checkpoint.evaluation.pass ? '✓' : '✗';

        console.log(`      ${evalIcon} ${checkpoint.name}: ${diffPercent}% diff`);
        console.log(`         ${checkpoint.evaluation.reason}`);
        console.log(`         Confidence: ${(checkpoint.evaluation.confidence * 100).toFixed(0)}%`);
      }

      if (test.error) {
        console.log(`      Error: ${test.error}`);
      }
    }

    console.log();
    this.printSummary(result);

    if (options.outputDir) {
      const reportPath = this.getReportPath(result.timestamp, result.runId, options.outputDir);
      console.log(`Report: ${reportPath}`);
    }
    console.log(`Run ID: ${result.runId}`);
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'passed': return '✓';
      case 'needs-review': return '⚠';
      case 'failed': return '✗';
      case 'errored': return '⊘';
      default: return '?';
    }
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private printSummary(result: RunResult): void {
    const parts: string[] = [];
    if (result.summary.passed > 0) parts.push(`${result.summary.passed} passed`);
    if (result.summary.needsReview > 0) parts.push(`${result.summary.needsReview} needs review`);
    if (result.summary.failed > 0) parts.push(`${result.summary.failed} failed`);
    if (result.summary.errored > 0) parts.push(`${result.summary.errored} errored`);

    console.log('Summary: ' + parts.join(', '));
  }

  private getReportPath(timestamp: number, runId: string, outputDir: string): string {
    const date = new Date(timestamp);
    const formatted = date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return path.join(outputDir, `${formatted}-${runId}.html`);
  }
}
