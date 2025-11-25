# visual-uat

Visual acceptance testing with LLM-powered test generation.

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

## Smart Image Diffing

Visual-UAT uses intelligent image comparison that handles:

- ✅ Different-sized images (no more dimension errors!)
- ✅ Content insertions without false positives on shifted content
- ✅ Content deletions with accurate change detection
- ✅ Layout reordering with content-aware matching
- ✅ Backward compatible with same-size image comparisons

### How It Works

Smart diffing uses a two-tier hybrid approach:

1. **Tier 1: Adaptive Alignment (Fast Path)** - Row-by-row comparison with sliding window search for common cases
2. **Tier 2: Feature-Based Matching (Fallback)** - Perceptual hashing and block matching for complex restructuring

### Configuration

```javascript
// visual-uat.config.js
module.exports = {
  plugins: {
    differ: '@visual-uat/smart-differ', // Default
  },
  smartDiffer: {
    adaptiveThreshold: 0.95,    // Similarity required for row match
    searchWindow: 50,           // ±N rows to search for alignment
    blockSize: 50,              // Rows per feature block
    fallbackThreshold: 3        // Misalignments before fallback
  }
};
```

For more details, see [docs/smart-differ-guide.md](docs/smart-differ-guide.md)

## Dogfooding: Testing the HTML Reporter

Visual-uat tests its own HTML report structure to catch visual regressions.

### Generate Fixture Report
```bash
npm run setup:dogfood
```

This runs visual-uat on the demo-app, generating an HTML report at `examples/demo-app/.visual-uat/reports/<timestamp>-<runId>.html`.

### Test Report Structure
```bash
npm run test:dogfood
```

This serves the generated reports and captures screenshots to verify the HTML structure hasn't broken.

### Use Case
When modifying `src/plugins/html-reporter.ts`, run both commands to see visual diffs of your changes.

## Port Configuration

Visual-UAT runs two dev servers simultaneously (base branch and current branch) and automatically finds available ports.

### Automatic Port Detection (Default)

```bash
visual-uat run --all
# Output: Using dynamic ports: base=54102, current=54103
```

Ports are auto-detected using OS port allocation (bind to port 0), ensuring no conflicts with existing processes.

### Manual Port Specification

```bash
# Specify both ports explicitly
visual-uat run --base-port 3000 --current-port 3001

# Specify one, auto-detect the other
visual-uat run --base-port 3000
```

### Using $PORT in startCommand

The `$PORT` variable is expanded in your `startCommand`:

```javascript
targetRunner: {
  startCommand: 'npx serve . -l $PORT'  // $PORT replaced with actual port
}
```

The `PORT` environment variable is also set, so servers that read from `process.env.PORT` work automatically.

## LLM Evaluator

Visual-UAT uses Claude to evaluate whether visual changes are intentional or regressions.

### How It Works

1. Screenshots are captured from both branches
2. Smart diffing identifies visual differences
3. Claude evaluates the changes against:
   - **Test intent** (from your spec file)
   - **Code changes** (git diff between branches)
   - **Visual diff metrics** (percentage changed, regions affected)

### Git Diff Context

The evaluator receives context about what code changed between branches:

```
Commits:
abc123 feat: add real images to cards
def456 fix: adjust card spacing

Changes: 3 files changed, 45 insertions(+), 12 deletions(-)

Files changed:
 src/components/Card.tsx | 35 ++++++++++++++++++++++++++++++++---
 src/styles/cards.css    | 15 +++++++++++----
 public/images/card1.png | Bin 0 -> 24532 bytes
```

This helps the evaluator understand *why* visual changes occurred and whether they align with the developer's intent.

### Configuration

```javascript
// visual-uat.config.js
module.exports = {
  evaluator: {
    autoPassThreshold: 0.95,  // Auto-pass if confidence >= 95%
    autoFailThreshold: 0.30   // Auto-fail if confidence <= 30%
  }
};
```

Changes between thresholds are flagged as "needs review" for human judgment.
