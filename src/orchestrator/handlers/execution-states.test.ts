// ABOUTME: Tests for execution phase state machine type definitions.
// ABOUTME: Verifies ExecutionState, ExecutionContext, and RawTestResult types.

import { ExecutionState, ExecutionContext, RawTestResult } from './execution-states';

describe('Execution State Types', () => {
  it('should create valid ExecutionContext', () => {
    const context: ExecutionContext = {
      scope: {
        type: 'full',
        baseBranch: 'main',
        specsToGenerate: ['tests/login.md']
      },
      worktrees: null,
      baseResults: new Map<string, RawTestResult>(),
      currentResults: new Map<string, RawTestResult>(),
      runResult: null,
      keepWorktrees: false
    };

    expect(context.scope?.type).toBe('full');
    expect(context.baseResults.size).toBe(0);
    expect(context.keepWorktrees).toBe(false);
  });

  it('should allow all valid ExecutionState values', () => {
    const states: ExecutionState[] = [
      'SETUP',
      'EXECUTE_BASE',
      'EXECUTE_CURRENT',
      'COMPARE_AND_EVALUATE',
      'STORE_RESULTS',
      'CLEANUP',
      'COMPLETE',
      'FAILED'
    ];

    states.forEach(state => {
      const s: ExecutionState = state;
      expect(s).toBe(state);
    });
  });

  it('should create valid RawTestResult', () => {
    const result: RawTestResult = {
      testPath: 'tests/generated/login.spec.ts',
      status: 'passed',
      duration: 1500,
      screenshots: ['initial.png', 'after-login.png']
    };

    expect(result.status).toBe('passed');
    expect(result.screenshots.length).toBe(2);
  });

  it('should include error for errored RawTestResult', () => {
    const result: RawTestResult = {
      testPath: 'tests/generated/broken.spec.ts',
      status: 'errored',
      duration: 30000,
      screenshots: [],
      error: 'Server timeout'
    };

    expect(result.status).toBe('errored');
    expect(result.error).toBe('Server timeout');
  });
});
