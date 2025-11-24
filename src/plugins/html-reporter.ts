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
    const filterBarHTML = this.generateFilterButtonGroup(result);
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
    .status-banner {
      /* Inline styles in HTML, no additional CSS needed */
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
      gap: 0;
      flex-wrap: wrap;
    }
    .filter-button {
      padding: 10px 20px;
      border: 2px solid transparent;
      border-radius: 0;
      background: #f3f4f6;
      color: #6b7280;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
      white-space: nowrap;
    }
    .filter-button:first-child {
      border-top-left-radius: 20px;
      border-bottom-left-radius: 20px;
    }
    .filter-button:last-child {
      border-top-right-radius: 20px;
      border-bottom-right-radius: 20px;
    }
    .filter-button:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .filter-button:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    .filter-button.active {
      color: white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    /* Color-specific styles */
    .filter-all:not(.active) {
      background: #eff6ff;
      color: #1e40af;
      border-color: #bfdbfe;
    }
    .filter-all.active {
      background: #3b82f6;
    }
    .filter-passed:not(.active) {
      background: #d1fae5;
      color: #065f46;
      border-color: #6ee7b7;
    }
    .filter-passed.active {
      background: #10b981;
    }
    .filter-needs-review:not(.active) {
      background: #fef3c7;
      color: #92400e;
      border-color: #fcd34d;
    }
    .filter-needs-review.active {
      background: #f59e0b;
    }
    .filter-failed:not(.active) {
      background: #fee2e2;
      color: #991b1b;
      border-color: #fca5a5;
    }
    .filter-failed.active {
      background: #ef4444;
    }
    .filter-errored:not(.active) {
      background: #ffedd5;
      color: #9a3412;
      border-color: #fdba74;
    }
    .filter-errored.active {
      background: #f97316;
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
  ${this.generateStatusBanner(result)}

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

  private generateFilterButtonGroup(result: RunResult): string {
    const summary = result.summary;
    const total = summary.passed + summary.needsReview + summary.failed + summary.errored;

    const allTooltip = this.escapeHTML(this.generateAllTooltip(summary));
    const passedTooltip = summary.passed > 0 ? this.escapeHTML(this.generateStatusTooltip(result.tests, 'passed')) : '';
    const reviewTooltip = summary.needsReview > 0 ? this.escapeHTML(this.generateStatusTooltip(result.tests, 'needs-review')) : '';
    const failedTooltip = summary.failed > 0 ? this.escapeHTML(this.generateStatusTooltip(result.tests, 'failed')) : '';
    const erroredTooltip = summary.errored > 0 ? this.escapeHTML(this.generateStatusTooltip(result.tests, 'errored')) : '';

    return `
  <div class="filter-bar">
    <div class="filter-buttons">
      <button class="filter-button filter-all active" data-filter="all" data-count="${total}" title="${allTooltip}">
        All (${total})
      </button>
      <button class="filter-button filter-passed" data-filter="passed" data-count="${summary.passed}"
              ${summary.passed === 0 ? 'disabled' : ''} title="${passedTooltip}">
        Passed (${summary.passed})
      </button>
      <button class="filter-button filter-needs-review" data-filter="needs-review" data-count="${summary.needsReview}"
              ${summary.needsReview === 0 ? 'disabled' : ''} title="${reviewTooltip}">
        Needs Review (${summary.needsReview})
      </button>
      <button class="filter-button filter-failed" data-filter="failed" data-count="${summary.failed}"
              ${summary.failed === 0 ? 'disabled' : ''} title="${failedTooltip}">
        Failed (${summary.failed})
      </button>
      <button class="filter-button filter-errored" data-filter="errored" data-count="${summary.errored}"
              ${summary.errored === 0 ? 'disabled' : ''} title="${erroredTooltip}">
        Errored (${summary.errored})
      </button>
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
          if (this.hasAttribute('disabled')) {
            return; // Skip disabled buttons
          }
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

  private generateStatusBanner(result: RunResult): string {
    const overallStatus = this.calculateOverallStatus(result.summary);

    const statusConfig = {
      'passed': {
        borderColor: '#10b981',
        backgroundColor: '#d1fae5',
        textColor: '#065f46',
        icon: '✓',
        text: 'All Tests Passed'
      },
      'needs-review': {
        borderColor: '#f59e0b',
        backgroundColor: '#fef3c7',
        textColor: '#92400e',
        icon: '⚠',
        text: `${result.summary.needsReview} Test${result.summary.needsReview === 1 ? '' : 's'} Need Review`
      },
      'failed': {
        borderColor: '#ef4444',
        backgroundColor: '#fee2e2',
        textColor: '#991b1b',
        icon: '✗',
        text: 'Tests Failed'
      }
    };

    const config = statusConfig[overallStatus];
    const totalTests = result.summary.passed + result.summary.needsReview + result.summary.failed + result.summary.errored;

    return `
  <div class="status-banner" style="background: ${config.backgroundColor}; color: ${config.textColor}; border: 3px solid ${config.borderColor}; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px;">
      <div style="flex: 1; min-width: 300px;">
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">
          <span style="margin-right: 10px;">${config.icon}</span>
          ${config.text}
        </div>
        <div style="font-size: 14px; opacity: 0.8;">
          Comparing: <code style="background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 3px;">${this.escapeHTML(result.currentBranch)}</code>
          →
          <code style="background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 3px;">${this.escapeHTML(result.baseBranch)}</code>
        </div>
      </div>
      <div style="text-align: right; opacity: 0.8; font-size: 14px;">
        <div><strong>${totalTests} tests</strong></div>
        <div title="${this.escapeHTML(result.runId)}">Run ID: ${result.runId.substring(0, 7)}</div>
        <div>${new Date(result.timestamp).toLocaleString()}</div>
      </div>
    </div>
  </div>`;
  }

  private generateAllTooltip(summary: { passed: number; needsReview: number; failed: number; errored: number }): string {
    const total = summary.passed + summary.needsReview + summary.failed + summary.errored;
    const percent = (count: number) => total > 0 ? Math.round((count / total) * 100) : 0;

    return `Passed: ${summary.passed} (${percent(summary.passed)}%)
Needs Review: ${summary.needsReview} (${percent(summary.needsReview)}%)
Failed: ${summary.failed} (${percent(summary.failed)}%)
Errored: ${summary.errored} (${percent(summary.errored)}%)`;
  }

  private generateStatusTooltip(tests: TestResult[], status: string): string {
    const filteredTests = tests.filter(t => t.status === status);
    const names = filteredTests.map(t => path.basename(t.specPath, '.md'));

    if (names.length <= 4) {
      return names.join('\n');
    }

    return names.slice(0, 4).join('\n') + `\n...and ${names.length - 4} more`;
  }
}
