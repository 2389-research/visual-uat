# Web Runner Rename Design

**Date:** 2025-11-20
**Status:** Approved
**Author:** visual_uat_dev

## Problem Statement

Visual-uat needs to support visual diffing of ANY web content - not just npm-based applications. Users should be able to test:
- Static HTML files (reports, documentation)
- Go applications
- Python Flask/Django apps
- Elixir Phoenix apps
- Ruby Rails apps
- Any web server that can respond to HTTP requests

Currently, the `PlaywrightRunner` plugin name implies it's specific to a certain stack, but the implementation is already generic.

## Core Insight

**The PlaywrightRunner is already a generic web server runner!** It doesn't care what process it spawns - it:
1. Spawns any command via `startCommand`
2. Waits for a server to respond on a URL
3. Manages lifecycle (start/stop)
4. Passes `PORT` environment variable to the process

The only issue is the misleading name. No new plugin architecture needed.

## Design Decision

**Rename `PlaywrightRunner` → `WebRunner`** to reflect its generic nature.

### Requirements Gathered

1. **Content Source:** Auto-detect files vs directories (implementation already handles this via command)
2. **Configuration:** Config file specifies `startCommand`, test specs reference specific pages
3. **Worktree Model:** Same as existing - serve from worktree directories for baseline vs current comparison
4. **Implementation:** User-provided commands, with comprehensive examples in documentation

## Implementation Changes

### 1. File Renames
- `src/plugins/playwright-runner.ts` → `web-runner.ts`
- `src/plugins/playwright-runner.test.ts` → `web-runner.test.ts`
- `src/plugins/playwright-runner.d.ts` → `web-runner.d.ts` (generated)

### 2. Class & Type Renames
- Class: `PlaywrightRunner` → `WebRunner`
- Keep all method signatures identical
- Update all imports throughout codebase

### 3. Plugin Registry
Update `src/orchestrator/services/plugin-registry.ts`:
```typescript
'@visual-uat/playwright-runner': WebRunner,  // old name - remove
'@visual-uat/web-runner': WebRunner,          // new name
```

### 4. Config Updates
Update all config files to use new plugin name:
```javascript
plugins: {
  targetRunner: '@visual-uat/web-runner',
  // ...
}
```

### 5. Documentation & Examples

Add comprehensive examples showing various server types:

```javascript
// Node.js app (npm)
targetRunner: {
  startCommand: 'npm start'
}

// Static files (npx serve)
targetRunner: {
  startCommand: 'npx serve -l $PORT tests/fixtures'
}

// Static files (Python)
targetRunner: {
  startCommand: 'cd tests/fixtures && python -m http.server $PORT'
}

// Go application
targetRunner: {
  startCommand: 'go run main.go'
}

// Elixir Phoenix
targetRunner: {
  startCommand: 'mix phx.server'
}

// Python Flask
targetRunner: {
  startCommand: 'flask run --port $PORT'
}

// Ruby Rails
targetRunner: {
  startCommand: 'rails server -p $PORT'
}
```

## Use Case: HTML Report Testing

The original motivation - testing visual-uat's own HTML reports:

```javascript
// visual-uat.config.js
plugins: {
  targetRunner: '@visual-uat/web-runner',
  testGenerator: '@visual-uat/stub-generator',
  differ: '@visual-uat/pixelmatch-differ',
  evaluator: '@visual-uat/claude-evaluator'
},
targetRunner: {
  startCommand: 'npx serve -l $PORT tests/fixtures'
}
```

```typescript
// tests/generated/html-report-ui.spec.ts
test('HTML Report UI', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/sample-report.html');
  await screenshotCheckpoint(page, 'hero-section');
  await screenshotCheckpoint(page, 'filter-buttons');
});
```

## Non-Requirements

- **No migration needed:** Project is unreleased, direct rename is fine
- **No backwards compatibility:** No need to support old plugin name
- **No new plugin architecture:** Existing implementation is perfect
- **No special static server:** Users provide their own command

## Testing Strategy

1. Rename test files to match new names
2. Update test descriptions to reflect generic nature
3. Keep all existing test coverage (already tests generic behavior)
4. Add integration test with `npx serve` for static content use case

## Files Affected

### Source Code
- `src/plugins/playwright-runner.ts` → `web-runner.ts`
- `src/orchestrator/services/plugin-registry.ts` (update builtin names)
- `src/types/config.ts` (update interface names if needed)
- All files importing PlaywrightRunner

### Tests
- `src/plugins/playwright-runner.test.ts` → `web-runner.test.ts`
- `src/orchestrator/services/plugin-registry.test.ts` (update plugin names)
- `src/orchestrator/handlers/run-command.test.ts` (update imports)
- `src/orchestrator/services/server-manager.test.ts` (update imports)
- `src/orchestrator/services/test-runner.test.ts` (update imports)
- `src/orchestrator/services/worktree-manager.test.ts` (update imports)

### Configuration & Examples
- `examples/demo-app/visual-uat.config.js`
- `visual-uat.config.js` (root, for self-testing)
- Any documentation mentioning PlaywrightRunner

### Documentation
- README.md (add examples section)
- Update any existing docs mentioning plugin names

## Success Criteria

1. All tests pass after rename
2. Demo app still works with `npm start`
3. HTML report testing works with `npx serve`
4. Documentation clearly shows multiple server type examples
5. Zero new code beyond renaming

## Trade-offs

**Pros:**
- Zero new code - just clarifying naming
- Works with ANY web server
- Maintains all existing functionality
- Simple, obvious solution

**Cons:**
- Breaking change (but pre-release, so acceptable)
- Requires updating all references
- Name is very generic (but that's the point)

## Conclusion

This is a pure refactoring that makes the existing generic implementation discoverable and usable for its full range of capabilities. The PlaywrightRunner was already capable of serving static content, Go apps, Python apps, etc - we just need to rename it to reflect that reality.
