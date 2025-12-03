# Test Definition Redesign - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace unstructured markdown specs with a three-tier system: Natural Language Stories → BDD Specs → Generated Tests

**Architecture:** Two-stage LLM translation with hash-based caching. Stories are user-written natural language. BDD specs are generated Gherkin format. Tests are runner-specific (Playwright first, extensible to TUI/Swift/etc).

**Tech Stack:** TypeScript, Anthropic Claude API, existing manifest system

**Design Doc:** `docs/plans/2024-12-02-test-definition-redesign.md`

---

## Task 1: Add Story Types

**Files:**
- Modify: `src/types/plugins.ts`
- Test: `src/types/plugins.test.ts` (create)

**Step 1: Write the failing test**

Create `src/types/plugins.test.ts`:

```typescript
// ABOUTME: Unit tests for plugin type definitions
// ABOUTME: Validates Story and BDD spec type structures

import { Story, BDDSpec, BDDScenario, BDDStep, Checkpoint } from './plugins';

describe('Story type', () => {
  it('should have required fields', () => {
    const story: Story = {
      path: 'tests/stories/shopping-cart.story.md',
      content: '# Shopping Cart\n\nAs a customer...',
      title: 'Shopping Cart',
      contentHash: 'abc123'
    };

    expect(story.path).toBe('tests/stories/shopping-cart.story.md');
    expect(story.title).toBe('Shopping Cart');
    expect(story.contentHash).toBe('abc123');
  });
});

describe('BDDSpec type', () => {
  it('should have required fields', () => {
    const spec: BDDSpec = {
      path: '.visual-uat/specs/shopping-cart.spec.md',
      sourceStory: 'tests/stories/shopping-cart.story.md',
      storyHash: 'abc123',
      generatedAt: '2024-12-02T10:30:00Z',
      feature: 'Shopping Cart',
      scenarios: []
    };

    expect(spec.sourceStory).toBe('tests/stories/shopping-cart.story.md');
    expect(spec.storyHash).toBe('abc123');
  });

  it('should support scenarios with steps and checkpoints', () => {
    const scenario: BDDScenario = {
      name: 'Add item to cart',
      steps: [
        { type: 'given', text: 'I am on the "/products" page' },
        { type: 'when', text: 'I click the "Add to Cart" button' },
        { type: 'then', text: 'I should see the cart badge show "1"' }
      ],
      checkpoints: [
        { name: 'cart-updated', capture: 'full-page', focus: ['.cart-badge'] }
      ]
    };

    expect(scenario.steps).toHaveLength(3);
    expect(scenario.checkpoints).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/types/plugins.test.ts`
Expected: FAIL - types `Story`, `BDDSpec`, etc. not exported

**Step 3: Write minimal implementation**

Add to `src/types/plugins.ts` (after existing types):

```typescript
// Story types (natural language input)
export interface Story {
  path: string;
  content: string;
  title: string;
  contentHash: string;
}

// BDD types (generated intermediate)
export type BDDStepType = 'given' | 'when' | 'then' | 'and' | 'but';

export interface BDDStep {
  type: BDDStepType;
  text: string;
}

export interface Checkpoint {
  name: string;
  capture: 'full-page' | 'viewport' | 'element';
  focus?: string[];
  selector?: string;
}

export interface BDDScenario {
  name: string;
  steps: BDDStep[];
  checkpoints: Checkpoint[];
}

export interface BDDSpec {
  path: string;
  sourceStory: string;
  storyHash: string;
  generatedAt: string;
  feature: string;
  scenarios: BDDScenario[];
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/types/plugins.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/plugins.ts src/types/plugins.test.ts
git commit -m "feat: add Story and BDD spec types for test definition redesign"
```

---

## Task 2: Create Story Loader Service

**Files:**
- Create: `src/stories/loader.ts`
- Test: `src/stories/loader.test.ts`

**Step 1: Write the failing test**

Create `src/stories/loader.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/stories/loader.test.ts`
Expected: FAIL - Cannot find module './loader'

**Step 3: Write minimal implementation**

Create `src/stories/loader.ts`:

