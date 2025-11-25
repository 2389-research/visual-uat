# HTML Report Header Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign HTML report header with clearer status indicator and enhanced filter buttons.

**Architecture:** Replace large summary boxes with two-row header: (1) colored status banner with metadata, (2) enhanced filter button group with counts, colors, tooltips, and disabled states.

**Tech Stack:** TypeScript, inline CSS, vanilla JavaScript for interactivity

---

## Task 1: Add Overall Run Status Calculation

**Files:**
- Modify: `src/plugins/html-reporter.ts:610` (add new method after existing methods)
- Test: `src/plugins/html-reporter.test.ts`

**Step 1: Write test for status calculation**

Add to `src/plugins/html-reporter.test.ts` (create if doesn't exist):

```typescript
import { HTMLReporter } from './html-reporter';
import { RunResult } from '../orchestrator/types/results';

describe('HTMLReporter - calculateOverallStatus', () => {
  let reporter: HTMLReporter;

  beforeEach(() => {
    reporter = new HTMLReporter();
  });

  it('should return "passed" when all tests passed', () => {
    const result: Partial<RunResult> = {
      summary: { passed: 5, needsReview: 0, failed: 0, errored: 0 }
    };
    // @ts-ignore - accessing private method for testing
    expect(reporter.calculateOverallStatus(result.summary)).toBe('passed');
  });

  it('should return "needs-review" when only passed and needs-review', () => {
    const result: Partial<RunResult> = {
      summary: { passed: 3, needsReview: 2, failed: 0, errored: 0 }
    };
    // @ts-ignore
    expect(reporter.calculateOverallStatus(result.summary)).toBe('needs-review');
  });

  it('should return "failed" when any tests failed', () => {
    const result: Partial<RunResult> = {
      summary: { passed: 3, needsReview: 1, failed: 1, errored: 0 }
    };
    // @ts-ignore
    expect(reporter.calculateOverallStatus(result.summary)).toBe('failed');
  });

  it('should return "failed" when any tests errored', () => {
    const result: Partial<RunResult> = {
      summary: { passed: 4, needsReview: 0, failed: 0, errored: 1 }
    };
    // @ts-ignore
    expect(reporter.calculateOverallStatus(result.summary)).toBe('failed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- html-reporter.test.ts`
Expected: FAIL (method doesn't exist yet)

**Step 3: Implement calculateOverallStatus method**

Add to `src/plugins/html-reporter.ts` after line 609:

```typescript
private calculateOverallStatus(summary: { passed: number; needsReview: number; failed: number; errored: number }): 'passed' | 'needs-review' | 'failed' {
  if (summary.failed > 0 || summary.errored > 0) {
    return 'failed';
  }
  if (summary.needsReview > 0) {
    return 'needs-review';
  }
  return 'passed';
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- html-reporter.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add src/plugins/html-reporter.ts src/plugins/html-reporter.test.ts
git commit -m "feat: add overall run status calculation

Calculate overall status based on test summary:
- passed: all tests passed
- needs-review: only passed + needs-review
- failed: any failed or errored tests

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Create Status Banner Generation Method

**Files:**
- Modify: `src/plugins/html-reporter.ts:610` (add new method)
- Test: `src/plugins/html-reporter.test.ts`

**Step 1: Write test for status banner HTML**

Add to `src/plugins/html-reporter.test.ts`:

```typescript
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
      summary: { passed: 5, needsReview: 0, failed: 0, errored: 0 },
      tests: []
    };
    // @ts-ignore
    const html = reporter.generateStatusBanner(result);
    expect(html).toContain('background: #10b981');
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
      summary: { passed: 3, needsReview: 2, failed: 0, errored: 0 },
      tests: []
    };
    // @ts-ignore
    const html = reporter.generateStatusBanner(result);
    expect(html).toContain('background: #f59e0b');
    expect(html).toContain('2 Tests Need Review');
  });

  it('should generate red banner for failed status', () => {
    const result: RunResult = {
      currentBranch: 'feature/test',
      baseBranch: 'main',
      runId: 'abc123',
      timestamp: 1700000000000,
      summary: { passed: 2, needsReview: 1, failed: 1, errored: 1 },
      tests: []
    };
    // @ts-ignore
    const html = reporter.generateStatusBanner(result);
    expect(html).toContain('background: #ef4444');
    expect(html).toContain('Tests Failed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- html-reporter.test.ts`
Expected: FAIL (method doesn't exist)

**Step 3: Implement generateStatusBanner method**

Add to `src/plugins/html-reporter.ts` after calculateOverallStatus:

```typescript
private generateStatusBanner(result: RunResult): string {
  const overallStatus = this.calculateOverallStatus(result.summary);

  const statusConfig = {
    'passed': {
      color: '#10b981',
      icon: '✓',
      text: 'All Tests Passed'
    },
    'needs-review': {
      color: '#f59e0b',
      icon: '⚠',
      text: `${result.summary.needsReview} Test${result.summary.needsReview === 1 ? '' : 's'} Need Review`
    },
    'failed': {
      color: '#ef4444',
      icon: '✗',
      text: 'Tests Failed'
    }
  };

  const config = statusConfig[overallStatus];
  const totalTests = result.summary.passed + result.summary.needsReview + result.summary.failed + result.summary.errored;

  return `
  <div class="status-banner" style="background: ${config.color}; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 20px;">
      <div style="flex: 1; min-width: 300px;">
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">
          <span style="margin-right: 10px;">${config.icon}</span>
          ${config.text}
        </div>
        <div style="font-size: 14px; opacity: 0.9;">
          Comparing: <code style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px;">${this.escapeHTML(result.currentBranch)}</code>
          →
          <code style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px;">${this.escapeHTML(result.baseBranch)}</code>
        </div>
      </div>
      <div style="text-align: right; opacity: 0.9; font-size: 14px;">
        <div><strong>${totalTests} tests</strong></div>
        <div title="${result.runId}">Run ID: ${result.runId.substring(0, 7)}</div>
        <div>${new Date(result.timestamp).toLocaleString()}</div>
      </div>
    </div>
  </div>`;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- html-reporter.test.ts`
Expected: PASS (all tests including new ones)

**Step 5: Commit**

```bash
git add src/plugins/html-reporter.ts src/plugins/html-reporter.test.ts
git commit -m "feat: add status banner generation

Generate colored status banner with:
- Overall run status (pass/needs-review/fail)
- Branch comparison with arrow visual
- Metadata (test count, run ID, timestamp)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add Tooltip Content Generation Methods

**Files:**
- Modify: `src/plugins/html-reporter.ts:610` (add methods)
- Test: `src/plugins/html-reporter.test.ts`

**Step 1: Write tests for tooltip generation**

Add to `src/plugins/html-reporter.test.ts`:

```typescript
describe('HTMLReporter - generateTooltipContent', () => {
  let reporter: HTMLReporter;

  beforeEach(() => {
    reporter = new HTMLReporter();
  });

  it('should generate percentage breakdown for "all" filter', () => {
    const summary = { passed: 2, needsReview: 1, failed: 1, errored: 1 };
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
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- html-reporter.test.ts`
Expected: FAIL (methods don't exist)

**Step 3: Implement tooltip generation methods**

Add to `src/plugins/html-reporter.ts`:

```typescript
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
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- html-reporter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/html-reporter.ts src/plugins/html-reporter.test.ts
git commit -m "feat: add tooltip content generation

Generate tooltips for filter buttons:
- All: percentage breakdown by status
- Status: test names list (max 4, ellipsis for more)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com)"
```

---

## Task 4: Create Enhanced Filter Button Group Generation

**Files:**
- Modify: `src/plugins/html-reporter.ts:484-498` (replace generateFilterBar)
- Test: `src/plugins/html-reporter.test.ts`

**Step 1: Write test for filter button HTML**

Add to `src/plugins/html-reporter.test.ts`:

```typescript
describe('HTMLReporter - generateFilterButtonGroup', () => {
  let reporter: HTMLReporter;

  beforeEach(() => {
    reporter = new HTMLReporter();
  });

  it('should generate buttons with counts', () => {
    const result: RunResult = {
      summary: { passed: 2, needsReview: 1, failed: 1, errored: 0 },
      tests: []
    } as any;
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
      summary: { passed: 5, needsReview: 0, failed: 0, errored: 0 },
      tests: []
    } as any;
    // @ts-ignore
    const html = reporter.generateFilterButtonGroup(result);
    expect(html).toContain('data-count="0" disabled');
  });

  it('should include tooltips on buttons', () => {
    const result: RunResult = {
      summary: { passed: 2, needsReview: 1, failed: 1, errored: 0 },
      tests: [
        { specPath: 'tests/login.md', status: 'failed' }
      ]
    } as any;
    // @ts-ignore
    const html = reporter.generateFilterButtonGroup(result);
    expect(html).toContain('title="');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- html-reporter.test.ts`
Expected: FAIL (method doesn't exist)

**Step 3: Implement generateFilterButtonGroup method**

Replace the `generateFilterBar` method (lines 484-498) with:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npm test -- html-reporter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/html-reporter.ts src/plugins/html-reporter.test.ts
git commit -m "feat: create enhanced filter button group

Replace plain filter bar with enhanced buttons:
- Show counts inline (e.g., 'Passed (2)')
- Add disabled state for zero counts
- Include tooltips with breakdowns
- Color-coded classes for styling

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Update CSS for New Design

**Files:**
- Modify: `src/plugins/html-reporter.ts:39-342` (CSS section)

**Step 1: Remove old summary box CSS**

Remove lines 58-98 (`.summary` and `.summary-box` styles).

**Step 2: Add status banner CSS**

After `.header` styles (around line 51), add:

```css
    .status-banner {
      /* Inline styles in HTML, no additional CSS needed */
    }
```

**Step 3: Update filter button CSS**

Replace `.filter-button` styles (lines 114-131) with:

```css
    .filter-button {
      padding: 10px 20px;
      border: 2px solid transparent;
      border-radius: 20px;
      background: #f3f4f6;
      color: #6b7280;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s;
      white-space: nowrap;
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
```

**Step 4: Verify no syntax errors**

Run: `npm run build`
Expected: No TypeScript errors

**Step 5: Commit**

```bash
git add src/plugins/html-reporter.ts
git commit -m "style: update CSS for new header design

Remove old summary box styles and add:
- Status banner styles (mostly inline)
- Enhanced filter button styles with colors
- Active/inactive/disabled states
- Color-coded classes for each status

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com)"
```

---

## Task 6: Update Filter Script for Disabled State

**Files:**
- Modify: `src/plugins/html-reporter.ts:500-608` (generateFilterScript)

**Step 1: Update filter script to skip disabled buttons**

In the `generateFilterScript` method, update the button click handler around line 538:

Replace:
```javascript
      filterButtons.forEach(button => {
        button.addEventListener('click', function() {
          currentStatusFilter = this.getAttribute('data-filter');
          setActiveButton(currentStatusFilter);
          applyFilters();
        });
      });
```

With:
```javascript
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
```

**Step 2: Remove summary box click handlers**

Remove lines 546-552 (summaryBoxes event listeners) as summary boxes no longer exist.

**Step 3: Verify build**

Run: `npm run build`
Expected: No errors

**Step 4: Commit**

```bash
git add src/plugins/html-reporter.ts
git commit -m "fix: update filter script for disabled buttons

Skip click handling on disabled filter buttons and
remove old summary box event listeners.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com)"
```

---

## Task 7: Integration - Update Main HTML Generation

**Files:**
- Modify: `src/plugins/html-reporter.ts:28-382` (generateHTML method)

**Step 1: Replace summary boxes with status banner**

In `generateHTML` method (around line 345-371), replace:

```typescript
    <div class="header">
      <h1>Visual UAT Report</h1>
      <div class="metadata">
        <div><strong>Branch:</strong> ${result.currentBranch}</div>
        <div><strong>Base:</strong> ${result.baseBranch}</div>
        <div><strong>Run ID:</strong> ${result.runId}</div>
        <div><strong>Date:</strong> ${new Date(result.timestamp).toLocaleString()}</div>
      </div>
      <div class="summary">
        <!-- 4 summary boxes -->
      </div>
    </div>
```

With:
```typescript
    ${this.generateStatusBanner(result)}
```

**Step 2: Update filter bar generation**

Replace line 373 `${filterBarHTML}` context - the variable is already correct from previous task.

Update the variable generation (around line 30):
```typescript
const filterBarHTML = this.generateFilterButtonGroup(result);
```

**Step 3: Verify build**

Run: `npm run build`
Expected: No errors

**Step 4: Run all tests**

Run: `npm test`
Expected: All 169+ tests pass

**Step 5: Commit**

```bash
git add src/plugins/html-reporter.ts
git commit -m "refactor: integrate new header components

Replace old header structure:
- Remove summary boxes and metadata section
- Use generateStatusBanner for Row 1
- Use generateFilterButtonGroup for Row 2

Completes header redesign implementation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com)"
```

---

## Task 8: Visual Verification with Dogfooding

**Files:**
- No file changes (verification only)

**Step 1: Build the changes**

Run: `npm run build`
Expected: Successful build

**Step 2: Generate fixture report**

Run: `npm run setup:dogfood`
Expected: Report generated in examples/demo-app/.visual-uat/reports/

**Step 3: Run dogfooding tests**

Run: `npm run test:dogfood`
Expected: Visual diff detected showing header changes

**Step 4: Open and review report**

Run: `open .visual-uat/reports/<latest-report>.html`
Expected: New header design visible with:
- Colored status banner
- Enhanced filter buttons with counts
- Disabled buttons grayed out
- Tooltips on hover

**Step 5: Document verification**

No commit needed - visual verification complete.

---

## Completion Checklist

- [ ] Task 1: Overall run status calculation
- [ ] Task 2: Status banner generation
- [ ] Task 3: Tooltip content generation
- [ ] Task 4: Enhanced filter button group
- [ ] Task 5: CSS updates
- [ ] Task 6: Filter script updates
- [ ] Task 7: Integration in main HTML generation
- [ ] Task 8: Visual verification with dogfooding

## Success Criteria

1. All tests pass (169+ tests)
2. Build succeeds with no TypeScript errors
3. Dogfooding workflow shows visual diff of header changes
4. New header displays:
   - Colored status banner with branch info
   - Filter buttons with counts
   - Disabled state for empty filters
   - Tooltips with appropriate content
5. All existing functionality preserved (search, test cards, image comparison)

## Notes

- Each task is independent and can be reviewed separately
- Follow TDD: test first, implement, verify
- Commit after each task for clean history
- Use dogfooding at the end to verify visual changes
