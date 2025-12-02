// ABOUTME: Unit tests for Playwright runner plugin
// ABOUTME: Tests BDD-to-Playwright test code generation

// Mock Anthropic client
const mockCreate = jest.fn();
const mockAnthropicConstructor = jest.fn().mockImplementation(() => ({
  messages: {
    create: mockCreate
  }
}));

jest.mock('@anthropic-ai/sdk', () => mockAnthropicConstructor);

import { PlaywrightRunner } from './playwright-runner';
import { BDDSpec } from '../types/plugins';

describe('PlaywrightRunner', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  describe('generate', () => {
    it('should generate Playwright test code from BDD spec', async () => {
      const expectedCode = `import { test, expect } from '@playwright/test';

test.describe('Shopping Cart', () => {
  test('Add item to cart', async ({ page }) => {
    await page.goto('/products');
    await page.click('text=Add to Cart');
    await expect(page.locator('.cart-badge')).toContainText('1');
  });
});`;

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: expectedCode }]
      });

      const runner = new PlaywrightRunner();
      const spec: BDDSpec = {
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
      };

      const code = await runner.generate(spec);

      expect(code).toContain('import { test');
      expect(code).toContain('Shopping Cart');
    });
  });

  describe('properties', () => {
    it('should have correct name and extension', () => {
      const runner = new PlaywrightRunner();
      expect(runner.name).toBe('playwright');
      expect(runner.fileExtension).toBe('.spec.ts');
    });
  });
});
