# Web Runner Rename Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rename PlaywrightRunner to WebRunner to reflect its generic web server capabilities

**Architecture:** Direct rename with no functionality changes. The runner already supports any web server (npm, Go, Python, static files, etc.) - we're just updating naming to match reality.

**Tech Stack:** TypeScript, Jest

---

## Task 1: Rename Core Plugin File

**Files:**
- Rename: `src/plugins/playwright-runner.ts` → `src/plugins/web-runner.ts`
- Keep same content initially

**Step 1: Rename the file**

```bash
cd /Users/dylanr/Dropbox\ \(Personal\)/work/2389/visual-uat/.worktrees/web-runner-rename
git mv src/plugins/playwright-runner.ts src/plugins/web-runner.ts
```

**Step 2: Verify file moved**

Run: `git status`
Expected: Shows `renamed: src/plugins/playwright-runner.ts -> src/plugins/web-runner.ts`

**Step 3: Update class name in the file**

In `src/plugins/web-runner.ts`, change:
```typescript
export class PlaywrightRunner implements TargetRunner {
```

To:
```typescript
export class WebRunner implements TargetRunner {
```

**Step 4: Verify changes**

Run: `git diff src/plugins/web-runner.ts`
Expected: Shows class name change from PlaywrightRunner to WebRunner

**Step 5: Commit**

