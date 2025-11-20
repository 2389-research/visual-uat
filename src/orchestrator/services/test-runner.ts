// ABOUTME: Service for running Playwright tests in worktrees.
// ABOUTME: Executes tests, parses output, and captures screenshot paths.

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RawTestResult } from '../handlers/execution-states';

export class TestRunner {
  constructor(
    private worktreePath: string,
    private screenshotDir: string,
    private baseUrl: string
  ) {}

  runTest(testPath: string): RawTestResult {
    const result = spawnSync(
      'npx',
      ['playwright', 'test', testPath, '--reporter=json'],
      {
        cwd: this.worktreePath,
        env: {
          ...process.env,
          SCREENSHOT_DIR: this.screenshotDir,
          BASE_URL: this.baseUrl
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
      const errorMessage = result.stderr || result.stdout || 'Test execution failed';

      return {
        testPath,
        status: 'errored',
        duration: 0,
        screenshots: [],
        error: `Exit code ${result.status}: ${errorMessage}`
      };
    }

    // Discover screenshots by scanning the screenshot directory
    const screenshots: string[] = [];
    try {
      if (fs.existsSync(this.screenshotDir)) {
        const files = fs.readdirSync(this.screenshotDir);
        screenshots.push(...files.filter(f => f.endsWith('.png')));
      }
    } catch (error) {
      // If we can't read the directory, just return empty screenshots
      console.warn(`Warning: Could not read screenshot directory: ${error}`);
    }

    // Parse JSON output for duration and status
    let duration = 0;
    try {
      const output = JSON.parse(result.stdout);
      if (output.suites && output.suites[0]?.specs?.[0]?.tests?.[0]?.results?.[0]) {
        duration = output.suites[0].specs[0].tests[0].results[0].duration;
      }
    } catch (error) {
      // If JSON parsing fails, duration stays 0
    }

    return {
      testPath,
      status: 'passed',
      duration,
      screenshots
    };
  }
}
