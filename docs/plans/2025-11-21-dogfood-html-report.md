# Dogfooding HTML Report Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create visual tests that use visual-uat to test its own HTML report structure, serving as both dogfooding and a practical example.

**Architecture:** Two-stage workflow: (1) Generate fixture HTML report by running visual-uat on demo-app, (2) Test the report structure using root-level visual-uat config that serves the reports directory.

**Tech Stack:** visual-uat, npx serve, Playwright, existing HTML reporter

---

## Task 1: Update Root Configuration for Report Testing

**Files:**
- Modify: `visual-uat.config.js:8`

**Step 1: Update targetRunner to serve reports directory**

Edit `visual-uat.config.js` line 8, changing from:
```javascript
targetRunner: '@visual-uat/playwright-runner',
```

To:
```javascript
targetRunner: {
  plugin: '@visual-uat/web-runner',
  startCommand: 'npx serve -l $PORT examples/demo-app/.visual-uat/reports'
},
```

**Step 2: Verify configuration is valid**

Run: `node -e "require('./visual-uat.config.js')"`
Expected: No errors (validates syntax)

**Step 3: Commit configuration update**

```bash
git add visual-uat.config.js
git commit -m "config: serve demo-app reports for dogfooding tests

Configure root visual-uat to serve generated HTML reports from
demo-app for testing report structure.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Create HTML Report Test Specification

**Files:**
- Create: `tests/specs/html-report-structure.md`

**Step 1: Create test spec file**

Create `tests/specs/html-report-structure.md` with:

```markdown
# HTML Report Structure

Test the visual structure and layout of the generated HTML report.

## Test Steps
1. Navigate to the report page (latest.html)
2. Wait for page to fully render
3. Capture full-page screenshot

## Expected Behavior
- Report displays with header showing overall status
- Status summary section shows pass/fail/review counts
- Filter buttons are visible and styled
- Test results list renders with proper layout
- All sections are visible and properly styled
- No layout breaks or rendering issues
```

**Step 2: Verify spec file exists**

Run: `cat tests/specs/html-report-structure.md | head -5`
Expected: Shows first 5 lines of spec

**Step 3: Commit test specification**

```bash
git add tests/specs/html-report-structure.md
git commit -m "test: add HTML report structure spec

Simple happy-path spec for dogfooding visual-uat's HTML report
output. Tests overall layout and rendering.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add NPM Scripts for Dogfooding Workflow

**Files:**
- Modify: `package.json:7-8` (in scripts section)

**Step 1: Add dogfooding scripts to package.json**

In `package.json`, add these two scripts to the `"scripts"` section:

```json
"setup:dogfood": "cd examples/demo-app && npx visual-uat run",
"test:dogfood": "npx visual-uat run"
```

Place them alphabetically after "dev" and before "lint" (if it exists), or at the end of the scripts section.

**Step 2: Verify scripts are valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8'))"`
Expected: No errors (validates JSON syntax)

**Step 3: Verify script commands are accessible**

Run: `npm run setup:dogfood --help 2>&1 | head -2`
Expected: Shows npm help or command info (validates script exists)

**Step 4: Commit npm scripts**

```bash
git add package.json
git commit -m "chore: add dogfooding npm scripts

- setup:dogfood: generates HTML report from demo-app
- test:dogfood: runs visual tests on generated reports

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Generate Test from Specification

**Files:**
- Create: `tests/generated/html-report-structure.spec.ts` (auto-generated)

**Step 1: Run test generator**

Run: `npx visual-uat generate`
Expected:
```
Generating tests from specifications...
Generated: tests/generated/html-report-structure.spec.ts
Generation complete: 1 test(s) generated
```

**Step 2: Verify generated test file exists**

Run: `ls -lh tests/generated/html-report-structure.spec.ts`
Expected: File exists with reasonable size (> 100 bytes)

**Step 3: Review generated test structure**

Run: `cat tests/generated/html-report-structure.spec.ts | grep -E "(test\(|describe\()" | head -3`
Expected: Shows test structure with describe and test blocks

**Step 4: Commit generated test**

```bash
git add tests/generated/html-report-structure.spec.ts
git commit -m "test: generate HTML report structure test

Generated Playwright test from spec using visual-uat CLI.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Generate Fixture Report from Demo-App

**Files:**
- Create: `examples/demo-app/.visual-uat/reports/latest.html` (generated artifact)

**Step 1: Run setup:dogfood to generate fixture report**

Run: `npm run setup:dogfood`
Expected:
```
Running visual acceptance tests...
[test execution output]
Report generated: examples/demo-app/.visual-uat/reports/latest.html
```

Note: This may take 30-60 seconds as it runs the full demo-app test suite.

**Step 2: Verify report was generated**

