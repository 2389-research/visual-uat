# Visual UAT Tool Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a pluggable visual acceptance testing CLI tool that generates tests from natural language, runs them across git branches, and uses LLM evaluation to verify visual changes match intent.

**Architecture:** Plugin-based system with core orchestrator coordinating spec watching, test generation, execution in isolated environments, screenshot diffing, and LLM-based evaluation. Start with web app support via Playwright, extensible to other targets.

**Tech Stack:** TypeScript, Node.js, Playwright, pixelmatch (diffing), Anthropic Claude API (LLM), Commander.js (CLI)

---

## Project Setup & Foundation

### Task 1: Initialize TypeScript Project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `src/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "visual-uat",
  "version": "0.1.0",
  "description": "Visual acceptance testing with LLM-powered test generation",
  "main": "dist/index.js",
  "bin": {
    "visual-uat": "./dist/cli.js"
  },
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "dev": "tsc --watch"
  },
  "keywords": ["testing", "visual", "regression", "playwright"],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "commander": "^11.1.0",
    "playwright": "^1.40.0",
    "pixelmatch": "^5.3.0",
    "pngjs": "^7.0.0",
    "anthropic": "^0.9.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "@types/jest": "^29.5.0",
    "@types/pixelmatch": "^5.2.6",
    "@types/pngjs": "^6.0.4",
    "typescript": "^5.3.0",
    "jest": "^29.7.0",
    "ts-jest": "^29.1.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 3: Create jest.config.js**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/__tests__/**'
  ]
};
```

**Step 4: Create placeholder src/index.ts**

```typescript
// ABOUTME: Main entry point for visual-uat library
// ABOUTME: Exports public API for programmatic usage

export const version = '0.1.0';
```

**Step 5: Install dependencies**

Run: `npm install`
Expected: Dependencies installed successfully

**Step 6: Verify build works**

Run: `npm run build`
Expected: `dist/index.js` created without errors

**Step 7: Commit**

```bash
git add package.json tsconfig.json jest.config.js src/index.ts
git commit -m "feat: initialize TypeScript project with build tooling"
```

---

## Core Types & Interfaces

### Task 2: Define Plugin Interfaces

**Files:**
- Create: `src/types/plugins.ts`
- Create: `src/types/plugins.test.ts`

**Step 1: Write test for type exports**

Create `src/types/plugins.test.ts`:

```typescript
// ABOUTME: Tests for plugin interface type definitions
// ABOUTME: Validates that all plugin interfaces are properly exported and type-safe

import type {
  TargetRunner,
  TestGenerator,
  Differ,
  Evaluator,
  TargetInfo,
  TestSpec,
  GeneratedTest,
  DiffResult,
  EvaluationInput,
  EvaluationResult
} from './plugins';

