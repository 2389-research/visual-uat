// ABOUTME: Tests for Claude LLM-based diff evaluator
// ABOUTME: Validates evaluation logic and confidence threshold handling

import { ClaudeEvaluator } from './claude-evaluator';
import type { EvaluationInput, DiffResult } from '../types/plugins';

describe('ClaudeEvaluator', () => {
  // Mock API key for testing
  const apiKey = process.env.ANTHROPIC_API_KEY || 'test-key';

  it('should create evaluator with thresholds', () => {
    const evaluator = new ClaudeEvaluator(apiKey, {
      autoPassThreshold: 0.95,
      autoFailThreshold: 0.3
    });
    expect(evaluator).toBeDefined();
  });

  it('should determine needsReview based on confidence', async () => {
    const evaluator = new ClaudeEvaluator(apiKey, {
      autoPassThreshold: 0.95,
      autoFailThreshold: 0.3
    });

    // Test high confidence
    const highConfResult = evaluator['determineNeedsReview'](0.96, true);
    expect(highConfResult).toBe(false);

    // Test low confidence
    const lowConfResult = evaluator['determineNeedsReview'](0.25, false);
    expect(lowConfResult).toBe(false);

    // Test medium confidence
    const medConfResult = evaluator['determineNeedsReview'](0.5, true);
    expect(medConfResult).toBe(true);
  });

  it('should handle identical images without API call', async () => {
    const evaluator = new ClaudeEvaluator(apiKey, {});

    const input: EvaluationInput = {
      intent: 'Test intent',
      checkpoint: 'test',
      diffResult: {
        diffImage: Buffer.from(''),
        pixelDiffPercent: 0,
        changedRegions: [],
        identical: true
      },
      baselineImage: Buffer.from(''),
      currentImage: Buffer.from('')
    };

    const result = await evaluator.evaluate(input);

    expect(result.pass).toBe(true);
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toContain('identical');
    expect(result.needsReview).toBe(false);
  });

  // Note: Full LLM API test would require real API key and is expensive
  // Mock-based integration tests would go here
});
