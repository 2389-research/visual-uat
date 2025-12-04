# Parallel I/O Design

## Overview

Parallelize I/O-bound operations to reduce test execution time by 5-6x. Currently ~95% of execution time is I/O-bound (screenshot capture, image comparison, LLM evaluation).

## Constraints

- **Approach:** Balanced - parallelize biggest bottlenecks, keep implementation simple
- **LLM Rate Limits:** None - unlimited concurrent Claude API calls allowed
- **Dependencies:** No new dependencies - use native Node.js patterns

## Architecture

### Current: Phase-Sequential, Task-Sequential

```
SETUP → [test1, test2, test3] → EXECUTE_BASE → [test1, test2, test3] → ...
              sequential                             sequential
```

### New: Phase-Sequential, Task-Parallel

```
SETUP → Promise.all([test1, test2, test3]) → EXECUTE_BASE → Promise.all([...]) → ...
              parallel                                            parallel
```

## What Gets Parallelized

| Operation | Current | New | Expected Speedup |
|-----------|---------|-----|------------------|
| Screenshot capture (base) | Sequential spawnSync | Parallel async spawn | 60-80% of time saved |
| Screenshot capture (current) | Sequential spawnSync | Parallel async spawn | (same as above) |
| Compare & Evaluate | Sequential loop | Promise.allSettled | 20-30% of time saved |
| Report generation | Sequential | Promise.all | 2-5% of time saved |

## What Stays Sequential

- Phases themselves (must capture before comparing)
- Server startup (only one dev server)
- Result storage (single JSON write after all evaluations complete)

## Implementation Details

### 1. Test Runner Changes (`test-runner.ts`)

Replace `spawnSync` with async spawn:

```typescript
// Current: blocks until each test completes
const result = spawnSync('npx', ['playwright', 'test', ...], { ... });

// New: returns promise, allows concurrent execution
async runTest(testFile: string, screenshotDir: string): Promise<TestResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx', ['playwright', 'test', ...], { ... });
    let stdout = '', stderr = '';
    proc.stdout.on('data', (d) => stdout += d);
    proc.stderr.on('data', (d) => stderr += d);
    proc.on('close', (code) => {
      resolve({ success: code === 0, stdout, stderr });
    });
  });
}
```

### 2. Handler Changes (`run-command.ts`)

**Test execution:**

```typescript
// Current:
for (const test of tests) {
  await runner.runTest(test, screenshotDir);
}

// New:
await Promise.all(tests.map(test =>
  runner.runTest(test, screenshotDir)
));
```

**Compare & Evaluate with partial results:**

```typescript
const settled = await Promise.allSettled(checkpoints.map(async (checkpoint) => {
  const baseline = fs.readFileSync(baselinePath);
  const current = fs.readFileSync(currentPath);
  const diffResult = await differ.compare(baseline, current);
  const evaluation = await evaluator.evaluate(diffResult);
  return { checkpoint, diffResult, evaluation };
}));

// Extract results, track failures
const results = [];
const failures = [];
for (const [i, outcome] of settled.entries()) {
  if (outcome.status === 'fulfilled') {
    results.push(outcome.value);
  } else {
    failures.push({ checkpoint: checkpoints[i], error: outcome.reason });
  }
}

if (failures.length > 0) {
  console.warn(`${failures.length} checkpoint(s) failed to compare`);
}
```

**Report generation:**

```typescript
// Current:
await terminalReporter.report(results);
await htmlReporter.report(results);

// New:
await Promise.all([
  terminalReporter.report(results),
  htmlReporter.report(results)
]);
```

## Files to Modify

| File | Change |
|------|--------|
| `src/orchestrator/services/test-runner.ts` | `spawnSync` → async `spawn` with promise wrapper |
| `src/orchestrator/handlers/run-command.ts` | Sequential loops → `Promise.all`/`Promise.allSettled` |

## Error Handling

- **Test execution:** If a test fails, other tests continue (Promise.all resolves when all complete, individual failures captured in results)
- **Compare & Evaluate:** Use `Promise.allSettled` so partial results are available even if some checkpoints fail
- **Reports:** Use `Promise.all` - if one reporter fails, we want to know immediately

## Expected Results

With 5 tests and 10 checkpoints:
- **Current:** 5 tests × 2 phases × ~10s = 100s capture + 10 diffs × ~3s = ~130s total
- **Parallel:** ~10s capture × 2 + ~3s diff = ~23s total
- **Speedup:** ~5-6x faster

## Future Considerations

If resource contention becomes an issue (too many Playwright instances), we can add `p-limit` for concurrency control. For now, Promise.all is simpler and should work fine.
