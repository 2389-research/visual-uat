// ABOUTME: Service for running Playwright tests in worktrees.
// ABOUTME: Executes tests, parses output, and captures screenshot paths.

import { spawnSync } from 'child_process';
import { RawTestResult } from '../handlers/execution-states';

export class TestRunner {
  constructor(
    private worktreePath: string,
    private screenshotDir: string
  ) {}

  async runTest(testPath: string): Promise<RawTestResult> {
    const result = spawnSync(
      'npx',
      ['playwright', 'test', testPath, '--reporter=json'],
      {
        cwd: this.worktreePath,
        env: {
          ...process.env,
          SCREENSHOT_DIR: this.screenshotDir
        },
        encoding: 'utf-8'
      }
    );

    if (result.error) {
      return {
        testPath,
        status: 'errored',
        duration: 0,
        screenshots: [],
        error: result.error.message
      };
    }

    if (result.status !== 0) {
      const errorMessage = result.stderr
        ? (typeof result.stderr === 'string' ? result.stderr : String(result.stderr))
        : 'Test execution failed';

      return {
        testPath,
        status: 'errored',
        duration: 0,
        screenshots: [],
        error: errorMessage
      };
    }

    // TODO: Parse JSON output to get screenshots and duration
    return {
      testPath,
      status: 'passed',
      duration: 0,
      screenshots: []
    };
  }
}