```bash
git add src/plugins/web-runner.ts
git commit -m "refactor: rename PlaywrightRunner to WebRunner

Rename core file and class to reflect generic web server support.
No functionality changes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Rename Test File

**Files:**
- Rename: `src/plugins/playwright-runner.test.ts` → `src/plugins/web-runner.test.ts`
- Modify: Update all test descriptions

**Step 1: Rename test file**

```bash
git mv src/plugins/playwright-runner.test.ts src/plugins/web-runner.test.ts
```

**Step 2: Update import in test file**

In `src/plugins/web-runner.test.ts`, change:
```typescript
import { PlaywrightRunner } from './playwright-runner';
```

To:
```typescript
import { WebRunner } from './web-runner';
```

**Step 3: Update all class instantiations**

Find and replace all `new PlaywrightRunner` with `new WebRunner` in the test file.

Expected: ~20-30 occurrences

**Step 4: Update test descriptions**

Change:
```typescript
describe('PlaywrightRunner', () => {
```

To:
```typescript
describe('WebRunner', () => {
```

**Step 5: Build to check for errors**

Run: `npm run build`
Expected: Build succeeds (may have errors in other files - that's expected, we'll fix them)

**Step 6: Commit**

```bash
git add src/plugins/web-runner.test.ts
git commit -m "test: rename PlaywrightRunner test to WebRunner

Update test file name, imports, and descriptions.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Update Plugin Registry

**Files:**
- Modify: `src/orchestrator/services/plugin-registry.ts`
- Modify: `src/orchestrator/services/plugin-registry.test.ts`

**Step 1: Update import in plugin-registry.ts**

In `src/orchestrator/services/plugin-registry.ts`, change:
```typescript
import { PlaywrightRunner } from '../../plugins/playwright-runner';
```

To:
```typescript
import { WebRunner } from '../../plugins/web-runner';
```

**Step 2: Update builtins mapping**

Change:
```typescript
private builtins: Record<string, any> = {
  '@visual-uat/stub-generator': StubTestGenerator,
  '@visual-uat/playwright-runner': PlaywrightRunner,
  '@visual-uat/pixelmatch-differ': PixelmatchDiffer,
  '@visual-uat/claude-evaluator': ClaudeEvaluator
};
```

To:
```typescript
private builtins: Record<string, any> = {
  '@visual-uat/stub-generator': StubTestGenerator,
  '@visual-uat/web-runner': WebRunner,
  '@visual-uat/pixelmatch-differ': PixelmatchDiffer,
  '@visual-uat/claude-evaluator': ClaudeEvaluator
};
```

**Step 3: Update import in plugin-registry.test.ts**

In `src/orchestrator/services/plugin-registry.test.ts`, change:
```typescript
import { PlaywrightRunner } from '../../plugins/playwright-runner';
```

To:
```typescript
import { WebRunner } from '../../plugins/web-runner';
```

**Step 4: Update test config in plugin-registry.test.ts**

Find all occurrences of `'@visual-uat/playwright-runner'` and replace with `'@visual-uat/web-runner'`.

Expected: ~5-10 occurrences in test config objects

**Step 5: Update test assertions**

Find any assertions checking for `PlaywrightRunner` type and update to `WebRunner`.

**Step 6: Build and verify**

Run: `npm run build`
Expected: Build succeeds

**Step 7: Run plugin registry tests**

Run: `npm test -- plugin-registry.test.ts`
Expected: All tests pass

**Step 8: Commit**

```bash
git add src/orchestrator/services/plugin-registry.ts src/orchestrator/services/plugin-registry.test.ts
git commit -m "refactor: update plugin registry for WebRunner

Update builtin plugin mapping from @visual-uat/playwright-runner to
@visual-uat/web-runner. Update tests accordingly.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Update All Other Imports

**Files:**
- Modify: `src/orchestrator/handlers/run-command.test.ts`
- Modify: `src/orchestrator/services/server-manager.test.ts`
- Modify: `src/orchestrator/services/test-runner.test.ts`
- Modify: Any other files importing PlaywrightRunner

**Step 1: Find all files importing PlaywrightRunner**

Run: `grep -r "from.*playwright-runner" src/ --include="*.ts" | grep -v ".d.ts"`
Expected: List of files that need updating

**Step 2: Update run-command.test.ts**

If file imports PlaywrightRunner, change:
```typescript
import { PlaywrightRunner } from '../plugins/playwright-runner';
```

To:
```typescript
import { WebRunner } from '../plugins/web-runner';
```

And update all `PlaywrightRunner` references to `WebRunner`.

**Step 3: Update server-manager.test.ts**

Same pattern - update import and all references.

**Step 4: Update test-runner.test.ts**

Same pattern - update import and all references.

**Step 5: Search for any remaining references**

Run: `grep -r "PlaywrightRunner" src/ --include="*.ts" | grep -v ".d.ts"`
Expected: Only comments or none remaining

**Step 6: Build to verify**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 7: Run affected tests**

Run: `npm test -- run-command.test.ts server-manager.test.ts test-runner.test.ts`
Expected: All tests pass

**Step 8: Commit**

```bash
git add src/orchestrator/handlers/run-command.test.ts src/orchestrator/services/server-manager.test.ts src/orchestrator/services/test-runner.test.ts
git commit -m "refactor: update imports to use WebRunner

Update all test imports from PlaywrightRunner to WebRunner.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Update Configuration Files

**Files:**
- Modify: `examples/demo-app/visual-uat.config.js`
- Modify: `visual-uat.config.js` (root, if exists)

**Step 1: Update demo app config**

In `examples/demo-app/visual-uat.config.js`, change:
```javascript
plugins: {
  testGenerator: '@visual-uat/stub-generator',
  targetRunner: '@visual-uat/playwright-runner',
  differ: '@visual-uat/pixelmatch-differ',
  evaluator: '@visual-uat/claude-evaluator'
}
```

To:
```javascript
plugins: {
  testGenerator: '@visual-uat/stub-generator',
  targetRunner: '@visual-uat/web-runner',
  differ: '@visual-uat/pixelmatch-differ',
  evaluator: '@visual-uat/claude-evaluator'
}
```

**Step 2: Check for root config**

Run: `ls visual-uat.config.js 2>/dev/null`

If exists, update it with same pattern.

**Step 3: Search for any other config files**

Run: `find . -name "visual-uat.config.js" -o -name "*.config.js" | grep -v node_modules`
Expected: Lists all config files

Update any that reference the old plugin name.

**Step 4: Commit**

```bash
git add examples/demo-app/visual-uat.config.js
# Add any other config files found
git commit -m "config: update plugin name to @visual-uat/web-runner

Update all configuration files to use new plugin name.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: Update Type Definitions

**Files:**
- Check: `src/types/config.ts` - may reference runner type

**Step 1: Check config types**

Run: `grep -n "PlaywrightRunner\|playwright" src/types/config.ts`
Expected: May find references to update, or none

**Step 2: Update any type references**

If found, update references from PlaywrightRunner to WebRunner or from "playwright" to "web" in type names.

**Step 3: Build to verify**

Run: `npm run build`
Expected: Build succeeds

**Step 4: Commit if changes made**

```bash
git add src/types/config.ts
git commit -m "types: update config types for WebRunner

Update type definitions to reference WebRunner.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

(Skip commit if no changes needed)

---

## Task 7: Run Full Test Suite

**Files:**
- None - verification only

**Step 1: Clean build**

```bash
rm -rf dist/
npm run build
```

Expected: Build completes successfully

**Step 2: Run all tests**

Run: `npm test`
Expected: All 167 tests pass (23 test suites)

**Step 3: Verify no references to old name**

Run: `grep -r "PlaywrightRunner" src/ dist/ --include="*.ts" --include="*.js" | grep -v "node_modules" | grep -v ".d.ts"`
Expected: No results (or only comments)

**Step 4: Check git status**

Run: `git status`
Expected: Working directory clean

---

## Task 8: Update Documentation

**Files:**
- Modify: `README.md` (add examples section)
- Create: `docs/examples/target-runners.md` (comprehensive examples)

**Step 1: Add examples section to README**

In `README.md`, add a new section after installation:

```markdown
## Target Runner Examples

Visual-uat works with any web server. Configure the `targetRunner` in your `visual-uat.config.js`:

### Node.js (npm)
```javascript
targetRunner: {
  startCommand: 'npm start'
}
```

### Static Files (npx serve)
```javascript
targetRunner: {
  startCommand: 'npx serve -l $PORT tests/fixtures'
}
```

### Python (http.server)
```javascript
targetRunner: {
  startCommand: 'cd tests/fixtures && python -m http.server $PORT'
}
```

### Go
```javascript
targetRunner: {
  startCommand: 'go run main.go'
}
```

### Elixir Phoenix
```javascript
targetRunner: {
  startCommand: 'mix phx.server'
}
```

For more examples, see [docs/examples/target-runners.md](docs/examples/target-runners.md)
```

**Step 2: Create comprehensive examples doc**

Create `docs/examples/target-runners.md`:

```markdown
# Target Runner Examples

The WebRunner plugin supports any web server. It spawns your command, waits for the server to respond, and manages its lifecycle.

## Environment Variables

The runner passes these environment variables to your command:
- `PORT` - Auto-allocated port number
- `BASE_URL` - Full URL (e.g., http://localhost:3000)
- `BRANCH` - Git branch being tested

## Examples by Language/Framework

### Node.js

**Express/Koa/Fastify (npm):**
```javascript
targetRunner: {
  startCommand: 'npm start'
}
```

**Custom port handling:**
```javascript
targetRunner: {
  startCommand: 'node server.js',
  baseUrl: 'http://localhost'
}
```

### Static Content

**npx serve:**
```javascript
targetRunner: {
  startCommand: 'npx serve -l $PORT ./public'
}
```

**Python http.server:**
```javascript
targetRunner: {
  startCommand: 'cd ./public && python -m http.server $PORT'
}
```

**Go's built-in server:**
```javascript
targetRunner: {
  startCommand: 'go run cmd/static-server/main.go -port=$PORT'
}
```

### Go

**Standard http package:**
```javascript
targetRunner: {
  startCommand: 'go run main.go'
}
```

**Gin framework:**
```javascript
targetRunner: {
  startCommand: 'GIN_MODE=release go run main.go'
}
```

### Python

**Flask:**
```javascript
targetRunner: {
  startCommand: 'flask run --port $PORT'
}
```

**Django:**
```javascript
targetRunner: {
  startCommand: 'python manage.py runserver $PORT'
}
```

**FastAPI:**
```javascript
targetRunner: {
  startCommand: 'uvicorn main:app --port $PORT'
}
```

### Ruby

**Rails:**
```javascript
targetRunner: {
  startCommand: 'rails server -p $PORT'
}
```

**Sinatra:**
```javascript
targetRunner: {
  startCommand: 'ruby app.rb -p $PORT'
}
```

### Elixir

**Phoenix:**
```javascript
targetRunner: {
  startCommand: 'mix phx.server',
  baseUrl: 'http://localhost:4000'
}
```

### Rust

**Actix-web:**
```javascript
targetRunner: {
  startCommand: 'cargo run --release'
}
```

## Testing HTML Reports (Self-Testing)

To test visual-uat's own HTML reports:

```javascript
// visual-uat.config.js
module.exports = {
  plugins: {
    targetRunner: '@visual-uat/web-runner',
    // ...
  },
  targetRunner: {
    startCommand: 'npx serve -l $PORT tests/fixtures'
  }
};
```

```typescript
// tests/generated/html-report.spec.ts
test('HTML Report UI', async ({ page }) => {
  await page.goto(process.env.BASE_URL + '/sample-report.html');
  await screenshotCheckpoint(page, 'full-report');
});
```

## Custom Server Setup

If your server needs special setup:

```javascript
targetRunner: {
  startCommand: 'npm run db:seed && npm start',
  baseUrl: 'http://localhost:3000'
}
```

## Timeout Configuration

The runner waits 30 seconds for your server to respond. If your app needs longer:

```javascript
targetRunner: {
  startCommand: 'npm start',
  // Note: Timeout configuration not yet implemented
  // File an issue if you need this feature
}
```
```

**Step 3: Create examples directory**

```bash
mkdir -p docs/examples
```

**Step 4: Verify documentation renders**

Read through both files to ensure markdown formatting is correct.

**Step 5: Commit**

```bash
git add README.md docs/examples/target-runners.md
git commit -m "docs: add comprehensive target runner examples

Add examples showing WebRunner works with any web server:
- Node.js (npm, Express, etc.)
- Static files (serve, Python, Go)
- Go (standard lib, Gin)
- Python (Flask, Django, FastAPI)
- Ruby (Rails, Sinatra)
- Elixir (Phoenix)
- Rust (Actix-web)

Includes self-testing example for HTML reports.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Final Verification

**Files:**
- None - verification only

**Step 1: Clean and rebuild**

```bash
rm -rf dist/ node_modules/
npm install
npm run build
```

Expected: Clean build with no errors

**Step 2: Run full test suite**

Run: `npm test`
Expected: All 167 tests pass

**Step 3: Test demo app**

```bash
cd examples/demo-app
npm install
cd ../..
# Don't run visual-uat yet - just verify config is valid
node dist/cli.js --version
```

Expected: Version prints successfully

**Step 4: Verify no old references**

```bash
grep -r "playwright-runner" . --include="*.ts" --include="*.js" --include="*.json" --include="*.md" | grep -v "node_modules" | grep -v "dist/"
```

Expected: No results (or only in changelog/git history)

**Step 5: Review all commits**

Run: `git log --oneline feature/web-runner-rename ^feature/test-visual-change`
Expected: Shows all commits with clear messages

**Step 6: Push branch**

```bash
git push -u origin feature/web-runner-rename
```

Expected: Branch pushed successfully

---

## Success Criteria

- [ ] All files renamed from `playwright-runner` to `web-runner`
- [ ] All class references updated from `PlaywrightRunner` to `WebRunner`
- [ ] Plugin registry updated to `@visual-uat/web-runner`
- [ ] All tests passing (167 tests, 23 suites)
- [ ] Build succeeds with no errors
- [ ] Configuration files updated
- [ ] Documentation includes comprehensive examples
- [ ] No references to old name remain in source
- [ ] All changes committed with clear messages

## References

- Design document: `docs/plans/2025-11-20-web-runner-rename-design.md`
- Plugin interface: `src/types/plugins.ts`
- Original implementation: `src/plugins/web-runner.ts` (formerly playwright-runner.ts)
