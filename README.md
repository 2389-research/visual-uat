# visual-uat

Visual acceptance testing with LLM-powered evaluation. Compare screenshots between git branches and let Claude determine if changes are intentional or regressions.

## Overview

visual-uat automates visual regression testing by:

1. **Capturing screenshots** from your web app on two branches (base and current)
2. **Intelligent diffing** that handles layout changes, insertions, and deletions
3. **AI evaluation** using Claude to assess whether changes match developer intent
4. **HTML reports** with side-by-side comparisons and confidence scores

## Quick Start

### Installation

```bash
npm install -g visual-uat
```

### Setup

1. Create `visual-uat.config.js` in your project root:

```javascript
module.exports = {
  baseBranch: 'main',
  specsDir: './specs',
  generatedDir: './tests/generated',
  plugins: {
    testGenerator: '@visual-uat/stub-generator',
    targetRunner: '@visual-uat/web-runner',
    differ: '@visual-uat/smart-differ',
    evaluator: '@visual-uat/claude-evaluator'
  },
  targetRunner: {
    startCommand: 'npm start'
  }
};
```

2. Create a spec file in `specs/`:

```markdown
# Homepage

## Story: User views the homepage
As a visitor, I want to see the homepage so I can understand what the product offers.

### Checkpoints
- Initial load shows hero section
- Navigation is visible
- Footer contains links
```

3. Set your Anthropic API key:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
```

4. Run tests:

```bash
visual-uat run --all
```

## Configuration

### visual-uat.config.js Reference

```javascript
module.exports = {
  // Git branch to compare against
  baseBranch: 'main',

  // Where spec files live
  specsDir: './specs',

  // Where generated Playwright tests go
  generatedDir: './tests/generated',

  // Plugin configuration
  plugins: {
    testGenerator: '@visual-uat/stub-generator',
    targetRunner: '@visual-uat/web-runner',
    differ: '@visual-uat/smart-differ',      // or '@visual-uat/quadtree-differ'
    evaluator: '@visual-uat/claude-evaluator'
  },

  // How to start your dev server
  targetRunner: {
    startCommand: 'npm start'  // $PORT is replaced with actual port
  },

  // Smart differ settings
  smartDiffer: {
    adaptiveThreshold: 0.95,    // Similarity required for row match
    searchWindow: 50,           // ±N rows to search for alignment
    blockSize: 50,              // Rows per feature block
    fallbackThreshold: 3        // Misalignments before fallback
  },

  // LLM evaluator settings
  evaluator: {
    autoPassThreshold: 0.95,    // Auto-pass if confidence >= 95%
    autoFailThreshold: 0.30     // Auto-fail if confidence <= 30%
  }
};
```

### Target Runner Examples

visual-uat works with any web server:

```javascript
// Node.js
targetRunner: { startCommand: 'npm start' }

// Static files
targetRunner: { startCommand: 'npx serve -l $PORT ./dist' }

// Python
targetRunner: { startCommand: 'python -m http.server $PORT' }

// Go
targetRunner: { startCommand: 'go run main.go' }

// Elixir Phoenix
targetRunner: { startCommand: 'mix phx.server' }
```

The `$PORT` variable is expanded to the allocated port. The `PORT` environment variable is also set for servers that read from `process.env.PORT`.

### Port Configuration

visual-uat runs two dev servers simultaneously and auto-detects available ports:

```bash
# Automatic (default)
visual-uat run --all
# Output: Using dynamic ports: base=54102, current=54103

# Manual
visual-uat run --base-port 3000 --current-port 3001
```

## CLI Reference

### `visual-uat generate`

Generate Playwright test scripts from spec files.

```bash
visual-uat generate [options]

Options:
  --force     Regenerate all tests (ignore cache)
```

### `visual-uat run`

Execute visual acceptance tests.

```bash
visual-uat run [options]

Options:
  --all                  Force run all tests (ignore change detection)
  --base <branch>        Base branch to compare against
  --fail-fast            Stop on first error
  --keep-worktrees       Keep worktrees after execution for debugging
  --quiet, -q            Minimal output
  --verbose, -v          Detailed output
  --no-html              Skip HTML report generation
  --open, -o             Auto-open HTML report in browser
  --base-port <port>     Port for baseline server
  --current-port <port>  Port for current server
```

### `visual-uat report`

View test results.

```bash
visual-uat report [runId]

Arguments:
  runId       Specific run ID to view (default: latest)

Options:
  --latest    Show latest run
```

## GitHub Action

Use visual-uat in your CI/CD pipeline:

```yaml
name: Visual UAT

on:
  pull_request:
    branches: [main]

jobs:
  visual-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Required for branch comparison

      - name: Run Visual UAT
        uses: 2389-research/visual-uat@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
```

The action auto-detects the PR's target branch for comparison.

### Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `anthropic-api-key` | Yes | - | Anthropic API key for LLM evaluation |
| `working-directory` | No | `.` | Directory containing visual-uat.config.js |
| `node-version` | No | `20` | Node.js version to use |
| `verbose` | No | `false` | Enable verbose output |
| `fail-fast` | No | `false` | Stop on first test failure |
| `base-branch` | No | PR target | Override base branch (auto-detects PR target) |
| `extra-args` | No | - | Additional CLI arguments |

### Action Outputs

| Output | Description |
|--------|-------------|
| `result` | Test result: `passed`, `failed`, or `errored` |
| `report-path` | Path to the HTML report |

### Viewing Reports

Reports are automatically uploaded to a secure Cloudflare hosting service and posted as PR comments:

```markdown
📸 **Visual UAT Report**

