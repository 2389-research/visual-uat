// ABOUTME: Handles the 'report' command, displaying test results from previous runs.
// ABOUTME: Currently a stub implementation - HTML reporter to be implemented later.

import { ResultStore } from '../services/result-store';
import { RunResult } from '../types/results';

export class ReportCommandHandler {
  constructor(private resultStore: ResultStore) {}

  async execute(runId?: number): Promise<number> {
    const result = runId
      ? await this.resultStore.loadResult(runId)
      : await this.resultStore.loadLatestResult();

    if (!result) {
      console.error('No test results found');
      return 1;
    }

    this.printConsoleReport(result);
    return 0;
  }

  private printConsoleReport(result: RunResult): void {
    console.log('\nVisual UAT Results:');
    console.log(`✓ ${result.summary.passed} passed`);

    if (result.summary.failed > 0) {
      console.log(`✗ ${result.summary.failed} failed`);
    }

    if (result.summary.needsReview > 0) {
      console.log(`⚠ ${result.summary.needsReview} need manual review`);
    }

    if (result.summary.errored > 0) {
      console.log(`⊗ ${result.summary.errored} errored`);
    }

    // Print failed tests
    if (result.summary.failed > 0) {
      console.log('\nFailed tests:');
      result.tests
        .filter(t => t.status === 'failed')
        .forEach(t => {
          console.log(`  - ${t.specPath}`);
        });
    }

    // Print tests needing review
    if (result.summary.needsReview > 0) {
      console.log('\nReview needed:');
      result.tests
        .filter(t => t.status === 'needs-review')
        .forEach(t => {
          console.log(`  - ${t.specPath}`);
        });
    }

    console.log(`\nFull report: .visual-uat/results/run-${result.timestamp}.json`);
    console.log('Note: HTML reporter coming soon!');
  }
}
