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
}

export interface EvaluatorConfig {
  autoPassThreshold?: number;
  autoFailThreshold?: number;
}

export interface TerminalReporterConfig {
  enabled?: boolean;
  defaultVerbosity?: 'quiet' | 'normal' | 'verbose';
}

export interface HtmlReporterConfig {
  enabled?: boolean;
  // Note: Image embedding (base64) deferred to future enhancement
}

export interface ReporterConfig {
  terminal?: TerminalReporterConfig;
  html?: HtmlReporterConfig;
}

export interface Config {
  baseBranch: string;
  specsDir: string;          // Legacy: direct specs
  storiesDir?: string;       // New: natural language stories
  generatedDir: string;
  runner?: string;           // New: 'playwright' | 'tui' | 'swift' etc.
  plugins: PluginConfig;
  targetRunner: TargetRunnerConfig;
  evaluator: EvaluatorConfig;
  reporters?: ReporterConfig;
}

export const DEFAULT_CONFIG: Partial<Config> = {
  baseBranch: 'main',
  specsDir: './tests',
  storiesDir: './tests/stories',
  generatedDir: './tests/generated',
  runner: 'playwright',
  evaluator: {
    autoPassThreshold: 0.95,
    autoFailThreshold: 0.3
  }
};
