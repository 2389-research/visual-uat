// ABOUTME: Unit tests for story loader service
// ABOUTME: Tests loading and parsing of natural language story files

import * as fs from 'fs';
import * as path from 'path';
import { StoryLoader } from './loader';

describe('StoryLoader', () => {
  const testDir = path.join(__dirname, '__test_stories__');

  beforeAll(() => {
    fs.mkdirSync(testDir, { recursive: true });
    fs.writeFileSync(
      path.join(testDir, 'shopping-cart.story.md'),
      `# Add Item to Shopping Cart

As a customer browsing products, I want to add an item to my cart.

## Scenario

1. I'm on the products page
2. I click "Add to Cart"

## Visual Checkpoints

- Cart badge visible with count
`
    );
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe('loadStories', () => {
    it('should load all .story.md files from directory', () => {
      const loader = new StoryLoader(testDir);
      const stories = loader.loadStories();

      expect(stories).toHaveLength(1);
      expect(stories[0].path).toContain('shopping-cart.story.md');
      expect(stories[0].title).toBe('Add Item to Shopping Cart');
      expect(stories[0].contentHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should extract title from first H1', () => {
      const loader = new StoryLoader(testDir);
      const stories = loader.loadStories();

      expect(stories[0].title).toBe('Add Item to Shopping Cart');
    });
  });

  describe('loadStory', () => {
    it('should load a single story by path', () => {
      const loader = new StoryLoader(testDir);
      const storyPath = path.join(testDir, 'shopping-cart.story.md');
      const story = loader.loadStory(storyPath);

      expect(story.path).toBe(storyPath);
      expect(story.content).toContain('As a customer');
    });
  });
});