[View Report](https://visual-uat-reports.2389-research-inc.workers.dev/...)

**Result:** passed
**Expires:** 2025-12-12T21:19:25.099Z

The report is accessible with a secure token and will automatically expire in 7 days.
```

**Features:**
- **Token-protected URLs** - Each report has a unique 32-character access token
- **7-day expiration** - Reports automatically expire and are deleted
- **No setup required** - Works out of the box for all users
- **Rate limited** - 10 uploads per hour per repository
- **Directory listing** - View all report files and screenshots

**Security:**
- GitHub token verification ensures uploads are from real PRs
- Tokens are scoped to specific org/repo/PR combinations
- Reports are isolated and cannot be accessed without the token
- Automatic cleanup prevents long-term data retention

### Artifacts (Fallback)

If Cloudflare upload fails, the action falls back to GitHub artifacts:
- `visual-uat-report/reports/` - HTML reports
- `visual-uat-report/diffs/` - Visual diff images
- `visual-uat-report/screenshots/` - Captured screenshots

## Architecture

### Three-Tier Test Model

```
Stories (human-readable)
    ↓ translate
BDD Specs (structured scenarios)
    ↓ generate
Playwright Tests (executable)
```

1. **Stories** (`specs/*.md`) - Human-readable descriptions with checkpoints
2. **BDD Specs** - Parsed structured scenarios (internal)
3. **Tests** (`tests/generated/*.spec.ts`) - Playwright tests that capture screenshots

### Plugin System

visual-uat uses a plugin architecture for extensibility:

| Plugin | Purpose | Built-in Options |
|--------|---------|------------------|
| `testGenerator` | Generate Playwright tests | `@visual-uat/stub-generator` |
| `targetRunner` | Start/stop dev servers | `@visual-uat/web-runner` |
| `differ` | Compare screenshots | `@visual-uat/smart-differ`, `@visual-uat/quadtree-differ` |
| `evaluator` | Assess changes | `@visual-uat/claude-evaluator` |

### Directory Structure

```
src/
├── cli.ts              # CLI entry point
├── orchestrator/       # Test execution coordination
│   ├── handlers/       # State machine handlers
│   └── services/       # Server management, test running
├── plugins/            # Built-in plugins
│   ├── smart-differ/   # Intelligent image comparison
│   ├── quadtree-differ/# Spatial diff isolation
│   ├── claude-evaluator/# LLM-powered evaluation
│   └── html-reporter/  # Report generation
├── translators/        # Story → BDD → Test conversion
└── types/              # TypeScript interfaces
```

## Smart Image Diffing

visual-uat uses intelligent image comparison that handles:

- ✅ Different-sized images
- ✅ Content insertions without false positives
- ✅ Content deletions with accurate detection
- ✅ Layout reordering with content-aware matching

### How It Works

Two-tier hybrid approach:

1. **Adaptive Alignment (Fast)** - Row-by-row comparison with sliding window
2. **Feature-Based Matching (Fallback)** - Perceptual hashing for complex restructuring

### Diff Visualization

- 🟠 **Safety Orange** - Modified regions
- 🟢 **Green** - Added content
- 🔴 **Red** - Deleted content

## LLM Evaluator

Claude evaluates whether visual changes are intentional:

### Context Provided

1. **Test intent** from your spec file
2. **Code changes** (git diff between branches)
3. **Visual diff metrics** (percentage changed, regions affected)

### Git Diff Context

The evaluator sees what code changed:

```
Commits:
abc123 feat: add real images to cards

Files changed:
 src/components/Card.tsx | 35 ++++++++++++---
```

This helps determine if visual changes align with developer intent.

### Confidence Thresholds

- **≥ 95%** - Auto-pass (clearly intentional)
- **≤ 30%** - Auto-fail (likely regression)
- **Between** - Flagged for human review

## Contributing

### Development Setup

```bash
# Clone the repo
git clone https://github.com/2389-research/visual-uat.git
cd visual-uat

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Specific file
npm test -- src/plugins/smart-differ/smart-differ.test.ts
```

### Code Style

- TypeScript with strict mode
- All files start with 2-line `// ABOUTME:` comment
- Tests colocated with source (`*.test.ts`)
- Pre-commit hooks enforce formatting (Biome)

### Pull Request Process

1. Create a feature branch
2. Write tests first (TDD)
3. Implement the feature
4. Ensure all tests pass: `npm test`
5. Ensure build succeeds: `npm run build`
6. Create PR with clear description

## Troubleshooting

### "ANTHROPIC_API_KEY is required"

Set your API key in `.env.local`:

```bash
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
```

### "Port already in use"

Use `--base-port` and `--current-port` to specify different ports, or let visual-uat auto-detect:

```bash
visual-uat run --all  # Auto-detects available ports
```

### Screenshots differ but shouldn't

Check if your app has:
- Animations (disable in test mode)
- Dynamic content (mock dates/times)
- Random elements (seed random generators)

### Worktrees not cleaning up

Use `--keep-worktrees` to preserve them for debugging:

```bash
visual-uat run --all --keep-worktrees
```

Worktrees are stored in `.worktrees/` (git-ignored).

### Tests timing out

Increase Playwright timeout in generated tests or check if your server starts slowly.

## License

MIT
