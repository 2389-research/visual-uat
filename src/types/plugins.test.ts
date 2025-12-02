// ABOUTME: Tests for plugin interface type definitions
// ABOUTME: Validates that all plugin interfaces are properly exported and type-safe

import type {
  TargetRunner,
  TestGenerator,
  Differ,
  Evaluator,
  TargetInfo,
  TestSpec,
  GeneratedTest,
  DiffResult,
  EvaluationInput,
  EvaluationResult,
  ReporterPlugin,
  ReporterOptions,
  Story,
  BDDSpec,
  BDDScenario,
  BDDStep,
  Checkpoint
} from './plugins';
import type { RunResult } from '../orchestrator/types/results';

describe('Plugin Interfaces', () => {
  it('should export TargetRunner interface', () => {
    // Type-only test - if this compiles, types are correct
    const mockRunner: TargetRunner = {
      start: async (branch: string) => ({
        baseUrl: 'http://localhost:3000',
        environment: {},
        metadata: {}
      }),
      stop: async (info: TargetInfo) => {},
      isReady: async (info: TargetInfo) => true
    };
    expect(mockRunner).toBeDefined();
  });

  it('should export TestGenerator interface', () => {
    const mockGenerator: TestGenerator = {
      generate: async (spec: TestSpec, context: any) => ({
        code: 'test code',
        language: 'typescript',
        checkpoints: ['checkpoint1']
      })
    };
    expect(mockGenerator).toBeDefined();
  });

  it('should export Differ interface', () => {
    const mockDiffer: Differ = {
      compare: async (baseline: any, current: any) => ({
        diffImage: Buffer.from(''),
        pixelDiffPercent: 0,
        changedRegions: [],
        identical: true
      })
    };
    expect(mockDiffer).toBeDefined();
  });

  it('should export Evaluator interface', () => {
    const mockEvaluator: Evaluator = {
      evaluate: async (input: EvaluationInput) => ({
        pass: true,
        confidence: 0.95,
        reason: 'No changes detected',
        needsReview: false
      })
    };
    expect(mockEvaluator).toBeDefined();
  });

  describe('ReporterPlugin interface', () => {
    it('should accept valid ReporterPlugin implementation', () => {
      const mockReporter: ReporterPlugin = {
        generate: async (result: RunResult, options: ReporterOptions) => {
          // Mock implementation
        }
      };

      expect(mockReporter.generate).toBeDefined();
      expect(typeof mockReporter.generate).toBe('function');
    });

    it('should accept valid ReporterOptions', () => {
      const options: ReporterOptions = {
        verbosity: 'normal',
        outputDir: '/path/to/output',
        autoOpen: false
      };

      expect(options.verbosity).toBe('normal');
      expect(options.autoOpen).toBe(false);
    });

    it('should accept all verbosity levels', () => {
      const levels: Array<'quiet' | 'normal' | 'verbose'> = ['quiet', 'normal', 'verbose'];

      levels.forEach(level => {
        const options: ReporterOptions = { verbosity: level };
        expect(options.verbosity).toBe(level);
      });
    });
  });
});

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
