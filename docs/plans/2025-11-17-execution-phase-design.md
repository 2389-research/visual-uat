# Execution Phase Design

**Date:** 2025-11-17
**Status:** Approved
**Related:** 2025-11-17-orchestrator-implementation.md

## Overview

This design extends the orchestrator foundation with the execution phase - running tests in worktrees, capturing screenshots, comparing differences, and evaluating with LLM.

## Architecture: State Machine

The execution phase is implemented as a state machine with explicit states and transitions.

### States

1. **SETUP** - Create worktrees, install dependencies
2. **EXECUTE_BASE** - Run tests in base worktree, capture screenshots
3. **EXECUTE_CURRENT** - Run tests in current worktree, capture screenshots
4. **COMPARE_AND_EVALUATE** - Compare screenshots, evaluate differences with LLM
5. **STORE_RESULTS** - Save RunResult to disk
6. **CLEANUP** - Remove worktrees (respects --keep-worktrees flag)
7. **COMPLETE** - Terminal success state
8. **FAILED** - Terminal error state

### State Transitions

```
SETUP → EXECUTE_BASE (worktrees ready)
SETUP → FAILED (worktree creation failed)

EXECUTE_BASE → EXECUTE_CURRENT (base tests complete, even if some errored)

EXECUTE_CURRENT → COMPARE_AND_EVALUATE (current tests complete)

COMPARE_AND_EVALUATE → STORE_RESULTS (all comparisons done)

STORE_RESULTS → CLEANUP (results persisted)

CLEANUP → COMPLETE (cleanup done or skipped)

Any state → FAILED (unrecoverable error)
```

### Rationale

State machine provides:
- **Explicit phases** - Clear separation of concerns
- **Clean error handling** - Each state can fail independently
- **Easy extensibility** - Add hooks between states, new states, or transition logic
- **Testability** - Test each state handler in isolation

## Test Execution and Screenshot Capture

### Test Runner

For both base and current worktrees:

1. Change directory to worktree path
2. Run `npx playwright test <generated-test-path>` sequentially for each test
3. Parse Playwright JSON reporter output to extract:
   - Test pass/fail status
   - Execution duration
   - Error messages (if any)
   - Screenshot paths written by `screenshotCheckpoint()`

### Screenshot Checkpoint Helper

Location: `src/playwright/helpers.ts`

```typescript
import { Page, test } from '@playwright/test';
import * as path from 'path';

export async function screenshotCheckpoint(
  page: Page,
  name: string
): Promise<void> {
  const screenshotDir = process.env.SCREENSHOT_DIR; // Set by orchestrator
  if (!screenshotDir) {
    throw new Error('SCREENSHOT_DIR environment variable not set');
  }

  const screenshotPath = path.join(screenshotDir, `${name}.png`);

  await page.screenshot({
    path: screenshotPath,
    fullPage: true
  });
}
```

Generated tests import it:
```typescript
import { screenshotCheckpoint } from 'visual-uat/playwright';
```

### Environment Configuration

Orchestrator sets `SCREENSHOT_DIR` before running tests:
- Base: `.visual-uat/screenshots/base/{testName}/`
- Current: `.visual-uat/screenshots/current/{testName}/`

Screenshot path pattern: `{SCREENSHOT_DIR}/{checkpointName}.png`

### Error Handling Rules

**Base test errors:**
- Store error in TestResult
- Set `baselineAvailable: false` flag
- Continue to current worktree execution
- Skip comparison for that test (no baseline)

**Current test errors:**
- Store error in TestResult
- Mark test as 'errored'
- Skip comparison for that test

**Test runner errors:**
- Catch and log
- Transition to FAILED state
- Attempt cleanup

## Comparison and Evaluation

### Comparison Flow

For each test that completed in both base and current:

1. Find all checkpoint screenshots (match by checkpoint name)
2. For each checkpoint pair (base + current):
   - Call `differ.compare(baseImage, currentImage)` → DiffResult
   - If `pixelDiffPercent === 0`:
     - Mark checkpoint as passed
     - Skip LLM evaluation (no changes)
     - No diff image needed
   - If `pixelDiffPercent > 0`:
     - Generate diff image using differ
     - Call `evaluator.evaluate()` with context
     - Store evaluation result

### Evaluation Context

LLM evaluator receives:
- Original spec content (user intent/description)
- Base screenshot path
- Current screenshot path
- Diff image path
- Diff metrics (pixel percentage, changed regions)

Returns:
```typescript
{
  pass: boolean,
  confidence: number,
  reason: string,
  needsReview: boolean
}
```

### Result Aggregation

**TestResult status determination:**
- `'passed'` - All checkpoints pass
- `'failed'` - Any checkpoint evaluation fails
- `'errored'` - Test execution error
- `'needs_review'` - Evaluator flagged with needsReview=true

**CheckpointResult structure:**
```typescript
{
  name: string,
  baselineImage: string,
  currentImage: string,
  diffImage: string | null, // null if pixelDiffPercent === 0
  diffMetrics: {
    pixelDiffPercent: number,
    changedRegions: Array<{x, y, width, height}>
  },
  evaluation: {
    pass: boolean,
    confidence: number,
    reason: string,
    needsReview: boolean
  } | null // null if no diff
}
```

