# Test Definition Redesign

Two-stage LLM translation with hash-based caching for stable, extensible test generation.

## Problem

Current test definitions are unstructured markdown where "intent" is the raw file content. This makes test generation fragile and couples the format tightly to Playwright.

## Solution

A three-tier architecture with LLM translation between each layer:

```
Natural Language Stories → BDD Specifications → Generated Tests
```

Each translation is cached via content hashing - unchanged inputs skip regeneration.

## File Structure

```
tests/
└── stories/                    # USER-WRITTEN (natural language)
    └── shopping-cart.story.md

.visual-uat/
├── specs/                      # GENERATED (BDD - inspectable)
│   └── shopping-cart.spec.md
├── generated/                  # GENERATED (runner-specific tests)
│   └── shopping-cart.spec.ts
└── manifest.json               # Hashes for change detection
```

**Boundary:** Users only write in `tests/stories/`. Everything in `.visual-uat/` is derived.

## Layer 1: Story Format (Natural Language)

**File:** `tests/stories/shopping-cart.story.md`

```markdown
# Add Item to Shopping Cart

As a customer browsing products, I want to add an item to my cart
so that I can purchase it later.

## Scenario

1. I'm on the products page
2. I see a product I want
3. I click the "Add to Cart" button
4. The cart icon updates to show 1 item
5. I see a confirmation toast message

## Visual Checkpoints

- After clicking add: cart badge visible with count
- Toast message appears and is styled correctly
```

**Characteristics:**
- Pure natural language, no special syntax
- User-story style ("As a... I want... so that...")
- Scenarios describe behavior, not implementation
- Checkpoints are named concepts, not CSS selectors

## Layer 2: BDD Format (Generated Intermediate)

**File:** `.visual-uat/specs/shopping-cart.spec.md`

```markdown
# Add Item to Shopping Cart

## Metadata
- story: tests/stories/shopping-cart.story.md
- story_hash: abc123
- generated: 2024-12-02T10:30:00Z

## Feature: Shopping Cart

Scenario: Add item to cart
  Given I am on the "/products" page
  When I click the "Add to Cart" button
  Then I should see the cart badge show "1"
  And I should see a toast notification

  Checkpoint: cart-updated
    - capture: full-page
    - focus: [".cart-badge", ".toast-notification"]

Scenario: Toast dismisses after delay
  Given the toast notification is visible
  When I wait 3 seconds
  Then the toast should no longer be visible

  Checkpoint: toast-dismissed
    - capture: full-page
```

**Characteristics:**
- Standard Gherkin syntax (Given/When/Then)
- Metadata links back to source story + hash
- Checkpoints embedded with capture hints
- LLM extracts selectors/timing from context
- Human-readable and structured for parsing

## Layer 3: Generated Tests (Runner-Specific)

**File:** `.visual-uat/generated/shopping-cart.spec.ts`

```typescript
// ABOUTME: Auto-generated Playwright test from shopping-cart.spec.md
// ABOUTME: Do not edit directly - regenerate from story or spec

import { test } from '@playwright/test';
import { screenshotCheckpoint } from '@visual-uat/playwright-helpers';

test.describe('Add Item to Shopping Cart', () => {

  test('Add item to cart', async ({ page }) => {
    // Given I am on the "/products" page
    await page.goto(process.env.BASE_URL + '/products');

    // When I click the "Add to Cart" button
    await page.click('text=Add to Cart');

    // Then I should see the cart badge show "1"
    await expect(page.locator('.cart-badge')).toContainText('1');

    // And I should see a toast notification
    await expect(page.locator('.toast-notification')).toBeVisible();

    // Checkpoint: cart-updated
    await screenshotCheckpoint(page, 'cart-updated', {
      focus: ['.cart-badge', '.toast-notification']
    });
  });

  test('Toast dismisses after delay', async ({ page }) => {
    // Given the toast notification is visible
    await expect(page.locator('.toast-notification')).toBeVisible();

    // When I wait 3 seconds
    await page.waitForTimeout(3000);

    // Then the toast should no longer be visible
    await expect(page.locator('.toast-notification')).not.toBeVisible();

    // Checkpoint: toast-dismissed
    await screenshotCheckpoint(page, 'toast-dismissed');
  });

});
```

**Characteristics:**
- Comments preserve Gherkin steps for traceability
- LLM infers selectors from BDD + page context
- Checkpoint helper handles screenshot capture
- Fully regenerated, never manually edited

## Change Detection

**Manifest:** `.visual-uat/manifest.json`

```json
{
  "stories": {
    "shopping-cart.story.md": {
      "contentHash": "sha256:abc123...",
      "specPath": "specs/shopping-cart.spec.md",
      "specHash": "sha256:def456..."
    }
  },
  "specs": {
    "shopping-cart.spec.md": {
      "contentHash": "sha256:def456...",
      "testPath": "generated/shopping-cart.spec.ts",
      "sourceStory": "shopping-cart.story.md"
    }
  }
}
```

**Regeneration rules:**

| Story Changed? | Action |
|----------------|--------|
| No | Skip (use cached spec + test) |
| Yes | Regenerate spec → regenerate test |

**CLI feedback:**
```
$ visual-uat generate

Checking stories...
  ✓ shopping-cart.story.md (unchanged, skipping)
  ↻ checkout-flow.story.md (changed, regenerating spec)

Generated: 1 spec, 1 test
Skipped: 1 (unchanged)
```

## Plugin Architecture

The BDD layer is runner-agnostic. Different runners translate BDD to their platform:

```
BDD (Given/When/Then)
    ↓
    ├── playwright-runner  → .spec.ts (web browsers)
    ├── tui-runner         → .spec.ts (terminal apps)
    ├── swift-runner       → .swift (iOS/macOS native)
    └── future-runner      → whatever
```

**Runner plugin interface:**

```typescript
interface TestRunnerPlugin {
  name: string;                    // e.g., "playwright", "cypress"
  fileExtension: string;           // e.g., ".spec.ts"

  // Generate test code from parsed BDD
  generate(spec: ParsedBDDSpec): string;

  // Execute the generated test
  execute(testPath: string, context: ExecutionContext): TestResult;
}
```

**Config:**

```javascript
// visual-uat.config.js
module.exports = {
  runner: 'playwright',  // or 'tui', 'swift', etc.
};
```

Story authors describe **behavior**. Runner plugins handle **implementation**.

## Benefits

1. **Stability** - Hash-based caching prevents unnecessary regeneration
2. **Debuggability** - BDD layer is human-readable intermediate format
3. **Extensibility** - New runners just implement the plugin interface
4. **Simplicity** - Users only write natural language stories
5. **Traceability** - Each layer links back to its source