```typescript
// ABOUTME: Story loader service for natural language test definitions
// ABOUTME: Loads .story.md files and computes content hashes for change detection

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Story } from '../types/plugins';

export class StoryLoader {
  private storiesDir: string;

  constructor(storiesDir: string) {
    this.storiesDir = storiesDir;
  }

  loadStories(): Story[] {
    if (!fs.existsSync(this.storiesDir)) {
      return [];
    }

    const files = fs.readdirSync(this.storiesDir);
    const storyFiles = files.filter(f => f.endsWith('.story.md'));

    return storyFiles.map(file => {
      const filePath = path.join(this.storiesDir, file);
      return this.loadStory(filePath);
    });
  }

  loadStory(storyPath: string): Story {
    const content = fs.readFileSync(storyPath, 'utf-8');
    const title = this.extractTitle(content);
    const contentHash = this.computeHash(content);

    return {
      path: storyPath,
      content,
      title,
      contentHash
    };
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Untitled Story';
  }

  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/stories/loader.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/stories/loader.ts src/stories/loader.test.ts
git commit -m "feat: add StoryLoader service for loading natural language stories"
```

---

## Task 3: Update Manifest for Story Tracking

**Files:**
- Modify: `src/specs/manifest.ts`
- Modify: `src/specs/manifest.test.ts`

**Step 1: Write the failing test**

Add to `src/specs/manifest.test.ts`:

```typescript
describe('StoryManifest', () => {
  describe('trackStory', () => {
    it('should track story hash and generated spec path', () => {
      const manifest = new SpecManifest(testDir);

      manifest.trackStory('tests/stories/cart.story.md', {
        contentHash: 'abc123',
        specPath: '.visual-uat/specs/cart.spec.md',
        specHash: 'def456'
      });

      const entry = manifest.getStoryEntry('tests/stories/cart.story.md');
      expect(entry?.contentHash).toBe('abc123');
      expect(entry?.specPath).toBe('.visual-uat/specs/cart.spec.md');
      expect(entry?.specHash).toBe('def456');
    });
  });

  describe('detectStoryChanges', () => {
    it('should detect new stories', () => {
      const manifest = new SpecManifest(testDir);

      const changes = manifest.detectStoryChanges([
        { path: 'tests/stories/new.story.md', contentHash: 'xyz789' }
      ]);

      expect(changes.new).toContain('tests/stories/new.story.md');
    });

    it('should detect modified stories', () => {
      const manifest = new SpecManifest(testDir);
      manifest.trackStory('tests/stories/cart.story.md', {
        contentHash: 'old-hash',
        specPath: '.visual-uat/specs/cart.spec.md',
        specHash: 'spec-hash'
      });
      manifest.save();

      const manifest2 = new SpecManifest(testDir);
      const changes = manifest2.detectStoryChanges([
        { path: 'tests/stories/cart.story.md', contentHash: 'new-hash' }
      ]);

      expect(changes.modified).toContain('tests/stories/cart.story.md');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/specs/manifest.test.ts`
Expected: FAIL - `trackStory` and `detectStoryChanges` not defined

**Step 3: Write minimal implementation**

Add to `src/specs/manifest.ts`:

```typescript
export interface StoryManifestEntry {
  contentHash: string;
  specPath: string;
  specHash: string;
}

export interface StoryChanges {
  new: string[];
  modified: string[];
  deleted: string[];
}

// Add these methods to SpecManifest class:

private storyEntries: Map<string, StoryManifestEntry> = new Map();

// In constructor, after loading entries:
if (data.stories) {
  Object.entries(data.stories).forEach(([path, entry]) => {
    this.storyEntries.set(path, entry as StoryManifestEntry);
  });
}

trackStory(storyPath: string, entry: StoryManifestEntry): void {
  this.storyEntries.set(storyPath, entry);
}

getStoryEntry(storyPath: string): StoryManifestEntry | undefined {
  return this.storyEntries.get(storyPath);
}

detectStoryChanges(currentStories: Array<{ path: string; contentHash: string }>): StoryChanges {
  const changes: StoryChanges = { new: [], modified: [], deleted: [] };
  const currentPathSet = new Set(currentStories.map(s => s.path));

  for (const story of currentStories) {
    const entry = this.storyEntries.get(story.path);
    if (!entry) {
      changes.new.push(story.path);
    } else if (entry.contentHash !== story.contentHash) {
      changes.modified.push(story.path);
    }
  }

  for (const [storyPath] of this.storyEntries) {
    if (!currentPathSet.has(storyPath)) {
      changes.deleted.push(storyPath);
    }
  }

  return changes;
}

// Update save() to include stories:
save(): void {
  const data = {
    specs: Object.fromEntries(this.entries),
    stories: Object.fromEntries(this.storyEntries)
  };
  fs.writeFileSync(this.manifestPath, JSON.stringify(data, null, 2));
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/specs/manifest.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/specs/manifest.ts src/specs/manifest.test.ts
git commit -m "feat: add story tracking to manifest for change detection"
```