**RunResult summary:**
```typescript
{
  timestamp: number,
  baseBranch: string,
  currentBranch: string,
  config: Config,
  tests: TestResult[],
  summary: {
    total: number,
    passed: number,
    failed: number,
    errored: number,
    needsReview: number
  }
}
```

## State Machine Implementation

### Main Execute Loop

Location: `src/orchestrator/handlers/run-command.ts`

```typescript
async execute(options: RunOptions): Promise<number> {
  let state: ExecutionState = 'SETUP';
  const context: ExecutionContext = {
    scope: null,
    worktrees: null,
    baseResults: new Map<string, RawTestResult>(),
    currentResults: new Map<string, RawTestResult>(),
    runResult: null,
    keepWorktrees: options.keepWorktrees || false
  };

  try {
    while (state !== 'COMPLETE' && state !== 'FAILED') {
      switch (state) {
        case 'SETUP':
          state = await this.handleSetup(context, options);
          break;
        case 'EXECUTE_BASE':
          state = await this.handleExecuteBase(context);
          break;
        case 'EXECUTE_CURRENT':
          state = await this.handleExecuteCurrent(context);
          break;
        case 'COMPARE_AND_EVALUATE':
          state = await this.handleCompareAndEvaluate(context);
          break;
        case 'STORE_RESULTS':
          state = await this.handleStoreResults(context);
          break;
        case 'CLEANUP':
          state = await this.handleCleanup(context);
          break;
      }
    }
  } catch (error) {
    console.error('Execution error:', error);
    // Attempt cleanup before failing
    if (!context.keepWorktrees && context.worktrees) {
      try {
        const worktreeManager = new WorktreeManager(this.projectRoot);
        worktreeManager.cleanup();
      } catch (cleanupError) {
        console.error('Cleanup error:', cleanupError);
      }
    }
    return 1;
  }

  return state === 'COMPLETE' ? 0 : 1;
}
```

### State Handlers

Each handler is a private method that:
- Takes ExecutionContext
- Performs its phase work
- Returns next ExecutionState
- Can throw on unrecoverable error

```typescript
private async handleSetup(
  context: ExecutionContext,
  options: RunOptions
): Promise<ExecutionState> {
  // Determine scope
  context.scope = await this.determineScope(options);

  // Generate tests if needed
  await this.generateTests(context.scope);

  // Create worktrees
  const worktreeManager = new WorktreeManager(this.projectRoot);
  context.worktrees = await worktreeManager.createWorktrees(
    context.scope.baseBranch,
    await this.getCurrentBranch()
  );

  return 'EXECUTE_BASE';
}
```

## File Organization

### New Files

- `src/playwright/helpers.ts` - Export screenshotCheckpoint()
- `src/orchestrator/handlers/execution-states.ts` - State type definitions, ExecutionContext interface
- `src/orchestrator/handlers/test-runner.ts` - Playwright execution wrapper

### Updated Files

- `src/orchestrator/handlers/run-command.ts` - Implement state machine and handlers
- `src/types/plugins.ts` - Add RawTestResult interface (Playwright output)
- `src/orchestrator/types/results.ts` - Add baselineAvailable field to TestResult

## CLI Integration

### New Flag

Add to run command:
```typescript
.option('--keep-worktrees', 'Keep worktrees after execution for debugging')
```

### RunOptions Extension

```typescript
export interface RunOptions {
  baseBranch?: string;
  force?: boolean;
  keepWorktrees?: boolean; // NEW
}
```

## Screenshot Storage

All artifacts stored regardless of test result:

**Base screenshots:**
`.visual-uat/screenshots/base/{testName}/{checkpointName}.png`

**Current screenshots:**
`.visual-uat/screenshots/current/{testName}/{checkpointName}.png`

**Diff images:**
`.visual-uat/diffs/{testName}/{checkpointName}.png`
(Only created if pixelDiffPercent > 0)

**Run results:**
`.visual-uat/results/{timestamp}.json`

## Execution Model

### Sequential Execution

Tests run one at a time in each worktree:
- Simpler implementation
- Easier debugging
- Prevents resource contention
- Future: Can add parallel execution as optimization

### Worktree Cleanup

Controlled by `--keep-worktrees` flag:
- **Default (false)**: Always cleanup worktrees after execution
- **With flag (true)**: Keep worktrees for debugging

Cleanup happens in CLEANUP state, or in error catch block if execution fails.

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Architecture | State machine | Explicit phases, clean error handling, extensible |
| Base test failure | Continue with flag | Don't block current tests, flag missing baseline |
| Execution model | Sequential | Simple, debuggable, optimize later |
| Screenshot storage | All three (base/current/diff) | Full inspection capability |
| Evaluation timing | Only on differences | Skip LLM calls when zero pixels changed |
| Worktree cleanup | Optional flag | Default clean, allow debug override |
| Test helpers | Import from package | Standard npm import, no magic globals |

## Next Steps

1. Create detailed implementation plan (use superpowers:writing-plans)
2. Set up worktree for implementation (use superpowers:using-git-worktrees)
3. Implement execution phase following TDD
4. Integration test with sample application
