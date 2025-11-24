// ABOUTME: HTML reporter plugin that generates single-page HTML report with test results.
// ABOUTME: Includes interactive image comparison, filtering, and embedded styling.
// NOTE: Images use file path references. Base64 embedding deferred to future enhancement.

import { ReporterPlugin, ReporterOptions } from '../types/plugins';
import { RunResult, TestResult, CheckpointResult } from '../orchestrator/types/results';
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
    const testCardsHTML = result.tests.map(test => this.generateTestCard(test)).join('\n');
    const filterBarHTML = this.generateFilterBar();
    const scriptHTML = this.generateFilterScript();

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
    .filter-bar {
      background: white;
      padding: 15px 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: flex;
      gap: 15px;
      align-items: center;
      flex-wrap: wrap;
    }
    .filter-buttons {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .filter-button {
      padding: 8px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 6px;
      background: white;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .filter-button:hover {
      border-color: #9ca3af;
    }
    .filter-button.active {
      border-color: #3b82f6;
      background: #eff6ff;
      color: #1e40af;
    }
    .search-box {
      flex: 1;
      min-width: 200px;
    }
    #search-input {
      width: 100%;
      padding: 8px 12px;
      border: 2px solid #e5e7eb;
      border-radius: 6px;
      font-size: 14px;
    }
    #search-input:focus {
      outline: none;
      border-color: #3b82f6;
    }
    .tests {
      margin-top: 20px;
    }
    .test-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 15px;
      border-left: 4px solid #ccc;
    }
    .test-card.passed {
      border-left-color: #10b981;
    }
    .test-card.needs-review {
      border-left-color: #f59e0b;
    }
    .test-card.failed {
      border-left-color: #ef4444;
    }
    .test-card.errored {
      border-left-color: #6b7280;
    }
    .test-card.hidden {
      display: none;
    }
    .test-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
    }
    .test-name {
      font-size: 18px;
      font-weight: 600;
    }
    .test-status {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .test-status.passed {
      background: #d1fae5;
      color: #065f46;
    }
    .test-status.needs-review {
      background: #fed7aa;
      color: #92400e;
    }
    .test-status.failed {
      background: #fee2e2;
      color: #991b1b;
    }
    .test-status.errored {
      background: #e5e7eb;
      color: #1f2937;
    }
    .test-duration {
      color: #6b7280;
      font-size: 14px;
    }
    .test-body {
      margin-top: 15px;
      display: none;
    }
    .test-card.expanded .test-body {
      display: block;
    }
    .checkpoint {
      padding: 20px;
      background: #f9fafb;
      border-radius: 6px;
      margin-bottom: 15px;
    }
    .checkpoint-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    .checkpoint-header h3 {
      margin: 0;
      font-size: 16px;
    }
    .checkpoint-metrics {
      display: flex;
      gap: 15px;
      color: #6b7280;
      font-size: 14px;
    }
    .checkpoint-metrics .pass {
      color: #10b981;
      font-weight: bold;
    }
    .checkpoint-metrics .fail {
      color: #ef4444;
      font-weight: bold;
    }
    .evaluation {
      margin-bottom: 15px;
      padding: 10px;
      background: white;
      border-radius: 4px;
      font-size: 14px;
    }
    .image-comparison {
      margin: 15px 0;
    }
    .view-modes {
      display: flex;
      gap: 10px;
      justify-content: center;
      margin-bottom: 15px;
    }
    .view-modes button {
      padding: 8px 16px;
      border: 2px solid #e5e7eb;
      background: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    .view-modes button:hover {
      border-color: #9ca3af;
    }
    .view-modes button.active {
      background: #3b82f6;
      color: white;
      border-color: #3b82f6;
    }
    .comparison-container {
      position: relative;
      width: 100%;
      max-width: 800px;
      margin: 0 auto;
      background: #000;
      border-radius: 4px;
      overflow: hidden;
    }
    .comparison-container img {
      width: 100%;
      display: block;
    }
    .current-img {
      position: absolute;
      top: 0;
      left: 0;
    }
    .slider {
      width: 100%;
      max-width: 800px;
      display: block;
      margin: 10px auto;
      cursor: pointer;
    }
    .diff-img {
      width: 100%;
      max-width: 800px;
      display: block;
      margin: 0 auto;
      border-radius: 4px;
    }
    .side-by-side-container {
      display: flex;
      gap: 20px;
      max-width: 1600px;
      margin: 0 auto;
      justify-content: center;
      flex-wrap: wrap;
    }
    .side-by-side-image {
      flex: 1;
      min-width: 400px;
      max-width: 800px;
      background: #f5f5f5;
      border-radius: 8px;
      padding: 10px;
    }
    .side-by-side-image img {
      width: 100%;
      display: block;
      border-radius: 4px;
    }
    .image-label {
      font-weight: 600;
      margin-bottom: 8px;
      padding: 8px;
      background: #e5e7eb;
      border-radius: 4px;
      text-align: center;
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

  ${filterBarHTML}

  <div class="tests">
    ${testCardsHTML}
  </div>

  ${scriptHTML}
</body>
</html>`;
  }

  private generateTestCard(test: TestResult): string {
    const name = this.escapeHTML(path.basename(test.specPath, '.md'));
    const status = this.escapeHTML(test.status);
    const duration = this.formatDuration(test.duration);
    const autoExpand = test.status === 'needs-review' || test.status === 'failed';

    const checkpointsHTML = test.checkpoints.length > 0
      ? `<div class="test-body">${test.checkpoints.map(cp => this.generateCheckpointSection(cp)).join('\n')}</div>`
      : '';

    const expandedClass = autoExpand ? ' expanded' : '';

    return `
    <div class="test-card ${status}${expandedClass}" data-status="${status}">
      <div class="test-header">
        <div>
          <span class="test-name">${name}</span>
          <span class="test-duration"> ${duration}</span>
        </div>
        <span class="test-status ${status}">${status}</span>
      </div>
      ${checkpointsHTML}
    </div>
  `;
  }

  private generateCheckpointSection(checkpoint: CheckpointResult): string {
    const diffPercent = checkpoint.diffMetrics.pixelDiffPercent.toFixed(1);
    const evalIcon = checkpoint.evaluation.pass ? '✓' : '✗';
    const evalClass = checkpoint.evaluation.pass ? 'pass' : 'fail';
    const confidence = (checkpoint.evaluation.confidence * 100).toFixed(0);

    return `
    <div class="checkpoint">
      <div class="checkpoint-header">
        <h3>${this.escapeHTML(checkpoint.name)}</h3>
        <div class="checkpoint-metrics">
          <span class="${evalClass}">${evalIcon}</span>
          <span>${diffPercent}% diff</span>
          <span>${confidence}% confidence</span>
        </div>
      </div>

      <div class="evaluation">
        <strong>Evaluation:</strong> ${this.escapeHTML(checkpoint.evaluation.reason)}
      </div>

      ${this.generateImageComparison(checkpoint)}
    </div>
  `;
  }

  private generateImageComparison(checkpoint: CheckpointResult): string {
    return `
    <div class="image-comparison">
      <div class="view-modes">
        <button onclick="setViewMode(this, 'overlay')" class="active">Overlay</button>
        <button onclick="setViewMode(this, 'diff')">Diff</button>
        <button onclick="setViewMode(this, 'side-by-side')">Side by Side</button>
      </div>

      <div class="comparison-container">
        <img src="${this.escapeHTML(checkpoint.baselineImage)}" class="baseline-img" alt="Baseline" loading="lazy">
        <img src="${this.escapeHTML(checkpoint.currentImage)}" class="current-img" alt="Current" loading="lazy" style="clip-path: inset(0 50% 0 0);">
      </div>
      <input type="range" min="0" max="100" value="50" class="slider"
             onchange="updateSlider(this)" oninput="updateSlider(this)">

      <img src="${this.escapeHTML(checkpoint.diffImage)}" class="diff-img" style="display: none;" alt="Diff" loading="lazy">

      <div class="side-by-side-container" style="display: none;">
        <div class="side-by-side-image">
          <div class="image-label">Baseline</div>
          <img src="${this.escapeHTML(checkpoint.baselineImage)}" alt="Baseline" loading="lazy">
        </div>
        <div class="side-by-side-image">
          <div class="image-label">Current</div>
          <img src="${this.escapeHTML(checkpoint.currentImage)}" alt="Current" loading="lazy">
        </div>
      </div>
    </div>
  `;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }

  private escapeHTML(str: string): string {
    const htmlEscapeMap: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, char => htmlEscapeMap[char]);
  }

  private generateFilterBar(): string {
    return `
  <div class="filter-bar">
    <div class="filter-buttons">
      <button class="filter-button active" data-filter="all">All</button>
      <button class="filter-button" data-filter="passed">Passed</button>
      <button class="filter-button" data-filter="needs-review">Needs Review</button>
      <button class="filter-button" data-filter="failed">Failed</button>
      <button class="filter-button" data-filter="errored">Errored</button>
    </div>
    <div class="search-box">
      <input type="text" id="search-input" placeholder="Search tests by name...">
    </div>
  </div>`;
  }

  private generateFilterScript(): string {
    return `
  <script>
    (function() {
      let currentStatusFilter = 'all';
      let currentSearchText = '';

      const filterButtons = document.querySelectorAll('.filter-button');
      const summaryBoxes = document.querySelectorAll('.summary-box');
      const searchInput = document.getElementById('search-input');
      const testCards = document.querySelectorAll('.test-card');

      function applyFilters() {
        testCards.forEach(card => {
          const cardStatus = card.getAttribute('data-status');
          const cardName = card.querySelector('.test-name').textContent.toLowerCase();

          const matchesStatus = currentStatusFilter === 'all' || cardStatus === currentStatusFilter;
          const matchesSearch = currentSearchText === '' || cardName.includes(currentSearchText.toLowerCase());

          if (matchesStatus && matchesSearch) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });
      }

      function setActiveButton(filterValue) {
        filterButtons.forEach(btn => {
          if (btn.getAttribute('data-filter') === filterValue) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      }

      filterButtons.forEach(button => {
        button.addEventListener('click', function() {
          currentStatusFilter = this.getAttribute('data-filter');
          setActiveButton(currentStatusFilter);
          applyFilters();
        });
      });

      summaryBoxes.forEach(box => {
        box.addEventListener('click', function() {
          currentStatusFilter = this.getAttribute('data-filter');
          setActiveButton(currentStatusFilter);
          applyFilters();
        });
      });

      searchInput.addEventListener('input', function() {
        currentSearchText = this.value;
        applyFilters();
      });

      // Toggle test card expand/collapse
      testCards.forEach(card => {
        const header = card.querySelector('.test-header');
        if (header) {
          header.addEventListener('click', function() {
            card.classList.toggle('expanded');
          });
        }
      });
    })();

    // Image comparison slider
    function updateSlider(slider) {
      const container = slider.previousElementSibling;
      const currentImg = container.querySelector('.current-img');
      const value = slider.value;
      currentImg.style.clipPath = 'inset(0 ' + (100 - value) + '% 0 0)';
    }

    // View mode switching
    function setViewMode(btn, mode) {
      const comparison = btn.closest('.image-comparison');
      const container = comparison.querySelector('.comparison-container');
      const slider = comparison.querySelector('.slider');
      const diffImg = comparison.querySelector('.diff-img');
      const sideBySide = comparison.querySelector('.side-by-side-container');
      const buttons = comparison.querySelectorAll('.view-modes button');

      // Update active button
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (mode === 'overlay') {
        container.style.display = 'block';
        slider.style.display = 'block';
        diffImg.style.display = 'none';
        sideBySide.style.display = 'none';
      } else if (mode === 'diff') {
        container.style.display = 'none';
        slider.style.display = 'none';
        diffImg.style.display = 'block';
        sideBySide.style.display = 'none';
      } else if (mode === 'side-by-side') {
        container.style.display = 'none';
        slider.style.display = 'none';
        diffImg.style.display = 'none';
        sideBySide.style.display = 'flex';
      }
    }
  </script>`;
  }

  private calculateOverallStatus(summary: { passed: number; needsReview: number; failed: number; errored: number }): 'passed' | 'needs-review' | 'failed' {
    if (summary.failed > 0 || summary.errored > 0) {
      return 'failed';
    }
    if (summary.needsReview > 0) {
      return 'needs-review';
    }
    return 'passed';
  }
}
