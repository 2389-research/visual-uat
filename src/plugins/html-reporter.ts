// ABOUTME: HTML reporter plugin that generates single-page HTML report with test results.
// ABOUTME: Includes interactive image comparison, filtering, and embedded styling.

import { ReporterPlugin, ReporterOptions } from '../types/plugins';
import { RunResult } from '../orchestrator/types/results';
import * as fs from 'fs';
import * as path from 'path';

export class HTMLReporter implements ReporterPlugin {
  async generate(result: RunResult, options: ReporterOptions): Promise<void> {
    const outputDir = options.outputDir || '.visual-uat/reports';
    fs.mkdirSync(outputDir, { recursive: true });

    const filename = this.generateFilename(result.timestamp, result.runId);
    const filepath = path.join(outputDir, filename);

    const html = this.generateHTML(result, options);
    fs.writeFileSync(filepath, html, 'utf-8');
  }

  private generateFilename(timestamp: number, runId: string): string {
    const date = new Date(timestamp);
    const formatted = date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
    return `${formatted}-${runId}.html`;
  }

  private generateHTML(result: RunResult, options: ReporterOptions): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual UAT Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
    }
    .metadata {
      display: flex;
      gap: 20px;
      margin-top: 10px;
      color: #666;
    }
    .summary {
      display: flex;
      gap: 15px;
      margin-top: 20px;
    }
    .summary-box {
      flex: 1;
      padding: 20px;
      border-radius: 6px;
      text-align: center;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .summary-box:hover {
      transform: scale(1.05);
    }
    .summary-box.passed {
      background: #10b981;
      color: white;
    }
    .summary-box.needs-review {
      background: #f59e0b;
      color: white;
    }
    .summary-box.failed {
      background: #ef4444;
      color: white;
    }
    .summary-box.errored {
      background: #6b7280;
      color: white;
    }
    .summary-box .count {
      font-size: 36px;
      font-weight: bold;
    }
    .summary-box .label {
      font-size: 14px;
      text-transform: uppercase;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Visual UAT Report</h1>
    <div class="metadata">
      <div><strong>Branch:</strong> ${result.currentBranch}</div>
      <div><strong>Base:</strong> ${result.baseBranch}</div>
      <div><strong>Run ID:</strong> ${result.runId}</div>
      <div><strong>Date:</strong> ${new Date(result.timestamp).toLocaleString()}</div>
    </div>
    <div class="summary">
      <div class="summary-box passed" data-filter="passed">
        <div class="count">${result.summary.passed}</div>
        <div class="label">Passed</div>
      </div>
      <div class="summary-box needs-review" data-filter="needs-review">
        <div class="count">${result.summary.needsReview}</div>
        <div class="label">Needs Review</div>
      </div>
      <div class="summary-box failed" data-filter="failed">
        <div class="count">${result.summary.failed}</div>
        <div class="label">Failed</div>
      </div>
      <div class="summary-box errored" data-filter="errored">
        <div class="count">${result.summary.errored}</div>
        <div class="label">Errored</div>
      </div>
    </div>
  </div>
</body>
</html>`;
  }
}