Run: `ls -lh examples/demo-app/.visual-uat/reports/latest.html`
Expected: HTML file exists with reasonable size (> 10KB)

**Step 3: Verify report contains expected content**

Run: `grep -q "visual-uat Report" examples/demo-app/.visual-uat/reports/latest.html && echo "VALID" || echo "INVALID"`
Expected: Output "VALID"

**Step 4: Document fixture generation**

No commit needed - generated artifact is not committed to git.
The fixture report at `examples/demo-app/.visual-uat/reports/` should be in .gitignore.

---

## Task 6: Establish Baseline for Dogfooding Tests

**Files:**
- Create: `.visual-uat/screenshots/base/html-report-structure/*.png` (baseline screenshots)
- Create: `.visual-uat/reports/latest.html` (test run report)

**Step 1: Run dogfooding tests to capture baseline**

Run: `npm run test:dogfood`
Expected:
```
Running visual acceptance tests...
[Server starts on port 34567]
[Tests execute]
[Screenshots captured]
Report generated: .visual-uat/reports/latest.html
```

Note: First run establishes the baseline, so all tests will pass.

**Step 2: Verify baseline screenshots were captured**

Run: `ls -lh .visual-uat/screenshots/base/html-report-structure/*.png 2>/dev/null | wc -l`
Expected: At least 1 screenshot file exists

**Step 3: Verify test report was generated**

Run: `ls -lh .visual-uat/reports/latest.html`
Expected: HTML report exists

**Step 4: Open report to verify success**

Run: `open .visual-uat/reports/latest.html` (or appropriate open command)
Expected: Report opens in browser showing all tests passed

**Step 5: Commit baseline screenshots**

```bash
git add .visual-uat/screenshots/
git commit -m "test: establish dogfooding baseline screenshots

First run of HTML report structure tests captures baseline.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Verify Full Dogfooding Workflow

**Files:**
- No file changes (verification only)

**Step 1: Clean and regenerate fixture**

Run: `npm run setup:dogfood`
Expected: Completes successfully, regenerates demo-app report

**Step 2: Re-run dogfooding tests**

Run: `npm run test:dogfood`
Expected: All tests pass with 0 visual differences (comparing against baseline)

**Step 3: Verify report shows no differences**

Run: `open .visual-uat/reports/latest.html`
Expected: Report shows all tests passed with no visual changes detected

**Step 4: Document verification in commit message**

```bash
git commit --allow-empty -m "test: verify dogfooding workflow end-to-end

Confirmed full workflow:
1. setup:dogfood generates fixture report
2. test:dogfood runs visual tests on report
3. Tests pass with no visual differences

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Update README with Dogfooding Example

**Files:**
- Modify: `README.md` (add new section)

**Step 1: Add dogfooding section to README**

Add a new section to `README.md` after the "Target Runner Examples" section:

```markdown
## Dogfooding: Testing the HTML Reporter

Visual-uat tests its own HTML report structure to catch visual regressions.

### Generate Fixture Report
```bash
npm run setup:dogfood
```

This runs visual-uat on the demo-app, generating an HTML report at `examples/demo-app/.visual-uat/reports/latest.html`.

### Test Report Structure
```bash
npm run test:dogfood
```

This serves the generated reports and captures screenshots to verify the HTML structure hasn't broken.

### Use Case
When modifying `src/plugins/html-reporter.ts`, run both commands to see visual diffs of your changes.
```

**Step 2: Verify README renders correctly**

Run: `cat README.md | grep -A 10 "## Dogfooding"`
Expected: Shows the new section with proper formatting

**Step 3: Commit README update**

```bash
git add README.md
git commit -m "docs: add dogfooding workflow to README

Document how to use visual-uat to test its own HTML reports.
Includes setup and testing commands with use case explanation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Completion Checklist

- [ ] Task 1: Root config updated to serve reports directory
- [ ] Task 2: Test spec created at tests/specs/html-report-structure.md
- [ ] Task 3: npm scripts added (setup:dogfood, test:dogfood)
- [ ] Task 4: Test generated from spec
- [ ] Task 5: Fixture report generated from demo-app
- [ ] Task 6: Baseline screenshots captured and committed
- [ ] Task 7: Full workflow verified end-to-end
- [ ] Task 8: README updated with dogfooding documentation

## Success Criteria

1. `npm run setup:dogfood` successfully generates HTML report
2. `npm run test:dogfood` captures screenshots and compares against baseline
3. Making changes to HTML reporter triggers visual diffs
4. Documentation clearly explains the dogfooding workflow

## Notes for Engineer

- The fixture report is not committed to git (in .gitignore)
- Baseline screenshots ARE committed for comparison
- If demo-app tests fail, setup:dogfood will fail - ensure demo-app is working first
- The targetRunner config now serves static files instead of running npm start
- This serves as a practical example of testing HTML content with visual-uat
