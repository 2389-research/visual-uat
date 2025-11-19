// ABOUTME: Plugin interface definitions for extensible visual UAT system
// ABOUTME: Defines contracts for target runners, test generators, differs, and evaluators

import { RunResult } from '../orchestrator/types/results';

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
