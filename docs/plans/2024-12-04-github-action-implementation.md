# GitHub Action Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create a reusable GitHub Action for the Marketplace that runs visual-uat in CI/CD pipelines.

**Architecture:** Composite action using shell steps - installs visual-uat via npm, runs tests, uploads artifacts. Simple and maintainable.

**Tech Stack:** GitHub Actions (composite), Node.js, Playwright, Bash

---

### Task 1: Create action.yml with metadata and inputs

**Files:**
- Create: `action.yml`

**Step 1: Create the action.yml file with metadata and inputs**

```yaml
name: 'Visual UAT'
description: 'Run visual acceptance tests comparing screenshots between branches with AI-powered evaluation'
author: '2389-research'

branding:
  icon: 'eye'
  color: 'orange'

inputs:
  anthropic-api-key:
    description: 'Anthropic API key for LLM evaluation (pass from secrets)'
    required: true
  working-directory:
    description: 'Directory containing visual-uat.config.js'
    required: false
    default: '.'
  node-version:
    description: 'Node.js version to use'
    required: false
    default: '20'
  verbose:
    description: 'Enable verbose output'
    required: false
    default: 'false'
  fail-fast:
    description: 'Stop on first test failure'
    required: false
    default: 'false'
  base-branch:
    description: 'Override base branch for comparison (default: from config)'
    required: false
    default: ''
  extra-args:
    description: 'Additional CLI arguments (e.g., "--no-html --quiet")'
    required: false
    default: ''

outputs:
  result:
    description: 'Test result: passed, failed, or errored'
    value: ${{ steps.run-tests.outputs.result }}
  report-path:
    description: 'Path to the HTML report'
    value: ${{ steps.run-tests.outputs.report-path }}

runs:
  using: 'composite'
  steps: []
```

**Step 2: Verify file was created**

Run: `cat action.yml | head -20`
Expected: Shows name, description, and start of inputs

**Step 3: Commit**

```bash
git add action.yml
git commit -m "feat(action): add action.yml with metadata and inputs"
```

---

### Task 2: Add validation step to action.yml

**Files:**
- Modify: `action.yml`

**Step 1: Add the validation step to the runs.steps array**

Replace `steps: []` with:

```yaml
  steps:
    - name: Validate Anthropic API key
      shell: bash
      run: |
        if [ -z "${{ inputs.anthropic-api-key }}" ]; then
          echo "::error title=Missing API Key::ANTHROPIC_API_KEY is required for LLM evaluation."
          echo "::error::Add it to your repository secrets and pass it as:"
          echo "::error::  with:"
          echo "::error::    anthropic-api-key: \${{ secrets.ANTHROPIC_API_KEY }}"
          exit 1
        fi
        echo "✓ Anthropic API key provided"
```

**Step 2: Verify YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('action.yml'))"`
Expected: No output (valid YAML)

**Step 3: Commit**

```bash
git add action.yml
git commit -m "feat(action): add API key validation with actionable error"
```

---

### Task 3: Add Node.js setup step

**Files:**
- Modify: `action.yml`

**Step 1: Add setup-node step after validation**

Add after the validation step:

```yaml
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}
```

**Step 2: Verify YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('action.yml'))"`
Expected: No output (valid YAML)

**Step 3: Commit**

```bash
git add action.yml
git commit -m "feat(action): add Node.js setup step"
```

---

### Task 4: Add visual-uat and Playwright installation steps

**Files:**
- Modify: `action.yml`

**Step 1: Add installation steps**

Add after setup-node step:

```yaml
    - name: Install visual-uat
      shell: bash
      run: |
        echo "Installing visual-uat..."
        npm install -g visual-uat
        echo "✓ visual-uat installed: $(visual-uat --version || echo 'version check not available')"

    - name: Install Playwright browsers
      shell: bash
      working-directory: ${{ inputs.working-directory }}
      run: |
        echo "Installing Playwright Chromium..."
        npx playwright install --with-deps chromium
        echo "✓ Playwright browsers installed"
```

**Step 2: Verify YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('action.yml'))"`
Expected: No output (valid YAML)

**Step 3: Commit**

```bash
git add action.yml
git commit -m "feat(action): add visual-uat and Playwright installation"
```

---

### Task 5: Add the main test execution step

**Files:**
- Modify: `action.yml`

**Step 1: Add run-tests step**

Add after Playwright installation:

```yaml
    - name: Run visual-uat
      id: run-tests
      shell: bash
      working-directory: ${{ inputs.working-directory }}
      env:
        ANTHROPIC_API_KEY: ${{ inputs.anthropic-api-key }}
      run: |
        echo "Running visual-uat..."

        # Build command with optional flags
        CMD="visual-uat run"

        if [ "${{ inputs.verbose }}" = "true" ]; then
          CMD="$CMD --verbose"
        fi

        if [ "${{ inputs.fail-fast }}" = "true" ]; then
          CMD="$CMD --fail-fast"
        fi

        if [ -n "${{ inputs.base-branch }}" ]; then
          CMD="$CMD --base ${{ inputs.base-branch }}"
        fi

        if [ -n "${{ inputs.extra-args }}" ]; then
          CMD="$CMD ${{ inputs.extra-args }}"
        fi

        echo "Executing: $CMD"

        # Run and capture exit code
        set +e
        $CMD
        EXIT_CODE=$?
        set -e

        # Set outputs
        echo "report-path=${{ inputs.working-directory }}/.visual-uat/reports/latest.html" >> $GITHUB_OUTPUT

        if [ $EXIT_CODE -eq 0 ]; then
          echo "result=passed" >> $GITHUB_OUTPUT
          echo "✓ Visual tests passed"
        else
          echo "result=failed" >> $GITHUB_OUTPUT
          echo "✗ Visual tests failed (exit code: $EXIT_CODE)"
          exit $EXIT_CODE
        fi
```

