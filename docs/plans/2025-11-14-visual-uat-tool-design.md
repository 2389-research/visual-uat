# Visual UAT Tool Design

**Date:** 2025-11-14
**Status:** Design Approved

## Overview

A command-line tool for visual acceptance testing that combines LLM-powered test generation with automated screenshot comparison. The tool validates that UI changes match developer intent by comparing visual snapshots across git branches.

## Goals

1. **Catch visual regressions** - Prevent unintended visual changes from shipping
2. **Verify intended changes** - Confirm changes match what was intended (nothing more, nothing less)
3. **Fast local workflow** - Optimized for developer speed (<2 min ideal)
4. **Extensible architecture** - Support web apps initially, pluggable for native/mobile later

## Architecture Approach

**Pluggable pipeline system** with core orchestrator and replaceable plugins for each concern:
- Target runners (web, native, mobile)
- Test generators (LLM providers, prompting strategies)
- Screenshotters (browser automation, OS-level capture)
- Differs (pixel comparison algorithms)
- Evaluators (LLM judgment logic)

**Trade-off:** Longer initial build time vs. monolithic approach, but pays off when adding new target types or swapping components.

## Core Workflow

### Phase 1: Generation (Automatic)
Natural language test specs (`.md` files) are the **source of truth**. Generated Playwright scripts are **derived artifacts**.

- Spec watcher monitors test specs via content hashing
- Detects new/modified/deleted specs
- Invokes Test Generator plugin (LLM + codebase context) → generates Playwright scripts
- Scripts saved to version control: `tests/checkout-flow.md` → `tests/generated/checkout-flow.spec.ts`
- Manifest tracks spec-to-script mapping and hashes

**Developer experience:**
```bash
# Edit tests/checkout-flow.md
visual-uat run  # Automatically regenerates if spec changed, then runs tests
```

### Phase 2: Execution (Every Run)
Orchestrator runs tests in two **isolated environments** (separate containers/ports):

1. Checkout base branch → start Target Runner → run generated scripts → capture screenshots
2. Checkout current branch → start Target Runner → run generated scripts → capture screenshots
3. Store screenshots: `.visual-uat/screenshots/{branch}/{test-name}/{checkpoint}.png`

Scripts use special commands for checkpoints:
```typescript
await screenshotCheckpoint('after-login')
await screenshotCheckpoint('cart-with-items')
```

### Phase 3: Evaluation (Every Run)
1. **Differ plugin** compares corresponding screenshots pixel-by-pixel
2. Generates visual diff images with highlighted regions + metrics (% changed, bounding boxes)
3. **Evaluator plugin** sends to LLM: spec intent + diff image + metrics
4. LLM returns: `{pass: boolean, confidence: number, reason: string}`
5. **Confidence thresholds:**
   - ≥95% → auto-pass (green)
   - ≤30% → auto-fail (red)
   - Between → flag for manual review (yellow)
6. **Reporter** generates HTML with side-by-side screenshots, diffs, LLM judgments

## File Structure

```
project/
├── visual-uat.config.js          # Main configuration
├── tests/
│   ├── checkout-flow.md          # Natural language specs (source of truth)
│   ├── login-flow.md
│   └── generated/                # Auto-generated scripts (committed)
│       ├── checkout-flow.spec.ts
│       └── login-flow.spec.ts
└── .visual-uat/                  # Artifacts (gitignored)
    ├── manifest.json             # Spec hashes + metadata
    ├── screenshots/
    │   ├── main/                 # Base branch screenshots
    │   └── feature-x/            # Current branch screenshots
    ├── diffs/                    # Visual diff images
    └── reports/                  # HTML reports with judgments
```

## Configuration

Example `visual-uat.config.js`:

```javascript
export default {
  baseBranch: 'main',
  specsDir: './tests',
  generatedDir: './tests/generated',

  plugins: {
    targetRunner: '@visual-uat/playwright-runner',
    testGenerator: '@visual-uat/llm-generator',
    differ: '@visual-uat/pixelmatch',
    evaluator: '@visual-uat/llm-evaluator',
  },

  targetRunner: {
    startCommand: 'npm run dev',
    baseUrl: 'http://localhost:3000',
    // Runner handles port allocation for isolation
  },

  evaluator: {
    autoPassThreshold: 0.95,  // LLM confidence >= 95% = auto-pass
    autoFailThreshold: 0.3,   // LLM confidence <= 30% = auto-fail
    // Between thresholds = flag for manual review
  }
}
```

## Plugin Interfaces

### Target Runner Plugin
```typescript
interface TargetRunner {
  // Start app in isolated environment, return connection info
  start(branch: string): Promise<TargetInfo>

  // Stop and cleanup
  stop(targetInfo: TargetInfo): Promise<void>

  // Health check
  isReady(targetInfo: TargetInfo): Promise<boolean>
}

type TargetInfo = {
  baseUrl: string
  environment: Record<string, string>
  metadata: Record<string, any>  // Plugin-specific data
}
```

### Test Generator Plugin
```typescript
interface TestGenerator {
  // Generate test script from natural language spec
  generate(spec: TestSpec, context: CodebaseContext): Promise<GeneratedTest>
}

type TestSpec = {
  filePath: string
  content: string
  metadata: Record<string, any>
}

type GeneratedTest = {
  code: string
  language: 'typescript' | 'javascript'
  checkpoints: string[]  // List of checkpoint names for validation
}
```

### Differ Plugin
```typescript
interface Differ {
  // Compare two screenshots, produce diff
  compare(baseline: Screenshot, current: Screenshot): Promise<DiffResult>
}

type DiffResult = {
  diffImage: Buffer  // Visual diff with highlights
  pixelDiffPercent: number
  changedRegions: BoundingBox[]
  identical: boolean
}
```

### Evaluator Plugin
```typescript
interface Evaluator {
  // Evaluate if diff matches intent
  evaluate(input: EvaluationInput): Promise<EvaluationResult>
}

type EvaluationInput = {
  intent: string  // Original spec content
  checkpoint: string
  diffResult: DiffResult
  baselineImage: Buffer
  currentImage: Buffer
}

type EvaluationResult = {
  pass: boolean
  confidence: number  // 0-1 scale
  reason: string
  needsReview: boolean
}
```

## CLI Commands

```bash
visual-uat run              # Auto-generate + execute + evaluate
visual-uat run --all        # Force full suite (ignore caching)
visual-uat generate         # Force regenerate all scripts
visual-uat report           # Open HTML report viewer
```

## Error Handling

### Generation Failures
- **LLM can't understand spec** → fail fast with clear error, show which spec file
- **Generated script has syntax errors** → run linter/type-checker before saving, fail if invalid
- **Codebase changes break generated script** → developer manually edits (becomes "locked"), won't regenerate until spec changes

### Execution Failures
- **Target fails to start** → retry once, then fail with logs
- **Script timeout/throws** → capture error screenshot + stack trace, mark test as "errored" (not failed)
- **Missing checkpoint in one branch** → mark as structural failure (different from visual diff)

### Evaluation Edge Cases
- **LLM API fails** → fall back to manual review mode, all tests marked "needs review"
- **Confidence between thresholds** → flagged for manual review in HTML report
- **Zero pixel diff but spec expects changes** → LLM flags as suspicious

## Performance Optimizations

1. **Parallel execution** - Run multiple test suites concurrently (configurable parallelism)
2. **Screenshot caching** - Reuse base branch screenshots if branch unchanged
3. **Incremental runs** - Only run tests whose specs/scripts changed (default behavior)
4. **Two-environment parallelism** - Run base and current branch tests simultaneously

## Success Criteria

✅ Catches unintended visual changes (regressions)
✅ Verifies intended changes match expectations
✅ Runs in <2 minutes for typical test suite
✅ Pluggable architecture supports adding new target types
✅ Generated scripts are reviewable and maintainable
✅ Clear, actionable HTML reports with manual override capability
