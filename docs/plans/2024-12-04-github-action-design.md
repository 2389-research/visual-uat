# GitHub Action Design

## Overview

Reusable GitHub Action for the GitHub Marketplace, allowing other projects to run visual-uat in their CI/CD pipelines.

## Architecture Decision

**Composite action** - Simple shell-based action.yml that installs visual-uat via npm and runs it.

Trade-offs considered:
- JavaScript action: Fast but complex to maintain
- Docker action: Isolated but slow startup (~2GB image with Playwright)
- **Composite action**: Simple, transparent, easy maintenance, ~30s setup

## Action Inputs

```yaml
inputs:
  # Required
  anthropic-api-key:
    description: 'Anthropic API key for LLM evaluation (pass from secrets)'
    required: true

  # Directory/Environment
  working-directory:
    description: 'Directory containing visual-uat.config.js'
    required: false
    default: '.'
  node-version:
    description: 'Node.js version to use'
    required: false
    default: '20'

  # Common CLI flags (explicit)
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

  # Passthrough for edge cases
  extra-args:
    description: 'Additional CLI arguments (e.g., "--no-html --quiet")'
    required: false
    default: ''
```

## Action Outputs

```yaml
outputs:
  result:
    description: 'Test result: passed, failed, or errored'
  report-path:
    description: 'Path to the HTML report'
```

## Action Steps

1. **Validate Anthropic API key** - Fail early with actionable error message
2. **Setup Node.js** - Use actions/setup-node@v4
3. **Install visual-uat** - Global npm install
4. **Install Playwright browsers** - Chromium only for speed
5. **Run visual-uat** - Execute with configured flags
6. **Upload artifacts** - Always upload reports/diffs (even on failure)

## Composite Action Implementation

```yaml
runs:
  using: 'composite'
  steps:
    - name: Validate Anthropic API key
      shell: bash
      run: |
        if [ -z "${{ inputs.anthropic-api-key }}" ]; then
          echo "::error::ANTHROPIC_API_KEY is required for LLM evaluation."
          echo "::error::Add it to your repository secrets and pass it as:"
          echo "::error::  anthropic-api-key: \${{ secrets.ANTHROPIC_API_KEY }}"
          exit 1
        fi

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: ${{ inputs.node-version }}

    - name: Install visual-uat
      shell: bash
      run: npm install -g visual-uat

    - name: Install Playwright browsers
      shell: bash
      working-directory: ${{ inputs.working-directory }}
      run: npx playwright install --with-deps chromium

    - name: Run visual-uat
      id: run-tests
      shell: bash
      working-directory: ${{ inputs.working-directory }}
      env:
        ANTHROPIC_API_KEY: ${{ inputs.anthropic-api-key }}
      run: |
        visual-uat run \
          ${{ inputs.verbose == 'true' && '--verbose' || '' }} \
          ${{ inputs.fail-fast == 'true' && '--fail-fast' || '' }} \
          ${{ inputs.base-branch && format('--base {0}', inputs.base-branch) || '' }} \
          ${{ inputs.extra-args }} | tee output.log

        echo "report-path=${{ inputs.working-directory }}/.visual-uat/reports/latest.html" >> $GITHUB_OUTPUT

    - name: Upload report and diffs
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: visual-uat-report
        path: |
          ${{ inputs.working-directory }}/.visual-uat/reports/
          ${{ inputs.working-directory }}/.visual-uat/diffs/
```

## Example User Workflow

Users add this to `.github/workflows/visual-uat.yml`:

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

      - name: Download report
        uses: actions/download-artifact@v4
        with:
          name: visual-uat-report
          path: ./report

      # Optional: Comment on PR with results
      - name: Comment on PR
        if: always()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: '📸 Visual UAT complete! [Download report](https://github.com/${{ github.repository }}/actions/runs/${{ github.run_id }})'
            })
```

## Key Requirements

- `fetch-depth: 0` in checkout - Required for git worktree branch comparisons
- `ANTHROPIC_API_KEY` secret - Required for LLM evaluation
- `visual-uat.config.js` in working directory - Standard project config

## Artifacts

Uploaded automatically on every run (even failures):
- `.visual-uat/reports/` - HTML reports
- `.visual-uat/diffs/` - Visual diff images
