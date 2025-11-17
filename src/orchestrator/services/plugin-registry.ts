// ABOUTME: Loads and validates plugins from configuration, instantiating built-in plugins.
// ABOUTME: Future enhancement: support external plugins via npm packages.

import { Config } from '../../types/config';
import { TestGenerator, TargetRunner, Differ, Evaluator } from '../../types/plugins';
import { StubTestGenerator } from '../../plugins/test-generator-stub';
import { PlaywrightRunner } from '../../plugins/playwright-runner';
import { PixelmatchDiffer } from '../../plugins/pixelmatch-differ';
import { ClaudeEvaluator } from '../../plugins/claude-evaluator';

type PluginType = 'testGenerator' | 'targetRunner' | 'differ' | 'evaluator';

export interface LoadedPlugins {
  testGenerator: TestGenerator;
  targetRunner: TargetRunner;
  differ: Differ;
  evaluator: Evaluator;
}

export class PluginRegistry {
  private builtins: Record<string, any> = {
    '@visual-uat/stub-generator': StubTestGenerator,
    '@visual-uat/playwright-runner': PlaywrightRunner,
    '@visual-uat/pixelmatch-differ': PixelmatchDiffer,
    '@visual-uat/claude-evaluator': ClaudeEvaluator
  };

  constructor(private config: Config) {}

  loadPlugin(type: PluginType): TestGenerator | TargetRunner | Differ | Evaluator {
    const pluginName = this.config.plugins[type];

    if (pluginName in this.builtins) {
      const PluginClass = this.builtins[pluginName];
      return new PluginClass(this.config);
    }

    // Future: External plugins
    // const Plugin = require(pluginName);
    // return new Plugin(this.config);

    throw new Error(`Unknown plugin: ${pluginName}`);
  }

  loadAll(): LoadedPlugins {
    return {
      testGenerator: this.loadPlugin('testGenerator') as TestGenerator,
      targetRunner: this.loadPlugin('targetRunner') as TargetRunner,
      differ: this.loadPlugin('differ') as Differ,
      evaluator: this.loadPlugin('evaluator') as Evaluator
    };
  }
}
