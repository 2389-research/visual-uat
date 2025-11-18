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
  </div>
</body>
</html>`;
  }
}
