import { PluginRegistry } from './plugin-registry';
import { Config } from '../../types/config';
import { TestGenerator, TargetRunner, Differ, Evaluator } from '../../types/plugins';

describe('PluginRegistry', () => {
  let config: Config;

  beforeEach(() => {
    config = {
      baseBranch: 'main',
      specsDir: './tests',
      generatedDir: './tests/generated',
      plugins: {
        testGenerator: '@visual-uat/stub-generator',
        targetRunner: '@visual-uat/web-runner',
        differ: '@visual-uat/smart-differ',
        evaluator: '@visual-uat/claude-evaluator'
      },
      evaluator: {
        autoPassThreshold: 0.95,
        autoFailThreshold: 0.3
      }
    } as Config;
  });

  describe('loadPlugin', () => {
    it('should load built-in TestGenerator plugin', () => {
      const registry = new PluginRegistry(config);
      const plugin = registry.loadPlugin('testGenerator');

      expect(plugin).toBeDefined();
      expect(typeof (plugin as TestGenerator).generate).toBe('function');
    });

    it('should load built-in TargetRunner plugin', () => {
      const registry = new PluginRegistry(config);
      const plugin = registry.loadPlugin('targetRunner');

      expect(plugin).toBeDefined();
      expect(typeof (plugin as TargetRunner).start).toBe('function');
      expect(typeof (plugin as TargetRunner).stop).toBe('function');
      expect(typeof (plugin as TargetRunner).isReady).toBe('function');
    });

    it('should load built-in Differ plugin', () => {
      const registry = new PluginRegistry(config);
      const plugin = registry.loadPlugin('differ');

      expect(plugin).toBeDefined();
      expect(typeof (plugin as Differ).compare).toBe('function');
    });

    it('should load built-in Evaluator plugin', () => {
      const registry = new PluginRegistry(config);
      const plugin = registry.loadPlugin('evaluator');

      expect(plugin).toBeDefined();
      expect(typeof (plugin as Evaluator).evaluate).toBe('function');
    });

    it('should throw error for unknown plugin', () => {
      config.plugins.testGenerator = '@unknown/plugin';
      const registry = new PluginRegistry(config);

      expect(() => registry.loadPlugin('testGenerator')).toThrow('Unknown plugin');
    });

    it('should throw error if plugin missing required method', () => {
      const BrokenPlugin = class {
        constructor(config: Config) {}
        // Missing the 'generate' method
      };

      config.plugins.testGenerator = '@visual-uat/broken-plugin';
      const registry = new PluginRegistry(config);
      registry['builtins']['@visual-uat/broken-plugin'] = BrokenPlugin;

      expect(() => registry.loadPlugin('testGenerator'))
        .toThrow('does not implement testGenerator.generate()');
    });

    it('should throw error if testGenerator plugin missing generate method', () => {
      const BrokenTestGenerator = class {
        constructor(config: Config) {}
        // Missing 'generate' method
      };

      config.plugins.testGenerator = '@visual-uat/broken-test-generator';
      const registry = new PluginRegistry(config);
      registry['builtins']['@visual-uat/broken-test-generator'] = BrokenTestGenerator;

      expect(() => registry.loadPlugin('testGenerator'))
        .toThrow('does not implement testGenerator.generate()');
    });

    it('should throw error if targetRunner plugin missing required methods', () => {
      const BrokenRunner = class {
        constructor(config: Config) {}
        start() {}
        // Missing 'stop' and 'isReady' methods
      };

      config.plugins.targetRunner = '@visual-uat/broken-runner';
      const registry = new PluginRegistry(config);
      registry['builtins']['@visual-uat/broken-runner'] = BrokenRunner;

      expect(() => registry.loadPlugin('targetRunner'))
        .toThrow('does not implement targetRunner.stop()');
    });

    it('should throw error if differ plugin missing compare method', () => {
      const BrokenDiffer = class {
        constructor(config: Config) {}
        // Missing 'compare' method
      };

      config.plugins.differ = '@visual-uat/broken-differ';
      const registry = new PluginRegistry(config);
      registry['builtins']['@visual-uat/broken-differ'] = BrokenDiffer;

      expect(() => registry.loadPlugin('differ'))
        .toThrow('does not implement differ.compare()');
    });

    it('should throw error if evaluator plugin missing evaluate method', () => {
      const BrokenEvaluator = class {
        constructor(config: Config) {}
        // Missing 'evaluate' method
      };

      config.plugins.evaluator = '@visual-uat/broken-evaluator';
      const registry = new PluginRegistry(config);
      registry['builtins']['@visual-uat/broken-evaluator'] = BrokenEvaluator;

      expect(() => registry.loadPlugin('evaluator'))
        .toThrow('does not implement evaluator.evaluate()');
    });

    it('should throw error if plugin config is undefined', () => {
      config.plugins.testGenerator = undefined as any;
      const registry = new PluginRegistry(config);

      expect(() => registry.loadPlugin('testGenerator'))
        .toThrow('Plugin configuration for testGenerator is undefined');
    });
  });

  describe('loadAll', () => {
    it('should load all plugins at once', () => {
      const registry = new PluginRegistry(config);
      const plugins = registry.loadAll();

      expect(plugins.testGenerator).toBeDefined();
      expect(plugins.targetRunner).toBeDefined();
      expect(plugins.differ).toBeDefined();
      expect(plugins.evaluator).toBeDefined();
    });

    it('should load reporter plugins', () => {
      const registry = new PluginRegistry(config);
      const plugins = registry.loadAll();

      expect(plugins.terminalReporter).toBeDefined();
      expect(plugins.htmlReporter).toBeDefined();
      expect(typeof plugins.terminalReporter.generate).toBe('function');
      expect(typeof plugins.htmlReporter.generate).toBe('function');
    });
  });
});
