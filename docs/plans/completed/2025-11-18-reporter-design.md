# Reporter Design

## Overview

The reporter phase takes test execution results and generates human-readable output in two formats: terminal (for immediate feedback and CI logs) and HTML (for detailed investigation). The design prioritizes visual clarity to make it immediately obvious what passed, failed, or needs review.

## Requirements

From brainstorming session:

1. **Dual output formats**: Terminal for quick feedback, HTML for detailed investigation
2. **Configurable verbosity**: Terminal output adapts to context (quiet/normal/verbose)
3. **Single-page HTML with filtering**: All tests in one file with client-side filtering
4. **Interactive image comparison**: Overlay slider to compare baseline vs current images
5. **Visual clarity**: Primary success criterion - make status and reasoning immediately obvious

## Architecture

### Plugin Interface

The Reporter follows the existing plugin pattern (TestGenerator, Differ, Evaluator). New interface in `src/types/plugins.ts`:

```typescript
export interface ReporterPlugin {
  generate(result: RunResult, options: ReporterOptions): Promise<void>;
}

export interface ReporterOptions {
  verbosity?: 'quiet' | 'normal' | 'verbose';
  outputDir?: string;
  embedImages?: boolean;
  autoOpen?: boolean;
}
```

### Default Implementations

Two default reporter implementations:

1. **TerminalReporter** (`src/plugins/terminal-reporter.ts`)
   - Outputs colored text to stdout
   - Three verbosity modes
   - Uses ANSI color codes or simple utility

2. **HTMLReporter** (`src/plugins/html-reporter.ts`)
   - Generates single self-contained HTML file
   - Embedded images (base64) or relative paths based on config
   - Vanilla JS for interactivity (no framework dependencies)

## Terminal Reporter

### Verbosity Modes

**Quiet mode** (`--quiet`):
```text
Visual UAT Complete
  5 passed, 2 needs review, 1 failed
  Report: .visual-uat/reports/2024-11-18-143022-a3f7b9.html
  Run ID: a3f7b9
```

**Normal mode** (default):
```text
Running tests: feature/login-ui vs main
  ✓ login-flow (1.2s)
  ⚠ dashboard-layout (2.1s) - 2.3% diff, needs review
  ✗ checkout-form (1.8s) - Button position changed

Summary: 1 passed, 1 needs review, 1 failed
Report: .visual-uat/reports/2024-11-18-143022-a3f7b9.html
Run ID: a3f7b9
```

**Verbose mode** (`--verbose`):
- Includes checkpoint names
- Shows diff percentages for each checkpoint
- Displays LLM reasoning snippets
- Full details for debugging

### Visual Indicators

- ✓ Passed
- ⚠ Needs review
- ✗ Failed
- ⊘ Errored / No baseline

### Formatting

- Duration: Format nicely (ms vs s)
- Paths: Show relative paths for readability
- Colors: Green (pass), Yellow (needs-review), Red (fail), Gray (error)
- Report path: Always show at end for easy access

## HTML Reporter

### File Naming

Format: `YYYY-MM-DD-HHMMSS-<runId>.html`

Example: `2024-11-18-143022-a3f7b9.html`

Where:
- `YYYY-MM-DD-HHMMSS`: Timestamp for chronological browsing
- `<runId>`: Short hash (7 chars) for unique identification
- Run ID is added to `RunResult` and shown in terminal/HTML

### HTML Structure

#### Header Section

- **Metadata**: Timestamp, base branch, current branch, run ID
- **Summary boxes**: Large colored boxes with counts
  - Green box: Passed tests
  - Yellow box: Needs review
  - Red box: Failed tests
  - Gray box: Errored tests
- **Click to filter**: Clicking a summary box filters to that status

#### Filter Bar

- Status buttons: All | Passed | Needs Review | Failed | Errored
- Text search box: Filter by test name
- All filtering is client-side vanilla JS
- Active filter is visually highlighted

#### Test Results List

Each test is a collapsible card:

**Card header**:
- Test name
- Status badge (colored)
- Duration

**Card body** (expanded):
- Spec file path (link to file)
- Generated test path (link to file)
- Checkpoint results list

**Checkpoint display**:
- Checkpoint name
- Diff percentage
- Pass/fail status with color
- LLM evaluation reasoning
- Image comparison (see below)

**Auto-expand behavior**:
- Tests with `needs-review` or `failed` status: Auto-expanded
- Tests with `passed` status: Collapsed by default

### Image Comparison Component

#### Three View Modes

1. **Overlay slider** (default):
   - Two images stacked with `position: absolute`
   - Range input slider controls clip-path on current image
   - Dragging reveals baseline underneath
   - Smooth animation via CSS

2. **Diff view**:
   - Shows diff image with changed pixels highlighted
   - Clear visualization of what changed

3. **Side-by-side**:
   - All three images next to each other
   - Good for wide screens
   - Labeled: Baseline | Current | Diff

#### Implementation Details

- Radio buttons to switch between modes
- Vanilla JS with no framework dependencies
- CSS handles clip-path animation
- Lazy-load images for performance
- Works on all screen sizes

#### Image Metadata Display

Below images:
- Diff metrics: Pixel diff percentage, number of changed regions
- Evaluation: LLM reasoning with confidence score
- Color-coded: Green (pass), Yellow (needs-review), Red (fail)

### Image Embedding Strategy

