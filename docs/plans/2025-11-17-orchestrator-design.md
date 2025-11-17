# Visual UAT Orchestrator Design

**Date:** 2025-11-17
**Status:** Design Approved

## Overview

The orchestrator coordinates all plugins (TestGenerator, TargetRunner, Differ, Evaluator) to execute the complete visual acceptance testing workflow. It uses a **Command Handler pattern** where each CLI command has a dedicated handler class that orchestrates the appropriate workflow.

## Design Decisions

Based on requirements gathering:
- **Incremental execution**: Smart detection (checks codebase changes + spec changes)
- **Error handling**: Configurable via --fail-fast flag (default: continue on errors)
- **Parallelization**: Sequential execution only (simpler for MVP)
- **Architecture**: Command Handler pattern (aligns with CLI structure)

## Architecture

### High-Level Structure

```
src/orchestrator/
├── handlers/
│   ├── run-command.ts          # Main test execution workflow
│   ├── generate-command.ts     # Test generation only
│   └── report-command.ts       # HTML report viewing
├── services/
│   ├── change-detector.ts      # Smart detection logic
│   ├── plugin-registry.ts      # Plugin loading and management
│   ├── result-store.ts         # Persisting test results
│   └── worktree-manager.ts     # Git worktree coordination
└── types/
    └── results.ts              # Result data structures
```

### Component Responsibilities

**Command Handlers**: Each CLI command (`run`, `generate`, `report`) has a dedicated handler that:
- Loads configuration
- Instantiates required plugins
- Executes the command-specific workflow
- Returns results or exit code

**Services**: Shared utilities used by command handlers:
- **ChangeDetector**: Determines full vs incremental runs based on git diff and manifest
- **PluginRegistry**: Loads plugins from config, validates interfaces, manages instances
- **ResultStore**: Persists screenshots, diffs, evaluations, and results JSON
- **WorktreeManager**: Creates/cleans up isolated git worktrees for branch testing

## Command Handler Workflows

### RunCommandHandler

**Purpose**: Generate tests, execute them in both branches, compare screenshots, evaluate diffs.

**Workflow**:

1. **Setup Phase**
   - Load config via `ConfigLoader`
   - Instantiate plugins via `PluginRegistry`:
     - TestGenerator (from config.plugins.testGenerator)
     - TargetRunner (from config.plugins.targetRunner)
     - Differ (from config.plugins.differ)
     - Evaluator (from config.plugins.evaluator)
   - Determine execution scope via `ChangeDetector`:
     - If `--all` flag: full run
     - Else if codebase changed (git diff): full run
     - Else if specs changed (manifest): incremental run
     - Else: skip (nothing to do)

2. **Generation Phase** (if needed)
   - Get list of specs to generate:
     - Full: all `.md` files in config.specsDir
     - Incremental: only new/modified from manifest
   - For each spec:
     - Read spec content
     - Call `TestGenerator.generate(spec, codebaseContext)`
     - Write generated test to config.generatedDir
     - If generation fails and --fail-fast: exit immediately
     - If generation fails and not --fail-fast: mark as errored, continue
   - Update `SpecManifest` with new hashes
   - Commit generated tests

3. **Execution Phase** (sequential)
   - Create worktrees via `WorktreeManager`:
     - Base branch worktree at `.worktrees/base`
     - Current branch worktree at `.worktrees/current`

   - **Base branch execution**:
     - Start `TargetRunner` in base worktree (allocates port, e.g., 3000)
     - Wait for server ready via `TargetRunner.isReady()`
     - Run Playwright tests with BASE_URL set to base server
     - Tests call `screenshotCheckpoint()` helper (to be implemented)
     - Screenshots saved to `.visual-uat/screenshots/base/{test-name}/{checkpoint}.png`
     - Stop `TargetRunner`
     - If server fails and retry fails: exit (always fatal)

   - **Current branch execution**:
     - Start `TargetRunner` in current worktree (different port, e.g., 3001)
     - Wait for server ready
     - Run same Playwright tests
     - Screenshots saved to `.visual-uat/screenshots/current/{test-name}/{checkpoint}.png`
     - Stop `TargetRunner`

   - **Error handling during execution**:
     - Test throws/times out: capture error screenshot, mark as errored
     - If --fail-fast: exit immediately
     - If not --fail-fast: continue to next test

