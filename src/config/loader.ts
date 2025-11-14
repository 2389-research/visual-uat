// ABOUTME: Configuration file loader with default merging
// ABOUTME: Discovers and loads visual-uat.config.js from project directory

import * as path from 'path';
import * as fs from 'fs';
import { Config, DEFAULT_CONFIG } from '../types/config';

export async function loadConfig(projectDir: string): Promise<Config> {
  const configPath = path.join(projectDir, 'visual-uat.config.js');

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  // Dynamic import for user config
  const userConfig = require(configPath);

  // Deep merge with defaults
  const config: Config = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    evaluator: {
      ...DEFAULT_CONFIG.evaluator,
      ...userConfig.evaluator
    },
    targetRunner: {
      ...DEFAULT_CONFIG.targetRunner,
      ...userConfig.targetRunner
    }
  };

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
