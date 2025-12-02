// ABOUTME: Unit tests for BDD spec parser
// ABOUTME: Tests parsing of Gherkin-format markdown back to BDDSpec objects

import { BDDParser } from './bdd-parser';

describe('BDDParser', () => {
  const sampleSpec = `# Shopping Cart

## Metadata
- story: tests/stories/cart.story.md
- story_hash: abc123
- generated: 2024-12-02T10:30:00Z

## Feature: Shopping Cart

Scenario: Add item to cart
  Given I am on the "/products" page
  When I click the "Add to Cart" button
  Then I should see the cart badge show "1"

  Checkpoint: cart-updated
    - capture: full-page
    - focus: [".cart-badge"]
`;

  describe('parse', () => {
    it('should parse metadata', () => {
      const parser = new BDDParser();
      const spec = parser.parse(sampleSpec, '.visual-uat/specs/cart.spec.md');

      expect(spec.sourceStory).toBe('tests/stories/cart.story.md');
      expect(spec.storyHash).toBe('abc123');
      expect(spec.feature).toBe('Shopping Cart');
    });

    it('should parse scenarios and steps', () => {
      const parser = new BDDParser();
      const spec = parser.parse(sampleSpec, '.visual-uat/specs/cart.spec.md');

      expect(spec.scenarios).toHaveLength(1);
      expect(spec.scenarios[0].name).toBe('Add item to cart');
      expect(spec.scenarios[0].steps).toHaveLength(3);
      expect(spec.scenarios[0].steps[0].type).toBe('given');
    });

    it('should parse checkpoints', () => {
      const parser = new BDDParser();
      const spec = parser.parse(sampleSpec, '.visual-uat/specs/cart.spec.md');

      expect(spec.scenarios[0].checkpoints).toHaveLength(1);
      expect(spec.scenarios[0].checkpoints[0].name).toBe('cart-updated');
      expect(spec.scenarios[0].checkpoints[0].capture).toBe('full-page');
    });
  });
});
