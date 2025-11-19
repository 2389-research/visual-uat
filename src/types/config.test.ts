// ABOUTME: Tests for configuration type definitions
// ABOUTME: Validates configuration structure and default values

import type { Config, PluginConfig, EvaluatorConfig, ReporterConfig } from './config';

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

  it('should support optional reporter configuration', () => {
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
      evaluator: {},
      reporters: {
        terminal: {
          enabled: true,
          defaultVerbosity: 'normal'
        },
        html: {
          enabled: true
        }
      }
    };
    expect(config.reporters).toBeDefined();
    expect(config.reporters?.terminal?.enabled).toBe(true);
    expect(config.reporters?.terminal?.defaultVerbosity).toBe('normal');
    expect(config.reporters?.html?.enabled).toBe(true);
  });

  it('should allow config without reporters field', () => {
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
    expect(config.reporters).toBeUndefined();
  });

  it('should allow partial reporter configuration', () => {
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
      evaluator: {},
      reporters: {
        terminal: {
          enabled: false
        }
      }
    };
    expect(config.reporters?.terminal?.enabled).toBe(false);
    expect(config.reporters?.terminal?.defaultVerbosity).toBeUndefined();
    expect(config.reporters?.html).toBeUndefined();
  });
});
