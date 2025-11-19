// ABOUTME: Type definitions for test execution results, including checkpoints, tests, and full run summaries.
// ABOUTME: These structures are persisted to JSON and used by the report viewer.

import { Config } from '../../types/config';
import { BoundingBox } from '../../types/plugins';

export interface CheckpointResult {
  name: string;
  baselineImage: string; // relative path
  currentImage: string;
  diffImage: string;
  diffMetrics: {
    pixelDiffPercent: number;
    changedRegions: BoundingBox[];
  };
  evaluation: {
    pass: boolean;
    confidence: number;
    reason: string;
    needsReview: boolean;
  };
}

export interface TestResult {
  specPath: string;
  generatedPath: string;
  status: 'passed' | 'failed' | 'errored' | 'needs-review';
  checkpoints: CheckpointResult[];
  error?: string;
  duration: number;
  baselineAvailable?: boolean;
}

export interface RunResult {
  runId: string;
  timestamp: number;
  baseBranch: string;
  currentBranch: string;
  config: Config;
  tests: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    errored: number;
    needsReview: number;
  };
}