4. **Evaluation Phase**
   - For each test, for each checkpoint:
     - Load baseline and current screenshots
     - Call `Differ.compare(baseline, current)` → DiffResult
     - If dimension mismatch: mark as structural failure, continue
     - Save diff image to `.visual-uat/diffs/{test-name}/{checkpoint}.png`
     - Call `Evaluator.evaluate(intent, diffResult, images)` → EvaluationResult
     - If LLM fails: mark as needs-review, continue
     - Store evaluation result

   - Aggregate results:
     - Count passed, failed, errored, needs-review
     - Determine overall pass/fail (any failures = fail)

5. **Report Phase**
   - Save complete results to `.visual-uat/results/run-{timestamp}.json`
   - Print summary to console:
     ```
     Visual UAT Results:
     ✓ 12 passed
     ✗ 2 failed
     ⚠ 3 need manual review
     ⊗ 1 errored

     Failed tests:
     - tests/checkout-flow.md (checkout: button color changed)
     - tests/login-flow.md (after-login: unexpected modal)

     Review needed:
     - tests/dashboard.md (dashboard-loaded: medium confidence)

     Full report: .visual-uat/results/run-1731870123.json
     Run 'visual-uat report' to view details
     ```
   - Return exit code: 0 if all passed, 1 if any failures/errors

**Options**:
- `--all`: Force full run (ignore change detection)
- `--base <branch>`: Override base branch from config
- `--fail-fast`: Stop on first error (default: continue)

### GenerateCommandHandler

**Purpose**: Regenerate all test scripts without executing them.

**Workflow**:

1. Load config via `ConfigLoader`
2. Instantiate `TestGenerator` plugin
3. Find all `.md` files in config.specsDir
4. For each spec:
   - Call `TestGenerator.generate(spec, codebaseContext)`
   - Write to config.generatedDir
   - If generation fails: log error, continue
5. Update `SpecManifest` with all new hashes
6. Commit generated tests
7. Print summary:
   ```
   Generated 15 test scripts
   ✓ 12 successful
   ✗ 3 failed:
     - tests/complex-flow.md: LLM timeout
     - tests/edge-case.md: Invalid syntax
     - tests/missing-context.md: Insufficient codebase context
   ```

### ReportCommandHandler

**Purpose**: Open HTML report viewer for previous test results.

**Workflow**:

1. If `--latest` flag or no argument:
   - Find most recent `.visual-uat/results/run-*.json`
2. Else if specific run ID provided:
   - Load `.visual-uat/results/run-{id}.json`
3. Generate HTML report (future HTML reporter component)
4. Launch browser to view report
5. HTML shows:
   - Side-by-side baseline/current screenshots
   - Diff images with highlighted changes
   - LLM evaluation reasoning
   - Manual override buttons (approve/reject)

**Options**:
- `--latest`: Open most recent run (default behavior)
- `{run-id}`: Open specific run by timestamp

## Service Designs

### ChangeDetector

**Purpose**: Determine whether to run full test suite or incremental.

**Algorithm**:
```typescript
determineScope(options: RunOptions): 'full' | 'incremental' | 'skip' {
  // Explicit flag overrides all
  if (options.all) return 'full';

  // Check if codebase changed since base branch
  const codebaseChanged = this.hasCodebaseChanges(
    options.baseBranch || config.baseBranch
  );
  if (codebaseChanged) return 'full';

  // Check if specs changed via manifest
  const specFiles = this.findSpecFiles(config.specsDir);
  const changes = manifest.detectChanges(specFiles);

  if (changes.new.length > 0 || changes.modified.length > 0) {
    return 'incremental';
  }

  // Nothing changed
  return 'skip';
}

private hasCodebaseChanges(baseBranch: string): boolean {
  // Run: git diff --quiet {baseBranch}..HEAD -- src/
  // Returns true if diff exists (non-zero exit code)
  const result = execSync(
    `git diff --quiet ${baseBranch}..HEAD -- src/`,
    { cwd: projectRoot }
  );
  return result !== 0;
}
```

### PluginRegistry

**Purpose**: Load and validate plugins from configuration.

