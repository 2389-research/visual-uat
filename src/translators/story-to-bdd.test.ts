// ABOUTME: Unit tests for story-to-BDD translator
// ABOUTME: Tests LLM-powered translation from natural language to Gherkin format

// Mock Anthropic client for testing
const mockCreate = jest.fn();
const mockAnthropicConstructor = jest.fn().mockImplementation(() => ({
  messages: {
    create: mockCreate
  }
}));

jest.mock('@anthropic-ai/sdk', () => mockAnthropicConstructor);

import { StoryToBDDTranslator } from './story-to-bdd';
import { Story, BDDSpec } from '../types/plugins';

describe('StoryToBDDTranslator', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  describe('translate', () => {
    it('should translate story to BDD spec', async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: 'text',
          text: JSON.stringify({
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
          })
        }]
      });

      const translator = new StoryToBDDTranslator();
      const story: Story = {
        path: 'tests/stories/cart.story.md',
        content: '# Shopping Cart\n\nAs a customer...',
        title: 'Shopping Cart',
        contentHash: 'abc123'
      };

      const spec = await translator.translate(story);

      expect(spec.feature).toBe('Shopping Cart');
      expect(spec.scenarios).toHaveLength(1);
      expect(spec.scenarios[0].steps).toHaveLength(3);
      expect(spec.sourceStory).toBe('tests/stories/cart.story.md');
      expect(spec.storyHash).toBe('abc123');
    });
  });
});
