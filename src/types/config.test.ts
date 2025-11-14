// ABOUTME: Tests for configuration type definitions
// ABOUTME: Validates configuration structure and default values

import type { Config, PluginConfig, EvaluatorConfig } from './config';

describe('Configuration Types', () => {
  it('should define Config interface with all required fields', () => {
    const config: Config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        targetRunner: '@visual-uat/playwright-runner',
        testGenerator: '@visual-uat/llm-generator',
        differ: '@visual-uat/pixelmatch',
        evaluator: '@visual-uat/llm-evaluator'
      },
      targetRunner: {},
      evaluator: {
        autoPassThreshold: 0.95,
        autoFailThreshold: 0.3
      }
    };
    expect(config.baseBranch).toBe('main');
  });

  it('should allow optional evaluator thresholds', () => {
    const config: Config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        targetRunner: 'runner',
        testGenerator: 'generator',
        differ: 'differ',
        evaluator: 'evaluator'
      },
      targetRunner: {},
      evaluator: {}
    };
    expect(config).toBeDefined();
  });
});
