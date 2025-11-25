# Reporter System

The Visual UAT reporter system provides multiple ways to view and interact with test results. The system includes two main reporter types:

1. **Terminal Reporter** - Real-time console output during test execution
2. **HTML Reporter** - Interactive single-page HTML report with image comparison

## Terminal Reporter

The terminal reporter outputs test results to stdout with three configurable verbosity levels.

### Verbosity Modes

#### Quiet Mode (`--quiet` or `-q`)

Minimal output showing only the summary:

```text
Visual UAT Complete
  2 passed, 1 needs review, 1 failed
  Report: .visual-uat/reports/2025-11-18-22-51-55-run-abc123.html
  Run ID: run-abc123
```

Use quiet mode for:
- CI/CD pipelines where you only need pass/fail status
- Scripting scenarios where detailed output is not needed
- Quick validation runs

#### Normal Mode (default)

Shows test-by-test status with summary:

```text
Running tests: feature/new-ui vs main
  ✓ home-page (2.3s)
  ⚠ contact-form (1.9s) - 8.5% diff, needs review
  ✗ dashboard (450ms) - Navigation timeout: page did not load within 30s
  ✓ new-feature (1.6s)

Summary: 2 passed, 1 needs review, 1 failed
Report: .visual-uat/reports/2025-11-18-22-51-55-run-abc123.html
Run ID: run-abc123
```

Use normal mode for:
- Interactive development
- Getting a quick overview of which tests passed/failed
- Most day-to-day usage

#### Verbose Mode (`--verbose` or `-v`)

Shows detailed checkpoint-level information:

```text
Running tests: feature/new-ui vs main
  ✓ home-page (2.3s)
      ✓ home-initial: 0.1% diff
         No significant visual changes detected
         Confidence: 98%
      ✓ header-loaded: 0.1% diff
         Gradient rendering is identical
         Confidence: 99%
  ⚠ contact-form (1.9s)
      ✗ form-initial: 8.5% diff
         Button color changed from blue gradient to pink gradient.
         This appears to be an intentional design change.
         Confidence: 65%
  ✗ dashboard (450ms)
      Error: Navigation timeout: page did not load within 30s
  ✓ new-feature (1.6s)
      No baseline available
      ✓ feature-view: 0.0% diff
         New checkpoint - no baseline to compare
         Confidence: 100%

Summary: 2 passed, 1 needs review, 1 failed
Report: .visual-uat/reports/2025-11-18-22-51-55-run-abc123.html
Run ID: run-abc123
```

Use verbose mode for:
- Debugging test failures
- Understanding why a test needs review
- Seeing the LLM evaluator's reasoning
- Detailed analysis of visual differences

### Status Icons

- `✓` - Test passed (all checkpoints approved)
- `⚠` - Test needs review (visual changes require human judgment)
- `✗` - Test failed (execution error or rejected visual changes)

## HTML Reporter

The HTML reporter generates an interactive single-page report with all test results, screenshots, and visual comparisons.

### Features

#### Summary Dashboard

Four clickable summary boxes at the top show the count of:
- Passed tests (green)
- Tests needing review (orange)
- Failed tests (red)
- Errored tests (gray)

Click any summary box to filter tests by that status.

#### Filtering

**Status Filters:**
- All
- Passed
- Needs Review
- Failed
- Errored

**Search:**
- Live search by test name
- Filters update as you type

#### Test Cards

Each test is displayed in an expandable card showing:
- Test name (from spec filename)
- Status icon and badge
- Test duration
- Error message (if failed)
- Checkpoint details (when expanded)

Click the test header to expand/collapse checkpoint details.

#### Checkpoint Details

For each checkpoint, the report shows:
- Checkpoint name
- Diff percentage
- LLM evaluation result and reasoning
- Confidence score
- Image comparison viewer

#### Image Comparison

Three viewing modes for comparing baseline vs current screenshots:

**Overlay Mode (default):**
- Interactive slider to reveal baseline vs current
- Drag the slider left/right to compare
- Perfect for spotting exact pixel differences

**Diff Mode:**
- Shows the pixel-by-pixel diff image
- Changed pixels highlighted in red
- Unchanged pixels shown in gray

**Side-by-Side Mode (Coming Soon):**
- Planned feature: Baseline and current screenshots side by side
- Will be useful for comparing overall layout

### Report File Location

HTML reports are saved to `.visual-uat/reports/` with the filename format:

```text
YYYY-MM-DD-HH-mm-ss-<runId>.html
```

Example:
```text
.visual-uat/reports/2025-11-18-22-51-55-run-abc123.html
```

### Images in Reports

HTML reports currently use relative file path references for images (baseline, current, and diff screenshots). The report must be opened from a location where these paths are accessible.

**Future Enhancement:** Base64 image embedding is planned to create fully self-contained HTML reports that can be viewed from any location.

## CLI Flags

### Reporter-Related Flags

```bash
# Quiet mode - minimal output
visual-uat run --quiet
visual-uat run -q

# Verbose mode - detailed output
visual-uat run --verbose
visual-uat run -v

# Skip HTML report generation
visual-uat run --no-html

# Auto-open HTML report in browser after generation
visual-uat run --open
visual-uat run -o

# Combine flags
visual-uat run --verbose --open
```

### Other Useful Flags

