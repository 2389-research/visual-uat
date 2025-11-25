// ABOUTME: Loads and validates plugins from configuration, instantiating built-in plugins.
// ABOUTME: Future enhancement: support external plugins via npm packages.

import { Config } from '../../types/config';
import { TestGenerator, TargetRunner, Differ, Evaluator, ReporterPlugin } from '../../types/plugins';
import { StubTestGenerator } from '../../plugins/test-generator-stub';
import { WebRunner } from '../../plugins/web-runner';
import { SmartDiffer } from '../../plugins/smart-differ';
import { ClaudeEvaluator } from '../../plugins/claude-evaluator';
import { TerminalReporter } from '../../plugins/terminal-reporter';
import { HTMLReporter } from '../../plugins/html-reporter';

type PluginType = 'testGenerator' | 'targetRunner' | 'differ' | 'evaluator';

export interface LoadedPlugins {
  testGenerator: TestGenerator;
  targetRunner: TargetRunner;
  differ: Differ;
  evaluator: Evaluator;
  terminalReporter: ReporterPlugin;
  htmlReporter: ReporterPlugin;
}

export class PluginRegistry {
  private builtins: Record<string, any> = {
    '@visual-uat/stub-generator': StubTestGenerator,
    '@visual-uat/web-runner': WebRunner,
    '@visual-uat/smart-differ': SmartDiffer,
    '@visual-uat/claude-evaluator': ClaudeEvaluator
  };

  constructor(private config: Config) {}

  private validatePlugin(plugin: any, type: PluginType): void {
    const requiredMethods: Record<PluginType, string[]> = {
      'testGenerator': ['generate'],
      'targetRunner': ['start', 'stop', 'isReady'],
      'differ': ['compare'],
      'evaluator': ['evaluate']
    };

    const methods = requiredMethods[type];
    for (const method of methods) {
      if (typeof plugin[method] !== 'function') {
        throw new Error(
          `Plugin ${this.config.plugins[type]} does not implement ${type}.${method}()`
        );
      }
    }
  }

  loadPlugin(type: PluginType): TestGenerator | TargetRunner | Differ | Evaluator {
    const pluginName = this.config.plugins[type];

    if (pluginName === undefined || pluginName === null) {
      throw new Error(`Plugin configuration for ${type} is undefined`);
    }

    if (pluginName in this.builtins) {
      const PluginClass = this.builtins[pluginName];
      const instance = new PluginClass(this.config);
      this.validatePlugin(instance, type);
      return instance;
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
      evaluator: this.loadPlugin('evaluator') as Evaluator,
      terminalReporter: new TerminalReporter(),
      htmlReporter: new HTMLReporter()
    };
  }
}
