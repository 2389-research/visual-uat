// ABOUTME: Unit tests for BDD spec file writer
// ABOUTME: Tests serialization of BDD specs to markdown format

import * as fs from 'fs';
import * as path from 'path';
import { BDDWriter } from './bdd-writer';
import { BDDSpec } from '../types/plugins';

describe('BDDWriter', () => {
  const testDir = path.join(__dirname, '__test_bdd__');

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('write', () => {
    it('should write BDD spec to markdown file', () => {
      const writer = new BDDWriter(testDir);
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

      const outputPath = writer.write(spec);

      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, 'utf-8');
      expect(content).toContain('# Shopping Cart');
      expect(content).toContain('story: tests/stories/cart.story.md');
      expect(content).toContain('Given I am on the "/products" page');
      expect(content).toContain('Checkpoint: cart-updated');
    });
  });
});
