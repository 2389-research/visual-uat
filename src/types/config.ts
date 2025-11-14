// ABOUTME: Configuration type definitions for visual-uat tool
// ABOUTME: Defines structure for user configuration files and runtime config

export interface PluginConfig {
  targetRunner: string;
  testGenerator: string;
  differ: string;
  evaluator: string;
}

export interface TargetRunnerConfig {
  startCommand?: string;
  baseUrl?: string;
  [key: string]: any;
}

export interface EvaluatorConfig {
  autoPassThreshold?: number;
  autoFailThreshold?: number;
  [key: string]: any;
}

export interface Config {
  baseBranch: string;
  specsDir: string;
  generatedDir: string;
  plugins: PluginConfig;
  targetRunner: TargetRunnerConfig;
  evaluator: EvaluatorConfig;
  [key: string]: any;
}

export const DEFAULT_CONFIG: Partial<Config> = {
  baseBranch: 'main',
  specsDir: './tests',
  generatedDir: './tests/generated',
  evaluator: {
    autoPassThreshold: 0.95,
    autoFailThreshold: 0.3
  }
};
