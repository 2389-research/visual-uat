// ABOUTME: Plugin interface definitions for extensible visual UAT system
// ABOUTME: Defines contracts for target runners, test generators, differs, and evaluators

import { RunResult, TestResult } from '../orchestrator/types/results';

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
  path: string;
  content: string;
  intent: string;
}

export interface CodebaseContext {
  files: string[];
  structure: string;
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
  codeChanges?: string;
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

export interface ReporterOptions {
  verbosity?: 'quiet' | 'normal' | 'verbose';
  outputDir?: string;
  autoOpen?: boolean;
}

export interface ReporterPlugin {
  generate(result: RunResult, options: ReporterOptions): Promise<void>;
}

// Story types (natural language input)
export interface Story {
  path: string;
  content: string;
  title: string;
  contentHash: string;
}

// BDD types (generated intermediate)
export type BDDStepType = 'given' | 'when' | 'then' | 'and' | 'but';

export interface BDDStep {
  type: BDDStepType;
  text: string;
}

export interface Checkpoint {
  name: string;
  capture: 'full-page' | 'viewport' | 'element';
  focus?: string[];
  selector?: string;
}

export interface BDDScenario {
  name: string;
  steps: BDDStep[];
  checkpoints: Checkpoint[];
}

export interface BDDSpec {
  path: string;
  sourceStory: string;
  storyHash: string;
  generatedAt: string;
  feature: string;
  scenarios: BDDScenario[];
}

// Test Runner Plugin types
export interface ExecutionContext {
  baseUrl: string;
  screenshotDir: string;
  environment: Record<string, string>;
}

export interface TestRunnerPlugin {
  name: string;
  fileExtension: string;
  generate(spec: BDDSpec): Promise<string>;
  execute(testPath: string, context: ExecutionContext): Promise<TestResult>;
}