```bash
# Force run all tests (ignore change detection)
visual-uat run --all

# Specify base branch
visual-uat run --base main

# Stop on first error
visual-uat run --fail-fast

# Keep worktrees for debugging
visual-uat run --keep-worktrees
```

## Configuration

Reporter options can be configured in `visual-uat.config.js`:

```javascript
module.exports = {
  baseBranch: 'main',
  specsDir: './tests/specs',
  generatedDir: './tests/generated',

  // Reporter configuration
  reporter: {
    // Default terminal verbosity (quiet | normal | verbose)
    verbosity: 'normal',

    // Output directory for HTML reports
    outputDir: '.visual-uat/reports',

    // Auto-open HTML report in browser
    autoOpen: false
  },

  // Plugin configuration
  plugins: {
    testGenerator: '@visual-uat/stub-generator',
    targetRunner: '@visual-uat/web-runner',
    differ: '@visual-uat/smart-differ',
    evaluator: '@visual-uat/claude-evaluator'
  }
};
```

## Example Usage

### Basic Usage

```bash
# Run tests with default (normal) output and HTML report
visual-uat run

# Run tests quietly, useful for CI
visual-uat run --quiet

# Run with verbose output to see all details
visual-uat run --verbose
```

### Opening Reports

```bash
# Auto-open report in browser after generation
visual-uat run --open

# View a specific report by run ID
visual-uat report run-abc123

# View the most recent report
visual-uat report
```

### Development Workflow

```bash
# During active development - verbose output, auto-open report
visual-uat run --verbose --open

# For quick validation - quiet mode, skip HTML
visual-uat run --quiet --no-html

# Debugging specific failures - keep worktrees, verbose output
visual-uat run --verbose --keep-worktrees
```

### CI/CD Integration

```bash
# CI pipeline - quiet output, fail fast
visual-uat run --quiet --fail-fast

# Generate HTML report for artifact storage
visual-uat run --quiet
# Then upload .visual-uat/reports/*.html as build artifact
```

## Troubleshooting

### HTML Report Not Generated

**Problem:** No HTML file appears in `.visual-uat/reports/`

**Solutions:**
1. Check if `--no-html` flag was used
2. Verify directory permissions
3. Look for errors in terminal output

### Images Not Showing in HTML Report

**Problem:** HTML report loads but images are broken

**Solutions:**
1. Image paths in the report are relative to the report file location
2. Ensure `.visual-uat/baseline/`, `.visual-uat/current/`, and `.visual-uat/diff/` directories exist
3. Check that screenshot files were generated during test execution

### Report Opens But Looks Broken

**Problem:** HTML report displays incorrectly

**Solutions:**
1. The report is self-contained (no external dependencies)
2. Try opening in a different browser
3. Check browser console for JavaScript errors
4. Verify the HTML file was completely written (check file size)

### Terminal Output Is Too Verbose

**Problem:** Too much output during test runs

**Solutions:**
1. Use `--quiet` flag for minimal output
2. Redirect verbose output: `visual-uat run --verbose > test.log`
3. Configure default verbosity in config file

### Can't Find Recent Report

**Problem:** Not sure which HTML report to open

**Solutions:**
1. Reports are sorted by timestamp in filename
2. Use `visual-uat report` to open most recent
3. Check terminal output for report path
4. Run ID is included in filename and terminal output

## Understanding Test Status

### Passed

A test passes when:
- All checkpoints have visual differences below the auto-pass threshold
- OR the LLM evaluator approves the changes with high confidence

### Needs Review

A test needs review when:
- Visual differences are between auto-pass and auto-fail thresholds
- The LLM evaluator is uncertain about whether changes are acceptable
- Human judgment is required to approve/reject the changes

### Failed

A test fails when:
- Test execution encounters an error (timeout, crash, etc.)
- Visual differences exceed the auto-fail threshold
- The LLM evaluator rejects the changes with high confidence

### Errored

A test errors when:
- Test script has syntax errors
- Test framework crashes
- Prerequisites are not met (server not running, etc.)

## Best Practices

### Choose the Right Verbosity

- **Development:** Use normal or verbose mode to see details as you work
- **CI/CD:** Use quiet mode to reduce log noise
- **Debugging:** Use verbose mode to understand LLM reasoning

### Review HTML Reports

- Always review the HTML report for tests that need review
- Use the image slider to carefully inspect visual changes
- Read the LLM evaluator's reasoning to understand the change

### Archive Important Reports

- Save HTML reports for releases as documentation
- Reports are self-contained and can be archived long-term
- Include reports in code review discussions

### Configure Defaults

- Set your preferred verbosity in the config file
- Configure auto-open if you always review reports
- Adjust output directory for your project structure

## Reporter Architecture

Both reporters implement the `ReporterPlugin` interface:

```typescript
interface ReporterPlugin {
  generate(result: RunResult, options: ReporterOptions): Promise<void>;
}
```

The `RunResult` contains:
- Run metadata (ID, timestamp, branches)
- Array of test results
- Summary statistics

Each `TestResult` contains:
- Test metadata (spec path, generated path)
- Test status
- Array of checkpoint results
- Duration and error information

Each `CheckpointResult` contains:
- Checkpoint name
- Image paths (baseline, current, diff)
- Diff metrics (pixel percentage, changed regions)
- LLM evaluation (pass/fail, confidence, reasoning)

This consistent data structure allows both reporters to present the same information in different formats optimized for their use cases.