Two options controlled by config:

1. **Base64 embedding** (`embedImages: true`):
   - Fully portable HTML file
   - Larger file size
   - Images can't be deleted separately

2. **Relative paths** (`embedImages: false`, default):
   - Smaller HTML file
   - Requires images stay in place
   - Paths relative to report file location

## Integration with Orchestrator

### State Machine Integration

Modify STORE_RESULTS state handler:

```typescript
private async handleStoreResults(context: ExecutionContext): Promise<ExecutionState> {
  // 1. Save RunResult JSON (existing)
  await this.resultStore.saveResult(context.runResult!);

  // 2. Generate reports
  const reporterOptions: ReporterOptions = {
    verbosity: this.getVerbosity(), // from CLI flags
    outputDir: path.join(this.projectRoot, '.visual-uat/reports'),
    embedImages: this.config.reporters?.html?.embedImages || false,
    autoOpen: this.options.open || false
  };

  // 3. Terminal reporter (immediate feedback)
  const terminalReporter = this.plugins.reporters.terminal;
  await terminalReporter.generate(context.runResult!, reporterOptions);

  // 4. HTML reporter
  const htmlReporter = this.plugins.reporters.html;
  await htmlReporter.generate(context.runResult!, reporterOptions);

  return 'CLEANUP';
}
```

### CLI Flags

Add to `visual-uat run` command:

- `--quiet`: Terminal reporter quiet mode
- `--verbose`: Terminal reporter verbose mode
- `--no-html`: Skip HTML report generation
- `--open`: Auto-open HTML in browser after generation

Example:
```bash
visual-uat run --verbose --open
visual-uat run --quiet --no-html
```

### Configuration

Add to `visual-uat.config.js`:

```javascript
module.exports = {
  // ... existing config
  reporters: {
    terminal: {
      enabled: true,
      defaultVerbosity: 'normal' // 'quiet' | 'normal' | 'verbose'
    },
    html: {
      enabled: true,
      embedImages: false // true = base64, false = relative paths
    }
  }
};
```

### Plugin Loading

Reporters loaded via PluginRegistry like other plugins:

```typescript
interface LoadedPlugins {
  generator: TestGeneratorPlugin;
  differ: DifferPlugin;
  evaluator: EvaluatorPlugin;
  reporters: {
    terminal: ReporterPlugin;
    html: ReporterPlugin;
  };
}
```

## Error Handling

### Missing Images

- **HTML**: Show placeholder with error message
- **Terminal**: Log warning, continue
- **Behavior**: Don't fail report generation

### Baseline Not Available

When `baselineAvailable: false` in TestResult:

- **HTML**: Special indicator ("No baseline - new test" or "Baseline test failed")
- **Terminal**: "⊘" symbol with explanation
- **Image comparison**: Show current image only, no slider

### Large Test Suites

- Initial implementation: Handle any size
- Warning if test count > 100
- Future: Pagination or virtual scrolling if needed

### Path Resolution

- RunResult image paths: Relative to project root
- HTML report paths: Relative to report file location
- Resolve paths correctly when generating report

### Concurrent Runs

- Multiple runs can generate reports simultaneously
- RunId in filename prevents collisions
- Timestamp ensures natural ordering

### HTML Sanitization

- LLM evaluation reasoning comes from evaluator plugin
- Escape HTML entities when embedding in report
- Prevent injection if evaluator output contains special characters

## Dependencies

- Terminal colors: Simple ANSI utility or `chalk` library (optional)
- HTML generation: Template strings (no framework)
- Image handling: Node.js `fs` for reading, base64 encoding if needed

## File Structure

```text
src/
  types/
    plugins.ts               # Add ReporterPlugin interface
  plugins/
    terminal-reporter.ts     # TerminalReporter implementation
    terminal-reporter.test.ts
    html-reporter.ts         # HTMLReporter implementation
    html-reporter.test.ts
  orchestrator/
    handlers/
      run-command.ts         # Modify STORE_RESULTS state
  cli.ts                     # Add --quiet, --verbose, --no-html, --open flags

.visual-uat/
  reports/
    2024-11-18-143022-a3f7b9.html
    2024-11-18-150345-b8c2d4.html
```

## Testing Strategy

### Unit Tests

- TerminalReporter: Mock stdout, verify output format
- HTMLReporter: Generate HTML, parse/validate structure
- Test all verbosity modes
- Test edge cases (missing images, no baseline, etc.)

### Integration Tests

- Run full test suite, verify report generation
- Open HTML in browser, manually verify rendering
- Test filtering and image comparison interactions
- Verify paths resolve correctly

## Future Enhancements

Not in initial scope, but considered for future:

1. **Historical comparison**: Compare current run to previous runs
2. **Trend graphs**: Show pass/fail rates over time
3. **Report server**: Live-updating HTML served via local server
4. **Custom reporter plugins**: Let users create their own reporter formats
5. **Export formats**: JSON, JUnit XML for CI integration
6. **Diff animations**: Animated transitions between baseline/current

## Success Criteria

1. ✓ Terminal output is clear and immediate
2. ✓ HTML report makes status obvious at a glance
3. ✓ Image comparison is intuitive and reveals differences
4. ✓ Report generation doesn't fail if images are missing
5. ✓ Reports are self-contained and shareable
6. ✓ Consistent with existing plugin architecture
