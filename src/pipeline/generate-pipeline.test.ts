// ABOUTME: Integration tests for the test generation pipeline
// ABOUTME: Tests the full story → BDD → test flow with caching

import * as fs from 'fs';
import * as path from 'path';
import { GeneratePipeline, GenerateResult } from './generate-pipeline';
import { StoryToBDDTranslator } from '../translators/story-to-bdd';
import { PlaywrightRunner } from '../runners/playwright-runner';
import { BDDSpec } from '../types/plugins';

// Mock translators and runners
jest.mock('../translators/story-to-bdd');
jest.mock('../runners/playwright-runner');

const MockedStoryToBDDTranslator = StoryToBDDTranslator as jest.MockedClass<typeof StoryToBDDTranslator>;
const MockedPlaywrightRunner = PlaywrightRunner as jest.MockedClass<typeof PlaywrightRunner>;

describe('GeneratePipeline', () => {
  const testDir = path.join(__dirname, '__test_pipeline__');
  const storiesDir = path.join(testDir, 'tests/stories');
  const visualUatDir = path.join(testDir, '.visual-uat');

  beforeAll(() => {
    fs.mkdirSync(storiesDir, { recursive: true });
    fs.writeFileSync(
      path.join(storiesDir, 'cart.story.md'),
      '# Shopping Cart\n\nAs a customer...'
    );
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    // Setup mocks for translator
    MockedStoryToBDDTranslator.prototype.translate = jest.fn().mockResolvedValue({
      path: '.visual-uat/specs/cart.spec.md',
      sourceStory: 'tests/stories/cart.story.md',
      storyHash: 'abc123',
      generatedAt: '2024-12-02T10:30:00Z',
      feature: 'Shopping Cart',
      scenarios: [{
        name: 'Add item to cart',
        steps: [
          { type: 'given', text: 'I am on the "/products" page' },
          { type: 'when', text: 'I click the "Add to Cart" button' },
          { type: 'then', text: 'I should see the cart badge show "1"' }
        ],
        checkpoints: [
          { name: 'cart-updated', capture: 'full-page', focus: ['.cart-badge'] }
        ]
      }]
    } as BDDSpec);

    // Setup mocks for runner
    MockedPlaywrightRunner.prototype.generate = jest.fn().mockResolvedValue(`
import { test, expect } from '@playwright/test';

test.describe('Shopping Cart', () => {
  test('Add item to cart', async ({ page }) => {
    await page.goto('/products');
    await page.click('text=Add to Cart');
    await expect(page.locator('.cart-badge')).toContainText('1');
  });
});
    `);
  });

  describe('run', () => {
    it('should return generated and skipped counts', async () => {
      const pipeline = new GeneratePipeline(testDir, {
        storiesDir: 'tests/stories',
        runner: 'playwright'
      });

      const result = await pipeline.run();

      expect(result.generated).toBeGreaterThanOrEqual(0);
      expect(result.skipped).toBeGreaterThanOrEqual(0);
      expect(result.errors).toEqual([]);
    });

    it('should skip unchanged stories on second run', async () => {
      const pipeline = new GeneratePipeline(testDir, {
        storiesDir: 'tests/stories',
        runner: 'playwright'
      });

      await pipeline.run(); // First run
      const result = await pipeline.run(); // Second run

      expect(result.skipped).toBeGreaterThan(0);
    });
  });
});
