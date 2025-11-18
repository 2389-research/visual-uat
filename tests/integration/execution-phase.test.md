# Execution Phase Integration Test

This is a manual test to verify the execution phase end-to-end.

## Prerequisites

1. A test application running on localhost:3000
2. Git repository with main branch
3. Current branch with visual changes

## Setup

```bash
cd /Users/dylanr/work/2389/visual-uat/.worktrees/execution-phase
npm run build
```

## Test 1: Full Run

```bash
# From main branch
npm run visual-uat run --base-branch main
```

**Expected:**
- Worktrees created in .worktrees/
- Tests run in both base and current
- Screenshots captured in .visual-uat/screenshots/
- Diffs generated for changes
- Results saved to .visual-uat/results/
- Worktrees cleaned up
- Exit code 0

## Test 2: Run with Keep Worktrees

```bash
npm run visual-uat run --base-branch main --keep-worktrees
```

**Expected:**
- Same as Test 1
- Worktrees NOT cleaned up
- Can inspect .worktrees/base and .worktrees/current

**Cleanup:**
```bash
git worktree remove .worktrees/base
git worktree remove .worktrees/current
```

## Test 3: Base Test Error

Create a spec that crashes in base branch:

```bash
# Checkout base, introduce breaking change, commit
# Checkout feature branch, fix the break
npm run visual-uat run --base-branch main
```

**Expected:**
- Base test errors logged
- Current test still runs
- Result marked with baselineAvailable: false
- Exit code 1 (has errors)

## Test 4: No Changes Detected

```bash
# From main branch with no spec changes
npm run visual-uat run --base-branch main
```

**Expected:**
- Scope determined as 'skip'
- No worktrees created
- Message: "No changes detected, skipping tests"
- Exit code 0

## Verification

All integration tests should pass. If any fail:
1. Check logs for error details
2. Inspect worktrees (use --keep-worktrees)
3. Verify screenshot and diff directories
4. Check .visual-uat/results/ for saved results
