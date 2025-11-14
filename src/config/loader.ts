// ABOUTME: Configuration file loader with default merging
// ABOUTME: Discovers and loads visual-uat.config.js from project directory

import * as path from 'path';
import * as fs from 'fs';
import { Config, DEFAULT_CONFIG } from '../types/config';

function validateConfig(config: Config): void {
  // Check that plugins object exists and has all required plugin types
  if (!config.plugins) {
    throw new Error('Config must include plugins object');
  }

  const requiredPlugins: (keyof typeof config.plugins)[] = [
    'targetRunner',
    'testGenerator',
    'differ',
    'evaluator'
  ];

  for (const pluginType of requiredPlugins) {
    if (!config.plugins[pluginType]) {
      throw new Error(`Config must include plugin: ${pluginType}`);
    }
  }

  // Validate threshold ranges
  if (config.evaluator.autoPassThreshold !== undefined) {
    if (config.evaluator.autoPassThreshold < 0 || config.evaluator.autoPassThreshold > 1) {
      throw new Error('autoPassThreshold must be between 0 and 1');
    }
  }

  if (config.evaluator.autoFailThreshold !== undefined) {
    if (config.evaluator.autoFailThreshold < 0 || config.evaluator.autoFailThreshold > 1) {
      throw new Error('autoFailThreshold must be between 0 and 1');
    }
  }

  // Validate threshold relationship
  const passThreshold = config.evaluator.autoPassThreshold ?? 0.95;
  const failThreshold = config.evaluator.autoFailThreshold ?? 0.3;

  if (passThreshold <= failThreshold) {
    throw new Error('autoPassThreshold must be greater than autoFailThreshold');
  }
}

export async function loadConfig(projectDir: string): Promise<Config> {
  const configPath = path.join(projectDir, 'visual-uat.config.js');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  // Dynamic import for user config
  // Clear require cache to ensure fresh load in tests
  delete require.cache[require.resolve(configPath)];
  const userConfig = require(configPath);

  // Deep merge with defaults
  const config: Config = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    plugins: {
      ...DEFAULT_CONFIG.plugins,
      ...userConfig.plugins
    },
    evaluator: {
      ...DEFAULT_CONFIG.evaluator,
      ...userConfig.evaluator
    },
    targetRunner: {
      ...DEFAULT_CONFIG.targetRunner,
      ...userConfig.targetRunner
    }
  };

  // Validate the merged config
  validateConfig(config);

  return config;
}

export async function findConfigDir(): Promise<string> {
  let currentDir = process.cwd();

  // Walk up directory tree looking for config file
  while (currentDir !== path.parse(currentDir).root) {
    const configPath = path.join(currentDir, 'visual-uat.config.js');
    if (fs.existsSync(configPath)) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  throw new Error('visual-uat.config.js not found in current directory or any parent');
}
