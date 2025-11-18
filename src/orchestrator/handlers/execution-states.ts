// ABOUTME: Type definitions for execution phase state machine.
// ABOUTME: Defines states, context, and raw test results from Playwright.

import { WorktreePaths } from '../services/worktree-manager';
import { RunResult } from '../types/results';

export type ExecutionState =
  | 'SETUP'
  | 'EXECUTE_BASE'
  | 'EXECUTE_CURRENT'
  | 'COMPARE_AND_EVALUATE'
  | 'STORE_RESULTS'
  | 'CLEANUP'
  | 'COMPLETE'
  | 'FAILED';

export interface RawTestResult {
  testPath: string;
  status: 'passed' | 'failed' | 'errored';
  duration: number;
  screenshots: string[];
  error?: string;
}

export interface ExecutionScope {
  type: 'full' | 'incremental' | 'skip';
  baseBranch: string;
  specsToGenerate: string[];
}

export interface ExecutionContext {
  scope: ExecutionScope | null;
  worktrees: WorktreePaths | null;
  baseResults: Map<string, RawTestResult>;
  currentResults: Map<string, RawTestResult>;
  runResult: RunResult | null;
  keepWorktrees: boolean;
}