**Loading Strategy**:
```typescript
loadPlugin(pluginName: string, interfaceName: string): Plugin {
  // Built-in plugins (our 4 implementations)
  const builtins = {
    '@visual-uat/playwright-runner': PlaywrightRunner,
    '@visual-uat/stub-generator': StubTestGenerator,
    '@visual-uat/pixelmatch-differ': PixelmatchDiffer,
    '@visual-uat/claude-evaluator': ClaudeEvaluator
  };

  if (pluginName in builtins) {
    return new builtins[pluginName](config);
  }

  // External plugins (future support)
  // const Plugin = require(pluginName);
  // return new Plugin(config);

  throw new Error(`Unknown plugin: ${pluginName}`);
}

// Validate plugin implements required interface
validatePlugin(plugin: any, interfaceName: string): void {
  const requiredMethods = {
    'TargetRunner': ['start', 'stop', 'isReady'],
    'TestGenerator': ['generate'],
    'Differ': ['compare'],
    'Evaluator': ['evaluate']
  };

  for (const method of requiredMethods[interfaceName]) {
    if (typeof plugin[method] !== 'function') {
      throw new Error(
        `Plugin does not implement ${interfaceName}.${method}()`
      );
    }
  }
}
```

### ResultStore

**Purpose**: Persist test artifacts and results.

**Directory Structure**:
```
.visual-uat/
├── screenshots/
│   ├── base/
│   │   ├── checkout-flow/
│   │   │   ├── initial.png
│   │   │   ├── after-add-to-cart.png
│   │   │   └── checkout-complete.png
│   │   └── login-flow/
│   │       └── after-login.png
│   └── current/
│       ├── checkout-flow/
│       └── login-flow/
├── diffs/
│   ├── checkout-flow/
│   │   ├── initial.png
│   │   ├── after-add-to-cart.png
│   │   └── checkout-complete.png
│   └── login-flow/
│       └── after-login.png
├── results/
│   ├── run-1731870123.json
│   └── run-1731870456.json
└── manifest.json
```

**Result JSON Format**:
```typescript
interface RunResult {
  timestamp: number;
  baseBranch: string;
  currentBranch: string;
  config: Config;
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errored: number;
    needsReview: number;
  };
}

interface TestResult {
  specPath: string;
  generatedPath: string;
  status: 'passed' | 'failed' | 'errored' | 'needs-review';
  checkpoints: CheckpointResult[];
  error?: string;
  duration: number;
}

interface CheckpointResult {
  name: string;
  baselineImage: string; // relative path
  currentImage: string;
  diffImage: string;
  diffMetrics: {
    pixelDiffPercent: number;
    changedRegions: BoundingBox[];
  };
  evaluation: {
    pass: boolean;
    confidence: number;
    reason: string;
    needsReview: boolean;
  };
}
```

### WorktreeManager

**Purpose**: Manage git worktrees for isolated branch testing.

**Operations**:
```typescript
async createWorktrees(baseBranch: string, currentBranch: string): Promise<{
  base: string;
  current: string;
}> {
  // Create .worktrees directory if needed
  // git worktree add .worktrees/base {baseBranch}
  // git worktree add .worktrees/current {currentBranch}
  // npm install in each worktree (if needed)
  return {
    base: path.join(projectRoot, '.worktrees/base'),
    current: path.join(projectRoot, '.worktrees/current')
  };
}

async cleanup(): Promise<void> {
  // git worktree remove .worktrees/base
  // git worktree remove .worktrees/current
}
```

## Error Handling Strategy

### Generation Errors
- **Cause**: LLM timeout, invalid spec syntax, insufficient context
- **Action**:
  - Log error with spec path and reason
  - Mark test as errored in results
  - If --fail-fast: exit with code 1
  - Else: continue to next spec

### Execution Errors
- **Server startup failure**:
  - Retry once after 5 seconds
  - If still fails: fatal error, exit with code 1
  - Rationale: Can't continue without server

- **Test execution failure** (Playwright error):
  - Capture error screenshot if possible
  - Mark test as errored with error message
  - If --fail-fast: exit with code 1
  - Else: continue to next test