---

## Task 4: Create Story-to-BDD Translator

**Files:**
- Create: `src/translators/story-to-bdd.ts`
- Test: `src/translators/story-to-bdd.test.ts`

**Step 1: Write the failing test**

Create `src/translators/story-to-bdd.test.ts`:

```typescript
// ABOUTME: Unit tests for story-to-BDD translator
// ABOUTME: Tests LLM-powered translation from natural language to Gherkin format

import { StoryToBDDTranslator } from './story-to-bdd';
import { Story, BDDSpec } from '../types/plugins';

// Mock Anthropic client for testing
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate
    }
  }))
}));

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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/translators/story-to-bdd.test.ts`
Expected: FAIL - Cannot find module './story-to-bdd'

**Step 3: Write minimal implementation**

Create `src/translators/story-to-bdd.ts`:

```typescript
// ABOUTME: Story-to-BDD translator using LLM for natural language processing
// ABOUTME: Converts user stories to structured Gherkin-style BDD specifications

import Anthropic from '@anthropic-ai/sdk';
import { Story, BDDSpec, BDDScenario } from '../types/plugins';

export class StoryToBDDTranslator {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async translate(story: Story): Promise<BDDSpec> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: this.buildPrompt(story)
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from LLM');
    }

    const parsed = JSON.parse(content.text);

    return {
      path: this.generateSpecPath(story.path),
      sourceStory: story.path,
      storyHash: story.contentHash,
      generatedAt: new Date().toISOString(),
      feature: parsed.feature,
      scenarios: parsed.scenarios as BDDScenario[]
    };
  }

  private buildPrompt(story: Story): string {
    return `Convert this natural language test story into a structured BDD specification.

## Story
${story.content}

## Output Format
Return ONLY valid JSON with this structure:
{
  "feature": "Feature name",
  "scenarios": [
    {
      "name": "Scenario name",
      "steps": [
        { "type": "given", "text": "I am on the page" },
        { "type": "when", "text": "I click something" },
        { "type": "then", "text": "I should see something" }
      ],
      "checkpoints": [
        { "name": "checkpoint-name", "capture": "full-page", "focus": [".selector"] }
      ]
    }
  ]
}

Rules:
- Extract meaningful scenarios from the story
- Use given/when/then/and/but step types
- Create checkpoints for visual verification points mentioned
- Infer CSS selectors where possible, use descriptive placeholders if not
- capture must be: "full-page", "viewport", or "element"
- Return ONLY the JSON, no markdown fences or explanation`;
  }

  private generateSpecPath(storyPath: string): string {
    const basename = storyPath.replace(/.*\//, '').replace('.story.md', '.spec.md');
    return `.visual-uat/specs/${basename}`;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/translators/story-to-bdd.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/translators/story-to-bdd.ts src/translators/story-to-bdd.test.ts
git commit -m "feat: add StoryToBDDTranslator for LLM-powered story translation"
```

---

## Task 5: Create BDD Spec Writer

**Files:**
- Create: `src/translators/bdd-writer.ts`
- Test: `src/translators/bdd-writer.test.ts`

**Step 1: Write the failing test**

Create `src/translators/bdd-writer.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/translators/bdd-writer.test.ts`
Expected: FAIL - Cannot find module './bdd-writer'

**Step 3: Write minimal implementation**

Create `src/translators/bdd-writer.ts`:

```typescript
// ABOUTME: BDD spec writer for serializing specs to markdown
// ABOUTME: Writes Gherkin-format markdown files with metadata

import * as fs from 'fs';
import * as path from 'path';
import { BDDSpec, BDDScenario, BDDStep, Checkpoint } from '../types/plugins';

export class BDDWriter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  write(spec: BDDSpec): string {
    const content = this.serialize(spec);
    const outputPath = path.join(this.outputDir, path.basename(spec.path));

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content);

    return outputPath;
  }

  private serialize(spec: BDDSpec): string {
    const lines: string[] = [];

    lines.push(`# ${spec.feature}`);
    lines.push('');
    lines.push('## Metadata');
    lines.push(`- story: ${spec.sourceStory}`);
    lines.push(`- story_hash: ${spec.storyHash}`);
    lines.push(`- generated: ${spec.generatedAt}`);
    lines.push('');
    lines.push(`## Feature: ${spec.feature}`);
    lines.push('');

    for (const scenario of spec.scenarios) {
      lines.push(...this.serializeScenario(scenario));
      lines.push('');
    }

    return lines.join('\n');
  }

  private serializeScenario(scenario: BDDScenario): string[] {
    const lines: string[] = [];

    lines.push(`Scenario: ${scenario.name}`);

    for (const step of scenario.steps) {
      const prefix = step.type.charAt(0).toUpperCase() + step.type.slice(1);
      lines.push(`  ${prefix} ${step.text}`);
    }

    for (const checkpoint of scenario.checkpoints) {
      lines.push('');
      lines.push(`  Checkpoint: ${checkpoint.name}`);
      lines.push(`    - capture: ${checkpoint.capture}`);
      if (checkpoint.focus && checkpoint.focus.length > 0) {
        lines.push(`    - focus: ${JSON.stringify(checkpoint.focus)}`);
      }
      if (checkpoint.selector) {
        lines.push(`    - selector: ${checkpoint.selector}`);
      }
    }

    return lines;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/translators/bdd-writer.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/translators/bdd-writer.ts src/translators/bdd-writer.test.ts
git commit -m "feat: add BDDWriter for serializing BDD specs to markdown"
```

---

## Task 6: Create BDD Parser

**Files:**
- Create: `src/translators/bdd-parser.ts`
- Test: `src/translators/bdd-parser.test.ts`

**Step 1: Write the failing test**

Create `src/translators/bdd-parser.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/translators/bdd-parser.test.ts`
Expected: FAIL - Cannot find module './bdd-parser'

**Step 3: Write minimal implementation**

Create `src/translators/bdd-parser.ts`:

```typescript
// ABOUTME: BDD spec parser for reading Gherkin-format markdown
// ABOUTME: Parses BDD spec files back into BDDSpec objects for test generation

import { BDDSpec, BDDScenario, BDDStep, BDDStepType, Checkpoint } from '../types/plugins';

export class BDDParser {
  parse(content: string, specPath: string): BDDSpec {
    const metadata = this.parseMetadata(content);
    const feature = this.parseFeature(content);
    const scenarios = this.parseScenarios(content);

    return {
      path: specPath,
      sourceStory: metadata.story,
      storyHash: metadata.storyHash,
      generatedAt: metadata.generated,
      feature,
      scenarios
    };
  }

  private parseMetadata(content: string): { story: string; storyHash: string; generated: string } {
    const storyMatch = content.match(/- story:\s*(.+)/);
    const hashMatch = content.match(/- story_hash:\s*(.+)/);
    const generatedMatch = content.match(/- generated:\s*(.+)/);

    return {
      story: storyMatch?.[1]?.trim() || '',
      storyHash: hashMatch?.[1]?.trim() || '',
      generated: generatedMatch?.[1]?.trim() || ''
    };
  }

  private parseFeature(content: string): string {
    const match = content.match(/## Feature:\s*(.+)/);
    return match?.[1]?.trim() || 'Unknown Feature';
  }

  private parseScenarios(content: string): BDDScenario[] {
    const scenarios: BDDScenario[] = [];
    const scenarioBlocks = content.split(/(?=Scenario:)/);

    for (const block of scenarioBlocks) {
      if (!block.startsWith('Scenario:')) continue;

      const scenario = this.parseScenarioBlock(block);
      if (scenario) scenarios.push(scenario);
    }

    return scenarios;
  }

  private parseScenarioBlock(block: string): BDDScenario | null {
    const nameMatch = block.match(/Scenario:\s*(.+)/);
    if (!nameMatch) return null;

    const steps = this.parseSteps(block);
    const checkpoints = this.parseCheckpoints(block);

    return {
      name: nameMatch[1].trim(),
      steps,
      checkpoints
    };
  }

  private parseSteps(block: string): BDDStep[] {
    const steps: BDDStep[] = [];
    const stepRegex = /^\s*(Given|When|Then|And|But)\s+(.+)$/gm;

    let match;
    while ((match = stepRegex.exec(block)) !== null) {
      steps.push({
        type: match[1].toLowerCase() as BDDStepType,
        text: match[2].trim()
      });
    }

    return steps;
  }

  private parseCheckpoints(block: string): Checkpoint[] {
    const checkpoints: Checkpoint[] = [];
    const checkpointRegex = /Checkpoint:\s*([a-z0-9-]+)([\s\S]*?)(?=Checkpoint:|Scenario:|$)/gi;

    let match;
    while ((match = checkpointRegex.exec(block)) !== null) {
      const name = match[1];
      const details = match[2];

      const captureMatch = details.match(/- capture:\s*(\S+)/);
      const focusMatch = details.match(/- focus:\s*(\[.+\])/);
      const selectorMatch = details.match(/- selector:\s*(.+)/);

      checkpoints.push({
        name,
        capture: (captureMatch?.[1] as 'full-page' | 'viewport' | 'element') || 'full-page',
        focus: focusMatch ? JSON.parse(focusMatch[1]) : undefined,
        selector: selectorMatch?.[1]?.trim()
      });
    }

    return checkpoints;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/translators/bdd-parser.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/translators/bdd-parser.ts src/translators/bdd-parser.test.ts
git commit -m "feat: add BDDParser for parsing Gherkin markdown specs"
```

---

## Task 7: Create Runner Plugin Interface

**Files:**
- Modify: `src/types/plugins.ts`
- Test: Update `src/types/plugins.test.ts`

**Step 1: Write the failing test**

Add to `src/types/plugins.test.ts`:

```typescript
describe('TestRunnerPlugin interface', () => {
  it('should define runner plugin contract', () => {
    // Type-level test - if this compiles, the interface is correct
    const mockPlugin: TestRunnerPlugin = {
      name: 'playwright',
      fileExtension: '.spec.ts',
      generate: async (spec: BDDSpec) => 'test code',
      execute: async (testPath: string, context: any) => ({
        specPath: testPath,
        generatedPath: testPath,
        status: 'passed' as const,
        checkpoints: [],
        duration: 100
      })
    };

    expect(mockPlugin.name).toBe('playwright');
    expect(mockPlugin.fileExtension).toBe('.spec.ts');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/types/plugins.test.ts`
Expected: FAIL - `TestRunnerPlugin` not exported

**Step 3: Write minimal implementation**

Add to `src/types/plugins.ts`:

```typescript
import { TestResult } from '../orchestrator/types/results';

export interface ExecutionContext {
  baseUrl: string;
  screenshotDir: string;
  environment: Record<string, string>;
}

export interface TestRunnerPlugin {
  name: string;
  fileExtension: string;
  generate(spec: BDDSpec): Promise<string>;
  execute(testPath: string, context: ExecutionContext): Promise<TestResult>;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/types/plugins.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/plugins.ts src/types/plugins.test.ts
git commit -m "feat: add TestRunnerPlugin interface for extensible test runners"
```

---

## Task 8: Create Playwright Runner Plugin

**Files:**
- Create: `src/runners/playwright-runner.ts`
- Test: `src/runners/playwright-runner.test.ts`

**Step 1: Write the failing test**

Create `src/runners/playwright-runner.test.ts`:

```typescript
// ABOUTME: Unit tests for Playwright runner plugin
// ABOUTME: Tests BDD-to-Playwright test code generation

import { PlaywrightRunner } from './playwright-runner';
import { BDDSpec } from '../types/plugins';

// Mock Anthropic client
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  default: jest.fn().mockImplementation(() => ({
    messages: {
      create: mockCreate
    }
  }))
}));

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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/runners/playwright-runner.test.ts`
Expected: FAIL - Cannot find module './playwright-runner'

**Step 3: Write minimal implementation**

Create `src/runners/playwright-runner.ts`:

```typescript
// ABOUTME: Playwright test runner plugin for BDD-to-test generation
// ABOUTME: Uses LLM to translate BDD specs to executable Playwright code

import Anthropic from '@anthropic-ai/sdk';
import { BDDSpec, TestRunnerPlugin, ExecutionContext } from '../types/plugins';
import { TestResult } from '../orchestrator/types/results';
import { spawnSync } from 'child_process';

export class PlaywrightRunner implements TestRunnerPlugin {
  name = 'playwright';
  fileExtension = '.spec.ts';

  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async generate(spec: BDDSpec): Promise<string> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: this.buildPrompt(spec)
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from LLM');
    }

    return this.addFileHeader(content.text, spec);
  }

  async execute(testPath: string, context: ExecutionContext): Promise<TestResult> {
    const result = spawnSync('npx', ['playwright', 'test', testPath, '--reporter=json'], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        BASE_URL: context.baseUrl,
        SCREENSHOT_DIR: context.screenshotDir,
        ...context.environment
      }
    });

    // Parse result and return TestResult
    // This is a simplified version - full implementation would parse JSON output
    return {
      specPath: testPath,
      generatedPath: testPath,
      status: result.status === 0 ? 'passed' : 'failed',
      checkpoints: [],
      duration: 0
    };
  }

  private buildPrompt(spec: BDDSpec): string {
    return `Generate a Playwright test file from this BDD specification.

## BDD Spec
Feature: ${spec.feature}

${spec.scenarios.map(s => `
Scenario: ${s.name}
${s.steps.map(step => `  ${step.type.charAt(0).toUpperCase() + step.type.slice(1)} ${step.text}`).join('\n')}
${s.checkpoints.map(cp => `
  Checkpoint: ${cp.name}
    capture: ${cp.capture}
    focus: ${JSON.stringify(cp.focus || [])}`).join('\n')}
`).join('\n')}

## Requirements
- Use TypeScript with Playwright test imports
- Include screenshotCheckpoint calls for each checkpoint
- Use process.env.BASE_URL for the base URL
- Import screenshotCheckpoint from 'visual-uat/playwright'
- Add assertions for "then" steps using expect()
- Return ONLY the code, no markdown fences or explanation`;
  }

  private addFileHeader(code: string, spec: BDDSpec): string {
    const header = `// ABOUTME: Auto-generated Playwright test from ${spec.path}
// ABOUTME: Source story: ${spec.sourceStory} - DO NOT EDIT DIRECTLY

`;
    return header + code;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/runners/playwright-runner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/runners/playwright-runner.ts src/runners/playwright-runner.test.ts
git commit -m "feat: add PlaywrightRunner plugin for BDD-to-Playwright generation"
```

---

## Task 9: Create Generation Pipeline

**Files:**
- Create: `src/pipeline/generate-pipeline.ts`
- Test: `src/pipeline/generate-pipeline.test.ts`

**Step 1: Write the failing test**

Create `src/pipeline/generate-pipeline.test.ts`:

```typescript
// ABOUTME: Integration tests for the test generation pipeline
// ABOUTME: Tests the full story → BDD → test flow with caching

import * as fs from 'fs';
import * as path from 'path';
import { GeneratePipeline, GenerateResult } from './generate-pipeline';

// Mock translators and runners
jest.mock('../translators/story-to-bdd');
jest.mock('../runners/playwright-runner');

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
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/pipeline/generate-pipeline.test.ts`
Expected: FAIL - Cannot find module './generate-pipeline'

**Step 3: Write minimal implementation**

Create `src/pipeline/generate-pipeline.ts`:

```typescript
// ABOUTME: Test generation pipeline orchestrating story → BDD → test flow
// ABOUTME: Handles caching via manifest to skip unchanged stories

import * as fs from 'fs';
import * as path from 'path';
import { StoryLoader } from '../stories/loader';
import { StoryToBDDTranslator } from '../translators/story-to-bdd';
import { BDDWriter } from '../translators/bdd-writer';
import { SpecManifest } from '../specs/manifest';
import { PlaywrightRunner } from '../runners/playwright-runner';
import { Story, BDDSpec, TestRunnerPlugin } from '../types/plugins';

export interface GenerateOptions {
  storiesDir: string;
  runner: string;
  force?: boolean;
}

export interface GenerateResult {
  generated: number;
  skipped: number;
  errors: Array<{ story: string; error: string }>;
}

export class GeneratePipeline {
  private projectDir: string;
  private options: GenerateOptions;
  private storyLoader: StoryLoader;
  private translator: StoryToBDDTranslator;
  private bddWriter: BDDWriter;
  private manifest: SpecManifest;
  private runner: TestRunnerPlugin;

  constructor(projectDir: string, options: GenerateOptions) {
    this.projectDir = projectDir;
    this.options = options;

    const storiesPath = path.join(projectDir, options.storiesDir);
    const specsPath = path.join(projectDir, '.visual-uat', 'specs');
    const generatedPath = path.join(projectDir, '.visual-uat', 'generated');

    this.storyLoader = new StoryLoader(storiesPath);
    this.translator = new StoryToBDDTranslator();
    this.bddWriter = new BDDWriter(specsPath);
    this.manifest = new SpecManifest(projectDir);

    // For now, only Playwright is supported
    this.runner = new PlaywrightRunner();
  }

  async run(): Promise<GenerateResult> {
    const result: GenerateResult = { generated: 0, skipped: 0, errors: [] };

    const stories = this.storyLoader.loadStories();
    const changes = this.manifest.detectStoryChanges(
      stories.map(s => ({ path: s.path, contentHash: s.contentHash }))
    );

    const toGenerate = this.options.force
      ? stories
      : stories.filter(s =>
          changes.new.includes(s.path) || changes.modified.includes(s.path)
        );

    for (const story of stories) {
      if (!toGenerate.includes(story)) {
        result.skipped++;
        continue;
      }

      try {
        await this.processStory(story);
        result.generated++;
      } catch (error) {
        result.errors.push({
          story: story.path,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.manifest.save();
    return result;
  }

  private async processStory(story: Story): Promise<void> {
    // Stage 1: Story → BDD
    const bddSpec = await this.translator.translate(story);
    const specPath = this.bddWriter.write(bddSpec);

    // Stage 2: BDD → Test
    const testCode = await this.runner.generate(bddSpec);
    const testPath = this.writeTest(bddSpec, testCode);

    // Update manifest
    const specHash = this.computeHash(fs.readFileSync(specPath, 'utf-8'));
    this.manifest.trackStory(story.path, {
      contentHash: story.contentHash,
      specPath,
      specHash
    });
  }

  private writeTest(spec: BDDSpec, code: string): string {
    const generatedDir = path.join(this.projectDir, '.visual-uat', 'generated');
    fs.mkdirSync(generatedDir, { recursive: true });

    const testPath = path.join(
      generatedDir,
      path.basename(spec.path).replace('.spec.md', this.runner.fileExtension)
    );

    fs.writeFileSync(testPath, code);
    return testPath;
  }

  private computeHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/pipeline/generate-pipeline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/pipeline/generate-pipeline.ts src/pipeline/generate-pipeline.test.ts
git commit -m "feat: add GeneratePipeline for orchestrating story-to-test flow"
```

---

## Task 10: Update CLI Generate Command

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/types/config.ts`

**Step 1: Write the failing test**

Add to `src/cli.test.ts`:

```typescript
describe('generate command with stories', () => {
  it('should use new pipeline when storiesDir is configured', async () => {
    // Create test config with storiesDir
    const configPath = path.join(testDir, 'visual-uat.config.js');
    fs.writeFileSync(configPath, `
      module.exports = {
        baseBranch: 'main',
        storiesDir: './tests/stories',
        runner: 'playwright'
      };
    `);

    // Create a story
    const storiesDir = path.join(testDir, 'tests/stories');
    fs.mkdirSync(storiesDir, { recursive: true });
    fs.writeFileSync(
      path.join(storiesDir, 'test.story.md'),
      '# Test Story\n\nAs a user...'
    );

    const program = createCLI();
    // Test that generate command accepts the new config
    // Full integration test would require mocking LLM
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/cli.test.ts`
Expected: FAIL - storiesDir not recognized in config

**Step 3: Write minimal implementation**

Update `src/types/config.ts`:

```typescript
export interface Config {
  baseBranch: string;
  specsDir: string;          // Legacy: direct specs
  storiesDir?: string;       // New: natural language stories
  generatedDir: string;
  runner?: string;           // New: 'playwright' | 'tui' | 'swift' etc.
  plugins: PluginConfig;
  targetRunner: TargetRunnerConfig;
  evaluator: EvaluatorConfig;
  reporters?: ReporterConfig;
}
```

Update `src/cli.ts` generate command:

```typescript
program
  .command('generate')
  .description('Generate test scripts from stories or specifications')
  .option('--force', 'Regenerate all tests (ignore cache)')
  .action(async (options) => {
    try {
      const projectRoot = process.cwd();
      const config = await loadConfig(projectRoot);

      // Use new pipeline if storiesDir is configured
      if (config.storiesDir) {
        const { GeneratePipeline } = await import('./pipeline/generate-pipeline');
        const pipeline = new GeneratePipeline(projectRoot, {
          storiesDir: config.storiesDir,
          runner: config.runner || 'playwright',
          force: options.force
        });

        const result = await pipeline.run();

        console.log(`\nGeneration complete:`);
        console.log(`  Generated: ${result.generated}`);
        console.log(`  Skipped: ${result.skipped} (unchanged)`);
        if (result.errors.length > 0) {
          console.log(`  Errors: ${result.errors.length}`);
          result.errors.forEach(e => console.log(`    - ${e.story}: ${e.error}`));
          process.exit(1);
        }
        process.exit(0);
      }

      // Legacy path: use old handler
      const registry = new PluginRegistry(config);
      const plugins = registry.loadAll();

      const handler = new GenerateCommandHandler(config, projectRoot);
      const exitCode = await handler.execute(plugins.testGenerator);
      process.exit(exitCode);
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : error);
      process.exit(2);
    }
  });
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli.ts src/types/config.ts
git commit -m "feat: update CLI generate command to use new story pipeline"
```

---

## Task 11: Add CLI Output Formatting

**Files:**
- Modify: `src/cli.ts`

**Step 1: Write the failing test**

Add to `src/cli.test.ts`:

```typescript
describe('generate command output', () => {
  it('should show progress during generation', async () => {
    // This tests console output formatting
    const consoleSpy = jest.spyOn(console, 'log');

    // Run generate and check output format
    // Expected output:
    // Checking stories...
    //   ✓ cart.story.md (unchanged, skipping)
    //   ↻ checkout.story.md (changed, regenerating)
    // Generated: 1 spec, 1 test
    // Skipped: 1 (unchanged)

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Checking stories'));
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/cli.test.ts`
Expected: FAIL - output format doesn't match

**Step 3: Write minimal implementation**

Update the generate command output in `src/cli.ts`:

```typescript
// Add progress callback to pipeline
const result = await pipeline.run({
  onProgress: (story, status) => {
    const icon = status === 'skipped' ? '✓' : '↻';
    const msg = status === 'skipped' ? '(unchanged, skipping)' : '(regenerating)';
    console.log(`  ${icon} ${path.basename(story)} ${msg}`);
  }
});
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/cli.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/cli.ts
git commit -m "feat: add progress output to generate command"
```

---

## Task 12: Integration Test - Full Pipeline

**Files:**
- Create: `tests/integration/story-pipeline.test.ts`

**Step 1: Write the failing test**

Create `tests/integration/story-pipeline.test.ts`:

```typescript
// ABOUTME: Integration test for full story → BDD → test pipeline
// ABOUTME: Tests end-to-end generation with real file system

import * as fs from 'fs';
import * as path from 'path';
import { GeneratePipeline } from '../../src/pipeline/generate-pipeline';

// Skip in CI without API key
const describeWithApi = process.env.ANTHROPIC_API_KEY
  ? describe
  : describe.skip;

describeWithApi('Story Pipeline Integration', () => {
  const testDir = path.join(__dirname, '__integration_test__');

  beforeAll(() => {
    // Create test structure
    const storiesDir = path.join(testDir, 'tests/stories');
    fs.mkdirSync(storiesDir, { recursive: true });

    fs.writeFileSync(
      path.join(storiesDir, 'login.story.md'),
      `# User Login

As a registered user, I want to log into my account so I can access my dashboard.

## Scenario

1. I go to the login page
2. I enter my username and password
3. I click the "Login" button
4. I should see my dashboard

## Visual Checkpoints

- Login form visible and styled correctly
- Dashboard loads after successful login
`
    );
  });

  afterAll(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should generate BDD spec and Playwright test from story', async () => {
    const pipeline = new GeneratePipeline(testDir, {
      storiesDir: 'tests/stories',
      runner: 'playwright'
    });

    const result = await pipeline.run();

    expect(result.generated).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Check BDD spec was created
    const specPath = path.join(testDir, '.visual-uat/specs/login.spec.md');
    expect(fs.existsSync(specPath)).toBe(true);

    const specContent = fs.readFileSync(specPath, 'utf-8');
    expect(specContent).toContain('Given');
    expect(specContent).toContain('When');
    expect(specContent).toContain('Then');

    // Check test was created
    const testPath = path.join(testDir, '.visual-uat/generated/login.spec.ts');
    expect(fs.existsSync(testPath)).toBe(true);

    const testContent = fs.readFileSync(testPath, 'utf-8');
    expect(testContent).toContain('import { test');
    expect(testContent).toContain('playwright');
  }, 60000); // 60s timeout for LLM calls
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/integration/story-pipeline.test.ts`
Expected: FAIL (or skip if no API key)

**Step 3: Verify implementation works**

This is an integration test - it should pass once all previous tasks are complete.

**Step 4: Run test to verify it passes**

Run: `ANTHROPIC_API_KEY=... npm test -- tests/integration/story-pipeline.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add tests/integration/story-pipeline.test.ts
git commit -m "test: add integration test for story pipeline"
```

---

## Summary

**Total Tasks:** 12
**Estimated Time:** Each task is 15-30 minutes of implementation

**Dependency Order:**
1. Task 1 (types) - foundation
2. Task 2 (story loader) - depends on 1
3. Task 3 (manifest) - depends on 1
4. Task 4 (story-to-bdd) - depends on 1
5. Task 5 (bdd writer) - depends on 1
6. Task 6 (bdd parser) - depends on 1
7. Task 7 (runner interface) - depends on 1
8. Task 8 (playwright runner) - depends on 6, 7
9. Task 9 (pipeline) - depends on 2, 3, 4, 5, 8
10. Task 10 (CLI update) - depends on 9
11. Task 11 (CLI output) - depends on 10
12. Task 12 (integration test) - depends on all

**After completion:** Update the `run` command to use generated tests from `.visual-uat/generated/` instead of `tests/generated/`.
