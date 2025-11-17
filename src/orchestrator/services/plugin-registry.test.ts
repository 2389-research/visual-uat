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
        targetRunner: '@visual-uat/playwright-runner',
        differ: '@visual-uat/pixelmatch-differ',
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
  });
});