describe('Plugin Interfaces', () => {
  it('should export TargetRunner interface', () => {
    // Type-only test - if this compiles, types are correct
    const mockRunner: TargetRunner = {
      start: async (branch: string) => ({
        baseUrl: 'http://localhost:3000',
        environment: {},
        metadata: {}
      }),
      stop: async (info: TargetInfo) => {},
      isReady: async (info: TargetInfo) => true
    };
    expect(mockRunner).toBeDefined();
  });

  it('should export TestGenerator interface', () => {
    const mockGenerator: TestGenerator = {
      generate: async (spec: TestSpec, context: any) => ({
        code: 'test code',
        language: 'typescript',
        checkpoints: ['checkpoint1']
      })
    };
    expect(mockGenerator).toBeDefined();
  });

  it('should export Differ interface', () => {
    const mockDiffer: Differ = {
      compare: async (baseline: any, current: any) => ({
        diffImage: Buffer.from(''),
        pixelDiffPercent: 0,
        changedRegions: [],
        identical: true
      })
    };
    expect(mockDiffer).toBeDefined();
  });

  it('should export Evaluator interface', () => {
    const mockEvaluator: Evaluator = {
      evaluate: async (input: EvaluationInput) => ({
        pass: true,
        confidence: 0.95,
        reason: 'No changes detected',
        needsReview: false
      })
    };
    expect(mockEvaluator).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test plugins.test.ts`
Expected: FAIL with "Cannot find module './plugins'"

**Step 3: Implement plugin interfaces**

Create `src/types/plugins.ts`:

```typescript
// ABOUTME: Plugin interface definitions for extensible visual UAT system
// ABOUTME: Defines contracts for target runners, test generators, differs, and evaluators

export interface TargetInfo {
  baseUrl: string;
  environment: Record<string, string>;
  metadata: Record<string, any>;
}

export interface TargetRunner {
  start(branch: string): Promise<TargetInfo>;
  stop(targetInfo: TargetInfo): Promise<void>;
  isReady(targetInfo: TargetInfo): Promise<boolean>;
}

export interface TestSpec {
  filePath: string;
  content: string;
  metadata: Record<string, any>;
}

export interface CodebaseContext {
  fileTree: string[];
  components: string[];
  metadata: Record<string, any>;
}

export interface GeneratedTest {
  code: string;
  language: 'typescript' | 'javascript';
  checkpoints: string[];
}

export interface TestGenerator {
  generate(spec: TestSpec, context: CodebaseContext): Promise<GeneratedTest>;
}

export interface Screenshot {
  data: Buffer;
  width: number;
  height: number;
  checkpoint: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiffResult {
  diffImage: Buffer;
  pixelDiffPercent: number;
  changedRegions: BoundingBox[];
  identical: boolean;
}

export interface Differ {
  compare(baseline: Screenshot, current: Screenshot): Promise<DiffResult>;
}

export interface EvaluationInput {
  intent: string;
  checkpoint: string;
  diffResult: DiffResult;
  baselineImage: Buffer;
  currentImage: Buffer;
}

export interface EvaluationResult {
  pass: boolean;
  confidence: number;
  reason: string;
  needsReview: boolean;
}

export interface Evaluator {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test plugins.test.ts`
Expected: PASS - all interface exports work

**Step 5: Commit**

```bash
git add src/types/plugins.ts src/types/plugins.test.ts
git commit -m "feat: add plugin interface definitions"
```

### Task 3: Define Configuration Types

**Files:**
- Create: `src/types/config.ts`
- Create: `src/types/config.test.ts`

**Step 1: Write test for config types**

Create `src/types/config.test.ts`:

```typescript
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
```

**Step 2: Run test to verify it fails**

Run: `npm test config.test.ts`
Expected: FAIL with "Cannot find module './config'"

**Step 3: Implement configuration types**

Create `src/types/config.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npm test config.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/types/config.ts src/types/config.test.ts
git commit -m "feat: add configuration type definitions"
```

---

## Configuration Loading

### Task 4: Implement Config Loader

**Files:**
- Create: `src/config/loader.ts`
- Create: `src/config/loader.test.ts`
- Create: `test-fixtures/visual-uat.config.js` (test fixture)

**Step 1: Write failing test**

Create `src/config/loader.test.ts`:

```typescript
// ABOUTME: Tests for configuration file loading
// ABOUTME: Validates config file discovery, loading, and merging with defaults

import { loadConfig } from './loader';
import { DEFAULT_CONFIG } from '../types/config';
import * as fs from 'fs';
import * as path from 'path';

describe('Config Loader', () => {
  const fixtureDir = path.join(__dirname, '../../test-fixtures');

  beforeAll(() => {
    // Create test fixture directory
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }

    // Create test config file
    const testConfig = `
module.exports = {
  baseBranch: 'develop',
  specsDir: './specs',
  generatedDir: './specs/generated',
  plugins: {
    targetRunner: '@test/runner',
    testGenerator: '@test/generator',
    differ: '@test/differ',
    evaluator: '@test/evaluator'
  },
  targetRunner: {
    startCommand: 'npm start',
    baseUrl: 'http://localhost:4000'
  },
  evaluator: {
    autoPassThreshold: 0.9
  }
};
    `;
    fs.writeFileSync(path.join(fixtureDir, 'visual-uat.config.js'), testConfig);
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(fixtureDir)) {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it('should load config from file', async () => {
    const config = await loadConfig(fixtureDir);
    expect(config.baseBranch).toBe('develop');
    expect(config.specsDir).toBe('./specs');
    expect(config.plugins.targetRunner).toBe('@test/runner');
  });

  it('should merge with defaults', async () => {
    const config = await loadConfig(fixtureDir);
    // User specified 0.9, should use that
    expect(config.evaluator.autoPassThreshold).toBe(0.9);
    // User didn't specify autoFailThreshold, should use default
    expect(config.evaluator.autoFailThreshold).toBe(0.3);
  });

  it('should throw error if config file not found', async () => {
    await expect(loadConfig('/nonexistent')).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test loader.test.ts`
Expected: FAIL with "Cannot find module './loader'"

**Step 3: Implement config loader**

Create `src/config/loader.ts`:

```typescript
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
```

**Step 4: Run test to verify it passes**

Run: `npm test loader.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/config/loader.ts src/config/loader.test.ts
git commit -m "feat: implement configuration file loader"
```

---

## Spec Watcher & Manifest

### Task 5: Implement Spec Manifest

**Files:**
- Create: `src/specs/manifest.ts`
- Create: `src/specs/manifest.test.ts`

**Step 1: Write failing test**

Create `src/specs/manifest.test.ts`:

```typescript
// ABOUTME: Tests for spec file manifest management
// ABOUTME: Validates hash tracking and change detection for test specifications

import { SpecManifest } from './manifest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('SpecManifest', () => {
  const testDir = path.join(__dirname, '../../test-fixtures/manifest-test');
  const manifestPath = path.join(testDir, '.visual-uat', 'manifest.json');

  beforeEach(() => {
    // Clean test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create new manifest if none exists', () => {
    const manifest = new SpecManifest(testDir);
    expect(manifest).toBeDefined();
  });

  it('should detect new spec file', () => {
    const specPath = path.join(testDir, 'test.md');
    fs.writeFileSync(specPath, 'test content');

    const manifest = new SpecManifest(testDir);
    const changes = manifest.detectChanges([specPath]);

    expect(changes.new).toContain(specPath);
    expect(changes.modified).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
  });

  it('should detect modified spec file', () => {
    const specPath = path.join(testDir, 'test.md');
    fs.writeFileSync(specPath, 'original content');

    const manifest = new SpecManifest(testDir);
    manifest.detectChanges([specPath]);
    manifest.save();

    // Modify file
    fs.writeFileSync(specPath, 'modified content');

    const changes = manifest.detectChanges([specPath]);
    expect(changes.modified).toContain(specPath);
    expect(changes.new).toHaveLength(0);
  });

  it('should detect deleted spec file', () => {
    const specPath = path.join(testDir, 'test.md');
    fs.writeFileSync(specPath, 'test content');

    const manifest = new SpecManifest(testDir);
    manifest.detectChanges([specPath]);
    manifest.save();

    // Delete file
    fs.unlinkSync(specPath);

    const changes = manifest.detectChanges([]);
    expect(changes.deleted).toContain(specPath);
  });

  it('should update manifest after changes', () => {
    const specPath = path.join(testDir, 'test.md');
    fs.writeFileSync(specPath, 'test content');

    const manifest = new SpecManifest(testDir);
    const changes = manifest.detectChanges([specPath]);
    manifest.updateSpec(specPath, 'generated/test.spec.ts');
    manifest.save();

    // Load again and verify no changes
    const manifest2 = new SpecManifest(testDir);
    const changes2 = manifest2.detectChanges([specPath]);
    expect(changes2.new).toHaveLength(0);
    expect(changes2.modified).toHaveLength(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test manifest.test.ts`
Expected: FAIL with "Cannot find module './manifest'"

**Step 3: Implement spec manifest**

Create `src/specs/manifest.ts`:

```typescript
// ABOUTME: Spec file manifest for tracking changes via content hashing
// ABOUTME: Detects new, modified, and deleted test specification files

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface ManifestEntry {
  hash: string;
  generatedPath: string;
  lastModified: number;
}

interface SpecChanges {
  new: string[];
  modified: string[];
  deleted: string[];
}

export class SpecManifest {
  private manifestPath: string;
  private entries: Map<string, ManifestEntry>;

  constructor(projectDir: string) {
    const visualUatDir = path.join(projectDir, '.visual-uat');
    if (!fs.existsSync(visualUatDir)) {
      fs.mkdirSync(visualUatDir, { recursive: true });
    }

    this.manifestPath = path.join(visualUatDir, 'manifest.json');
    this.entries = new Map();

    if (fs.existsSync(this.manifestPath)) {
      const data = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
      Object.entries(data).forEach(([path, entry]) => {
        this.entries.set(path, entry as ManifestEntry);
      });
    }
  }

  private hashFile(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  detectChanges(currentSpecPaths: string[]): SpecChanges {
    const changes: SpecChanges = {
      new: [],
      modified: [],
      deleted: []
    };

    const currentPathSet = new Set(currentSpecPaths);

    // Check for new and modified
    for (const specPath of currentSpecPaths) {
      const currentHash = this.hashFile(specPath);
      const entry = this.entries.get(specPath);

      if (!entry) {
        changes.new.push(specPath);
      } else if (entry.hash !== currentHash) {
        changes.modified.push(specPath);
      }
    }

    // Check for deleted
    for (const [specPath] of this.entries) {
      if (!currentPathSet.has(specPath)) {
        changes.deleted.push(specPath);
      }
    }

    return changes;
  }

  updateSpec(specPath: string, generatedPath: string): void {
    const hash = this.hashFile(specPath);
    const stats = fs.statSync(specPath);

    this.entries.set(specPath, {
      hash,
      generatedPath,
      lastModified: stats.mtimeMs
    });
  }

  removeSpec(specPath: string): void {
    this.entries.delete(specPath);
  }

  getGeneratedPath(specPath: string): string | undefined {
    return this.entries.get(specPath)?.generatedPath;
  }

  save(): void {
    const data = Object.fromEntries(this.entries);
    fs.writeFileSync(this.manifestPath, JSON.stringify(data, null, 2));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test manifest.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/specs/manifest.ts src/specs/manifest.test.ts
git commit -m "feat: implement spec file manifest with change detection"
```

---

## Test Generator Plugin (Stub)

### Task 6: Implement Stub Test Generator

**Files:**
- Create: `src/plugins/test-generator-stub.ts`
- Create: `src/plugins/test-generator-stub.test.ts`

**Step 1: Write failing test**

Create `src/plugins/test-generator-stub.test.ts`:

```typescript
// ABOUTME: Tests for stub test generator (template-based, no LLM)
// ABOUTME: Validates basic test script generation from natural language specs

import { StubTestGenerator } from './test-generator-stub';
import type { TestSpec, CodebaseContext } from '../types/plugins';

describe('StubTestGenerator', () => {
  const generator = new StubTestGenerator();

  it('should generate basic Playwright test', async () => {
    const spec: TestSpec = {
      filePath: 'test.md',
      content: 'Navigate to homepage and verify title',
      metadata: {}
    };

    const context: CodebaseContext = {
      fileTree: [],
      components: [],
      metadata: {}
    };

    const result = await generator.generate(spec, context);

    expect(result.language).toBe('typescript');
    expect(result.code).toContain('test(');
    expect(result.code).toContain('page.goto');
    expect(result.checkpoints.length).toBeGreaterThan(0);
  });

  it('should extract checkpoint names from spec', async () => {
    const spec: TestSpec = {
      filePath: 'test.md',
      content: 'Step 1: Login\nCheckpoint: after-login\nStep 2: View dashboard\nCheckpoint: dashboard-loaded',
      metadata: {}
    };

    const context: CodebaseContext = {
      fileTree: [],
      components: [],
      metadata: {}
    };

    const result = await generator.generate(spec, context);

    expect(result.checkpoints).toContain('after-login');
    expect(result.checkpoints).toContain('dashboard-loaded');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test test-generator-stub.test.ts`
Expected: FAIL with "Cannot find module './test-generator-stub'"

**Step 3: Implement stub generator**

Create `src/plugins/test-generator-stub.ts`:

```typescript
// ABOUTME: Stub test generator using template-based approach
// ABOUTME: Generates basic Playwright tests without LLM (placeholder for MVP)

import type { TestGenerator, TestSpec, CodebaseContext, GeneratedTest } from '../types/plugins';

export class StubTestGenerator implements TestGenerator {
  async generate(spec: TestSpec, context: CodebaseContext): Promise<GeneratedTest> {
    // Extract checkpoints from spec (lines starting with "Checkpoint:")
    const checkpoints = this.extractCheckpoints(spec.content);

    // Generate basic Playwright test template
    const code = this.generatePlaywrightTest(spec.content, checkpoints);

    return {
      code,
      language: 'typescript',
      checkpoints
    };
  }

  private extractCheckpoints(content: string): string[] {
    const checkpointRegex = /Checkpoint:\s*([a-z0-9-]+)/gi;
    const matches = [...content.matchAll(checkpointRegex)];
    return matches.map(m => m[1]);
  }

  private generatePlaywrightTest(content: string, checkpoints: string[]): string {
    const steps = content.split('\n').filter(line => line.trim().length > 0);

    let code = `import { test, expect, Page } from '@playwright/test';
import { screenshotCheckpoint } from '@visual-uat/playwright-helpers';

test('${steps[0] || 'visual test'}', async ({ page }) => {
  // Navigate to base URL (from config)
  await page.goto(process.env.BASE_URL || 'http://localhost:3000');

`;

    // Add checkpoints
    checkpoints.forEach((checkpoint, idx) => {
      code += `  // Checkpoint ${idx + 1}: ${checkpoint}\n`;
      code += `  await screenshotCheckpoint(page, '${checkpoint}');\n\n`;
    });

    code += `});\n`;

    return code;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test test-generator-stub.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/test-generator-stub.ts src/plugins/test-generator-stub.test.ts
git commit -m "feat: implement stub test generator with checkpoint extraction"
```

---

## Playwright Target Runner

### Task 7: Implement Playwright Target Runner

**Files:**
- Create: `src/plugins/playwright-runner.ts`
- Create: `src/plugins/playwright-runner.test.ts`

**Step 1: Write failing test**

Create `src/plugins/playwright-runner.test.ts`:

```typescript
// ABOUTME: Tests for Playwright-based target runner
// ABOUTME: Validates starting/stopping web servers in isolated environments

import { PlaywrightRunner } from './playwright-runner';
import type { TargetInfo } from '../types/plugins';

describe('PlaywrightRunner', () => {
  it('should create runner with config', () => {
    const runner = new PlaywrightRunner({
      startCommand: 'npm start',
      baseUrl: 'http://localhost:3000'
    });
    expect(runner).toBeDefined();
  });

  it('should allocate different ports for different branches', async () => {
    const runner = new PlaywrightRunner({
      startCommand: 'npm start',
      baseUrl: 'http://localhost:3000'
    });

    const info1 = await runner.allocatePort('main');
    const info2 = await runner.allocatePort('feature-branch');

    // Extract ports from URLs
    const port1 = new URL(info1.baseUrl).port;
    const port2 = new URL(info2.baseUrl).port;

    expect(port1).not.toBe(port2);
  });

  // Note: Full integration test of start/stop would require actual server
  // For unit test, we test port allocation and config handling
});
```

**Step 2: Run test to verify it fails**

Run: `npm test playwright-runner.test.ts`
Expected: FAIL with "Cannot find module './playwright-runner'"

**Step 3: Implement Playwright runner**

Create `src/plugins/playwright-runner.ts`:

```typescript
// ABOUTME: Playwright-based target runner for web applications
// ABOUTME: Manages starting/stopping dev servers in isolated port-based environments

import type { TargetRunner, TargetInfo, TargetRunnerConfig } from '../types/plugins';
import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';

export class PlaywrightRunner implements TargetRunner {
  private config: TargetRunnerConfig;
  private processes: Map<string, ChildProcess> = new Map();
  private portAllocations: Map<string, number> = new Map();

  constructor(config: TargetRunnerConfig) {
    this.config = config;
  }

  async start(branch: string): Promise<TargetInfo> {
    const port = await this.findFreePort();
    this.portAllocations.set(branch, port);

    const baseUrl = this.config.baseUrl
      ? this.config.baseUrl.replace(/:\d+/, `:${port}`)
      : `http://localhost:${port}`;

    if (this.config.startCommand) {
      const child = spawn(this.config.startCommand, [], {
        shell: true,
        env: {
          ...process.env,
          PORT: port.toString(),
          BASE_URL: baseUrl
        }
      });

      this.processes.set(branch, child);

      // Wait for server to be ready
      await this.waitForServer(baseUrl);
    }

    return {
      baseUrl,
      environment: {
        PORT: port.toString(),
        BRANCH: branch
      },
      metadata: {
        pid: this.processes.get(branch)?.pid
      }
    };
  }

  async stop(targetInfo: TargetInfo): Promise<void> {
    const branch = targetInfo.environment.BRANCH;
    const process = this.processes.get(branch);

    if (process) {
      process.kill('SIGTERM');
      this.processes.delete(branch);
    }

    this.portAllocations.delete(branch);
  }

  async isReady(targetInfo: TargetInfo): Promise<boolean> {
    try {
      const response = await fetch(targetInfo.baseUrl);
      return response.ok;
    } catch {
      return false;
    }
  }

  async allocatePort(branch: string): Promise<TargetInfo> {
    const port = await this.findFreePort();
    this.portAllocations.set(branch, port);

    const baseUrl = this.config.baseUrl
      ? this.config.baseUrl.replace(/:\d+/, `:${port}`)
      : `http://localhost:${port}`;

    return {
      baseUrl,
      environment: {
        PORT: port.toString(),
        BRANCH: branch
      },
      metadata: {}
    };
  }

  private async findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = net.createServer();
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address !== 'string') {
          const port = address.port;
          server.close(() => resolve(port));
        } else {
          reject(new Error('Failed to get port'));
        }
      });
      server.on('error', reject);
    });
  }

  private async waitForServer(baseUrl: string, timeout = 30000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      try {
        const response = await fetch(baseUrl);
        if (response.ok) return;
      } catch {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Server at ${baseUrl} did not become ready within ${timeout}ms`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test playwright-runner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/playwright-runner.ts src/plugins/playwright-runner.test.ts
git commit -m "feat: implement Playwright target runner with port isolation"
```

---

## Screenshot Differ

### Task 8: Implement Pixelmatch Differ

**Files:**
- Create: `src/plugins/pixelmatch-differ.ts`
- Create: `src/plugins/pixelmatch-differ.test.ts`

**Step 1: Write failing test**

Create `src/plugins/pixelmatch-differ.test.ts`:

```typescript
// ABOUTME: Tests for pixelmatch-based screenshot differ
// ABOUTME: Validates pixel-level comparison and diff image generation

import { PixelmatchDiffer } from './pixelmatch-differ';
import { PNG } from 'pngjs';
import type { Screenshot } from '../types/plugins';

describe('PixelmatchDiffer', () => {
  const differ = new PixelmatchDiffer();

  function createTestImage(width: number, height: number, color: [number, number, number]): Buffer {
    const png = new PNG({ width, height });
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        png.data[idx] = color[0];
        png.data[idx + 1] = color[1];
        png.data[idx + 2] = color[2];
        png.data[idx + 3] = 255;
      }
    }
    return PNG.sync.write(png);
  }

  it('should detect identical images', async () => {
    const img = createTestImage(100, 100, [255, 0, 0]);

    const screenshot1: Screenshot = {
      data: img,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const screenshot2: Screenshot = {
      data: img,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const result = await differ.compare(screenshot1, screenshot2);

    expect(result.identical).toBe(true);
    expect(result.pixelDiffPercent).toBe(0);
    expect(result.changedRegions).toHaveLength(0);
  });

  it('should detect different images', async () => {
    const img1 = createTestImage(100, 100, [255, 0, 0]);
    const img2 = createTestImage(100, 100, [0, 255, 0]);

    const screenshot1: Screenshot = {
      data: img1,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const screenshot2: Screenshot = {
      data: img2,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const result = await differ.compare(screenshot1, screenshot2);

    expect(result.identical).toBe(false);
    expect(result.pixelDiffPercent).toBeGreaterThan(50);
    expect(result.diffImage).toBeDefined();
  });

  it('should throw error for different dimensions', async () => {
    const img1 = createTestImage(100, 100, [255, 0, 0]);
    const img2 = createTestImage(200, 200, [255, 0, 0]);

    const screenshot1: Screenshot = {
      data: img1,
      width: 100,
      height: 100,
      checkpoint: 'test'
    };

    const screenshot2: Screenshot = {
      data: img2,
      width: 200,
      height: 200,
      checkpoint: 'test'
    };

    await expect(differ.compare(screenshot1, screenshot2)).rejects.toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test pixelmatch-differ.test.ts`
Expected: FAIL with "Cannot find module './pixelmatch-differ'"

**Step 3: Implement pixelmatch differ**

Create `src/plugins/pixelmatch-differ.ts`:

```typescript
// ABOUTME: Pixelmatch-based screenshot differ for visual comparison
// ABOUTME: Generates pixel-level diffs and calculates change metrics

import type { Differ, Screenshot, DiffResult, BoundingBox } from '../types/plugins';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

export class PixelmatchDiffer implements Differ {
  async compare(baseline: Screenshot, current: Screenshot): Promise<DiffResult> {
    if (baseline.width !== current.width || baseline.height !== current.height) {
      throw new Error(
        `Image dimensions mismatch: baseline ${baseline.width}x${baseline.height} vs current ${current.width}x${current.height}`
      );
    }

    const img1 = PNG.sync.read(baseline.data);
    const img2 = PNG.sync.read(current.data);
    const { width, height } = img1;
    const diff = new PNG({ width, height });

    const numDiffPixels = pixelmatch(
      img1.data,
      img2.data,
      diff.data,
      width,
      height,
      { threshold: 0.1 }
    );

    const totalPixels = width * height;
    const pixelDiffPercent = (numDiffPixels / totalPixels) * 100;
    const identical = numDiffPixels === 0;

    // Generate diff image
    const diffImage = PNG.sync.write(diff);

    // Calculate changed regions (simplified - single bounding box for all changes)
    const changedRegions = identical ? [] : this.findChangedRegions(diff.data, width, height);

    return {
      diffImage,
      pixelDiffPercent,
      changedRegions,
      identical
    };
  }

  private findChangedRegions(diffData: Buffer, width: number, height: number): BoundingBox[] {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasChanges = false;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (width * y + x) << 2;
        // Check if pixel is marked as different (red in diff image)
        if (diffData[idx] > 0) {
          hasChanges = true;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (!hasChanges) return [];

    return [{
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1
    }];
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test pixelmatch-differ.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/pixelmatch-differ.ts src/plugins/pixelmatch-differ.test.ts
git commit -m "feat: implement pixelmatch differ with region detection"
```

---

## LLM Evaluator

### Task 9: Implement Claude-based Evaluator

**Files:**
- Create: `src/plugins/claude-evaluator.ts`
- Create: `src/plugins/claude-evaluator.test.ts`

**Step 1: Write failing test**

Create `src/plugins/claude-evaluator.test.ts`:

```typescript
// ABOUTME: Tests for Claude LLM-based diff evaluator
// ABOUTME: Validates evaluation logic and confidence threshold handling

import { ClaudeEvaluator } from './claude-evaluator';
import type { EvaluationInput, DiffResult } from '../types/plugins';

describe('ClaudeEvaluator', () => {
  // Mock API key for testing
  const apiKey = process.env.ANTHROPIC_API_KEY || 'test-key';

  it('should create evaluator with thresholds', () => {
    const evaluator = new ClaudeEvaluator(apiKey, {
      autoPassThreshold: 0.95,
      autoFailThreshold: 0.3
    });
    expect(evaluator).toBeDefined();
  });

  it('should determine needsReview based on confidence', async () => {
    const evaluator = new ClaudeEvaluator(apiKey, {
      autoPassThreshold: 0.95,
      autoFailThreshold: 0.3
    });

    // Test high confidence
    const highConfResult = evaluator['determineNeedsReview'](0.96, true);
    expect(highConfResult).toBe(false);

    // Test low confidence
    const lowConfResult = evaluator['determineNeedsReview'](0.25, false);
    expect(lowConfResult).toBe(false);

    // Test medium confidence
    const medConfResult = evaluator['determineNeedsReview'](0.5, true);
    expect(medConfResult).toBe(true);
  });

  it('should handle identical images without API call', async () => {
    const evaluator = new ClaudeEvaluator(apiKey, {});

    const input: EvaluationInput = {
      intent: 'Test intent',
      checkpoint: 'test',
      diffResult: {
        diffImage: Buffer.from(''),
        pixelDiffPercent: 0,
        changedRegions: [],
        identical: true
      },
      baselineImage: Buffer.from(''),
      currentImage: Buffer.from('')
    };

    const result = await evaluator.evaluate(input);

    expect(result.pass).toBe(true);
    expect(result.confidence).toBe(1.0);
    expect(result.reason).toContain('identical');
    expect(result.needsReview).toBe(false);
  });

  // Note: Full LLM API test would require real API key and is expensive
  // Mock-based integration tests would go here
});
```

**Step 2: Run test to verify it fails**

Run: `npm test claude-evaluator.test.ts`
Expected: FAIL with "Cannot find module './claude-evaluator'"

**Step 3: Implement Claude evaluator**

Create `src/plugins/claude-evaluator.ts`:

```typescript
// ABOUTME: Claude LLM-based evaluator for visual diff assessment
// ABOUTME: Determines if screenshot differences match intended changes

import type { Evaluator, EvaluationInput, EvaluationResult, EvaluatorConfig } from '../types/plugins';
import Anthropic from 'anthropic';

export class ClaudeEvaluator implements Evaluator {
  private client: Anthropic;
  private config: EvaluatorConfig;

  constructor(apiKey: string, config: EvaluatorConfig) {
    this.client = new Anthropic({ apiKey });
    this.config = config;
  }

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    // Fast path: identical images
    if (input.diffResult.identical) {
      return {
        pass: true,
        confidence: 1.0,
        reason: 'Screenshots are identical - no visual changes detected',
        needsReview: false
      };
    }

    // Fast path: no changes expected but diff found
    if (this.noChangesExpected(input.intent) && !input.diffResult.identical) {
      return {
        pass: false,
        confidence: 0.9,
        reason: 'Visual changes detected but none were expected based on intent',
        needsReview: true
      };
    }

    // Call LLM for evaluation
    const result = await this.evaluateWithLLM(input);

    return result;
  }

  private async evaluateWithLLM(input: EvaluationInput): Promise<EvaluationResult> {
    const prompt = this.buildPrompt(input);

    try {
      const message = await this.client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: input.baselineImage.toString('base64')
              }
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: input.currentImage.toString('base64')
              }
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: input.diffResult.diffImage.toString('base64')
              }
            }
          ]
        }]
      });

      // Parse LLM response
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const parsed = this.parseResponse(responseText);

      return {
        pass: parsed.pass,
        confidence: parsed.confidence,
        reason: parsed.reason,
        needsReview: this.determineNeedsReview(parsed.confidence, parsed.pass)
      };
    } catch (error) {
      // Fallback if API fails
      return {
        pass: false,
        confidence: 0,
        reason: `LLM evaluation failed: ${error}`,
        needsReview: true
      };
    }
  }

  private buildPrompt(input: EvaluationInput): string {
    return `You are evaluating visual changes in a UI test.

**Test Intent:**
${input.intent}

**Checkpoint:** ${input.checkpoint}

**Diff Metrics:**
- Pixel difference: ${input.diffResult.pixelDiffPercent.toFixed(2)}%
- Changed regions: ${input.diffResult.changedRegions.length}

**Your Task:**
Compare the baseline (image 1), current (image 2), and diff (image 3) screenshots. Determine if the visual changes match the test intent.

Respond in this exact format:
PASS: true/false
CONFIDENCE: 0.0-1.0
REASON: <brief explanation>

Be strict: only pass if changes clearly align with intent.`;
  }

  private parseResponse(response: string): { pass: boolean; confidence: number; reason: string } {
    const passMatch = response.match(/PASS:\s*(true|false)/i);
    const confMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
    const reasonMatch = response.match(/REASON:\s*(.+?)(?=\n|$)/is);

    return {
      pass: passMatch ? passMatch[1].toLowerCase() === 'true' : false,
      confidence: confMatch ? parseFloat(confMatch[1]) : 0.5,
      reason: reasonMatch ? reasonMatch[1].trim() : 'Unable to parse evaluation'
    };
  }

  private determineNeedsReview(confidence: number, pass: boolean): boolean {
    const autoPassThreshold = this.config.autoPassThreshold || 0.95;
    const autoFailThreshold = this.config.autoFailThreshold || 0.3;

    if (pass && confidence >= autoPassThreshold) return false;
    if (!pass && confidence <= autoFailThreshold) return false;

    return true; // Between thresholds - needs manual review
  }

  private noChangesExpected(intent: string): boolean {
    const noChangeKeywords = ['no change', 'unchanged', 'same as', 'identical'];
    const lowerIntent = intent.toLowerCase();
    return noChangeKeywords.some(keyword => lowerIntent.includes(keyword));
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test claude-evaluator.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/plugins/claude-evaluator.ts src/plugins/claude-evaluator.test.ts
git commit -m "feat: implement Claude LLM evaluator with confidence thresholds"
```

---

## CLI Implementation

### Task 10: Implement Basic CLI

**Files:**
- Create: `src/cli.ts`
- Create: `src/cli.test.ts`

**Step 1: Write failing test**

Create `src/cli.test.ts`:

```typescript
// ABOUTME: Tests for CLI argument parsing and command structure
// ABOUTME: Validates command availability and help text

import { Command } from 'commander';
import { createCLI } from './cli';

describe('CLI', () => {
  it('should create CLI with commands', () => {
    const program = createCLI();
    expect(program).toBeDefined();
    expect(program.commands.length).toBeGreaterThan(0);
  });

  it('should have run command', () => {
    const program = createCLI();
    const runCmd = program.commands.find(cmd => cmd.name() === 'run');
    expect(runCmd).toBeDefined();
  });

  it('should have generate command', () => {
    const program = createCLI();
    const genCmd = program.commands.find(cmd => cmd.name() === 'generate');
    expect(genCmd).toBeDefined();
  });

  it('should have report command', () => {
    const program = createCLI();
    const reportCmd = program.commands.find(cmd => cmd.name() === 'report');
    expect(reportCmd).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test cli.test.ts`
Expected: FAIL with "Cannot find module './cli'"

**Step 3: Implement CLI**

Create `src/cli.ts`:

```typescript
#!/usr/bin/env node
// ABOUTME: CLI entry point for visual-uat tool
// ABOUTME: Defines commands for test generation, execution, and reporting

import { Command } from 'commander';
import { version } from './index';

export function createCLI(): Command {
  const program = new Command();

  program
    .name('visual-uat')
    .description('Visual acceptance testing with LLM-powered test generation')
    .version(version);

  program
    .command('run')
    .description('Generate tests (if needed) and run visual comparison')
    .option('--all', 'Force run all tests (ignore caching)')
    .option('--base <branch>', 'Base branch to compare against (default from config)')
    .action(async (options) => {
      console.log('Running visual tests...');
      console.log('Options:', options);
      // Implementation will be added in orchestrator task
      throw new Error('Not yet implemented');
    });

  program
    .command('generate')
    .description('Force regenerate all test scripts from specs')
    .action(async () => {
      console.log('Generating test scripts...');
      // Implementation will be added in generator task
      throw new Error('Not yet implemented');
    });

  program
    .command('report')
    .description('Open HTML report viewer')
    .option('--latest', 'Open most recent report')
    .action(async (options) => {
      console.log('Opening report...');
      console.log('Options:', options);
      // Implementation will be added in reporter task
      throw new Error('Not yet implemented');
    });

  return program;
}

// Run CLI if executed directly
if (require.main === module) {
  const program = createCLI();
  program.parse(process.argv);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test cli.test.ts`
Expected: PASS

**Step 5: Make CLI executable**

Run: `chmod +x src/cli.ts`
Expected: File permissions updated

**Step 6: Commit**

```bash
git add src/cli.ts src/cli.test.ts
git commit -m "feat: implement CLI with run, generate, and report commands"
```

---

## Summary & Next Steps

**MVP Implementation Plan Complete!**

This plan covers:
✅ Project setup with TypeScript
✅ Core plugin interfaces
✅ Configuration loading
✅ Spec manifest with change detection
✅ Stub test generator (template-based)
✅ Playwright target runner
✅ Pixelmatch differ
✅ Claude LLM evaluator
✅ Basic CLI structure

**Still needed (future tasks):**
- Orchestrator to coordinate all plugins
- Playwright helper for `screenshotCheckpoint()`
- HTML report generator
- Integration tests
- LLM-powered test generator (replacing stub)
- Error handling improvements
- Performance optimizations (caching, parallelization)

**Recommended order:**
1. Implement orchestrator (ties everything together)
2. Add Playwright helper utilities
3. Build HTML reporter
4. Write integration tests
5. Replace stub generator with LLM version
6. Add caching and performance features

@superpowers:test-driven-development - All implementation should follow TDD
@superpowers:systematic-debugging - Use for any failures during implementation
@superpowers:verification-before-completion - Must verify all tests pass before claiming done
