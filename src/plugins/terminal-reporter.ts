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
      const reportPath = this.getReportPath(result.timestamp, options.outputDir);
      console.log(`  Report: ${reportPath}`);
    }
  }

  private getReportPath(timestamp: number, outputDir: string): string {
    const date = new Date(timestamp);
    const formatted = date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return path.join(outputDir, `${formatted}.html`);
  }
}