**Step 2: Verify YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('action.yml'))"`
Expected: No output (valid YAML)

**Step 3: Commit**

```bash
git add action.yml
git commit -m "feat(action): add main test execution step with outputs"
```

---

### Task 6: Add artifact upload step

**Files:**
- Modify: `action.yml`

**Step 1: Add upload-artifact step**

Add as the final step:

```yaml
    - name: Upload report and diffs
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: visual-uat-report
        path: |
          ${{ inputs.working-directory }}/.visual-uat/reports/
          ${{ inputs.working-directory }}/.visual-uat/diffs/
          ${{ inputs.working-directory }}/.visual-uat/screenshots/
        if-no-files-found: warn
```

**Step 2: Verify YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('action.yml'))"`
Expected: No output (valid YAML)

**Step 3: Commit**

```bash
git add action.yml
git commit -m "feat(action): add artifact upload for reports and diffs"
```

---

### Task 7: Update README with GitHub Action usage

**Files:**
- Modify: `README.md`

**Step 1: Read current README structure**

Run: `cat README.md | head -50`

**Step 2: Add GitHub Action section to README**

Add a new section (find appropriate location after installation/usage):

```markdown
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

### Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `anthropic-api-key` | Yes | - | Anthropic API key for LLM evaluation |
| `working-directory` | No | `.` | Directory containing visual-uat.config.js |
| `node-version` | No | `20` | Node.js version to use |
| `verbose` | No | `false` | Enable verbose output |
| `fail-fast` | No | `false` | Stop on first test failure |
| `base-branch` | No | - | Override base branch for comparison |
| `extra-args` | No | - | Additional CLI arguments |

### Action Outputs

| Output | Description |
|--------|-------------|
| `result` | Test result: `passed`, `failed`, or `errored` |
| `report-path` | Path to the HTML report |

### Artifacts

The action automatically uploads these artifacts:
- `visual-uat-report/reports/` - HTML reports
- `visual-uat-report/diffs/` - Visual diff images
- `visual-uat-report/screenshots/` - Captured screenshots
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add GitHub Action usage to README"
```

---

### Task 8: Create example workflow file

**Files:**
- Create: `.github/workflows/example-visual-uat.yml.example`

**Step 1: Create example workflow**

```yaml
# Example workflow for using visual-uat GitHub Action
# Copy this to .github/workflows/visual-uat.yml in your project

name: Visual UAT

on:
  pull_request:
    branches: [main]
  # Optional: run on push to main for baseline updates
  push:
    branches: [main]

jobs:
  visual-tests:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          # IMPORTANT: fetch-depth: 0 is required for branch comparison
          fetch-depth: 0

      - name: Run Visual UAT
        id: visual-uat
        uses: 2389-research/visual-uat@v1
        with:
          anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
          # Optional inputs:
          # verbose: true
          # fail-fast: true
          # base-branch: main
          # working-directory: ./frontend

      # Optional: Comment on PR with results
      - name: Comment on PR
        if: always() && github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const result = '${{ steps.visual-uat.outputs.result }}';
            const emoji = result === 'passed' ? '✅' : '❌';
            const runUrl = `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `${emoji} **Visual UAT ${result}**\n\n[View report and artifacts](${runUrl})`
            });
```

**Step 2: Verify file created**

Run: `cat .github/workflows/example-visual-uat.yml.example | head -20`
Expected: Shows the example workflow header

**Step 3: Commit**

```bash
git add .github/workflows/example-visual-uat.yml.example
git commit -m "docs: add example workflow file for reference"
```

---

### Task 9: Final verification and integration test prep

**Files:**
- Review: `action.yml`

**Step 1: Verify complete action.yml structure**

Run: `cat action.yml`
Expected: Complete action with all steps: validation, setup-node, install visual-uat, install playwright, run tests, upload artifacts

**Step 2: Verify YAML is valid**

Run: `python3 -c "import yaml; print(yaml.safe_load(open('action.yml'))['runs']['steps'].__len__(), 'steps')"`
Expected: `6 steps`

**Step 3: Run project tests to ensure nothing broke**

Run: `npm test 2>&1 | tail -5`
Expected: All tests passing

**Step 4: Build to ensure TypeScript compiles**

Run: `npm run build`
Expected: No errors

**Step 5: Final commit for any remaining changes**

```bash
git status
# If any uncommitted changes:
git add -A
git commit -m "chore: final cleanup for GitHub Action"
```

---

### Task 10: Update ROADMAP.md

**Files:**
- Modify: `docs/ROADMAP.md`

**Step 1: Mark GitHub Action as complete**

Change:
```markdown
- [ ] **GitHub Action** - Publish as a reusable GitHub Action for CI/CD integration
```

To:
```markdown
- [x] **GitHub Action** - Publish as a reusable GitHub Action for CI/CD integration
```

**Step 2: Commit**

```bash
git add docs/ROADMAP.md
git commit -m "docs: mark GitHub Action as complete in roadmap"
```

---

## Post-Implementation

After all tasks complete:

1. **Create PR** - Push branch and create pull request
2. **Test in real workflow** - Create a test repo or use a branch to verify the action works
3. **Publish to Marketplace** - After merge, tag a release (v1.0.0) to publish