- **Screenshot missing**:
  - Mark checkpoint as errored
  - Log warning about missing checkpoint
  - Continue to next checkpoint

### Evaluation Errors
- **Differ dimension mismatch**:
  - Mark as structural failure (different from visual diff)
  - Log warning about layout changes
  - Continue (this is valuable information)

- **LLM API failure**:
  - Mark evaluation as needs-review (confidence: 0)
  - Reason: "LLM evaluation unavailable"
  - Continue (don't block on API issues)

### Exit Codes
- `0`: All tests passed
- `1`: One or more tests failed or errored
- `2`: Configuration error (missing config, invalid plugin)
- `3`: Setup error (git worktree creation failed, etc.)

## Integration Points

### With Existing Components

**ConfigLoader** (`src/config/loader.ts`):
- RunCommandHandler calls `loadConfig()` at startup
- Passes config to PluginRegistry and all services

**SpecManifest** (`src/specs/manifest.ts`):
- ChangeDetector uses `manifest.detectChanges()` for incremental detection
- GenerateCommandHandler updates manifest after generation

**Plugins** (`src/plugins/`):
- PluginRegistry instantiates and manages plugin lifecycle
- Command handlers call plugin methods via interfaces

**CLI** (`src/cli.ts`):
- Each command's action handler creates appropriate CommandHandler
- Passes options from Commander.js to handler
- Returns handler's exit code

### Components Still Needed

**Playwright Helper** (`@visual-uat/playwright-helpers`):
```typescript
// To be implemented
async function screenshotCheckpoint(
  page: Page,
  name: string
): Promise<void> {
  const screenshotDir = process.env.SCREENSHOT_DIR || './screenshots';
  const testName = process.env.TEST_NAME || 'unknown';
  const path = `${screenshotDir}/${testName}/${name}.png`;

  await page.screenshot({ path, fullPage: true });
}
```

**HTML Reporter** (future component):
- Reads result JSON
- Generates interactive HTML with image comparison
- Supports manual override of LLM decisions

## Testing Strategy

### Unit Tests
- **ChangeDetector**: Test full/incremental/skip decisions
- **PluginRegistry**: Test plugin loading and validation
- **ResultStore**: Test JSON serialization and file operations
- **WorktreeManager**: Test worktree creation/cleanup (mocked git commands)

### Integration Tests
- **RunCommandHandler**: End-to-end with real plugins, simple test app
- **GenerateCommandHandler**: Test generation with stub generator
- **Error scenarios**: Test fail-fast vs continue behavior

### Manual Testing
- Run against a real project with visual changes
- Verify screenshots captured correctly
- Verify diffs highlight actual changes
- Verify LLM evaluation makes sense

## Performance Considerations

### Optimizations
- **Screenshot caching**: If base branch unchanged, reuse base screenshots
- **Worktree reuse**: Keep worktrees alive between runs (future)
- **Parallel test execution**: Future enhancement for speed (not MVP)

### Resource Management
- **Port allocation**: TargetRunner finds free ports to avoid conflicts
- **Process cleanup**: Ensure servers stopped even on errors
- **Disk space**: Old results can be cleaned with `visual-uat clean` (future)

## Future Enhancements

### Not in Initial Implementation
- Parallel test execution (requires significant complexity)
- Watch mode (re-run on file changes)
- CI mode (optimized for CI environments)
- Distributed execution (run tests across machines)
- Custom reporters (JSON, JUnit XML, etc.)
- LLM-powered test generator (replace stub)
- Screenshot baseline approval workflow
- Integration with visual-acceptor project

### Immediate Next Steps After Orchestrator
1. Implement Playwright helper for `screenshotCheckpoint()`
2. Build basic HTML reporter
3. Write integration tests
4. Add orchestrator to CLI command handlers
5. Test end-to-end with real project

## Success Criteria

The orchestrator is complete when:
- ✅ `visual-uat run` generates tests, captures screenshots, evaluates diffs
- ✅ `visual-uat generate` creates Playwright tests from specs
- ✅ `visual-uat report` shows results (even if basic console output initially)
- ✅ Smart detection works (full vs incremental runs)
- ✅ Error handling respects --fail-fast flag
- ✅ All tests pass (unit + integration)
- ✅ Can test a real project end-to-end
