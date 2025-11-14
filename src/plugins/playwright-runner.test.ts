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
