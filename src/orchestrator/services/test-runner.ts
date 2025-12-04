// ABOUTME: Service for running Playwright tests in worktrees.
// ABOUTME: Executes tests asynchronously, parses output, and captures screenshot paths.

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { RawTestResult } from '../handlers/execution-states';

export class TestRunner {
  constructor(
    private worktreePath: string,
    private screenshotDir: string,
    private baseUrl: string
  ) {}

  async runTest(testPath: string): Promise<RawTestResult> {
    const relativeTestPath = path.relative(this.worktreePath, testPath);

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';

      const proc = spawn(
        'npx',
        ['playwright', 'test', relativeTestPath, '--reporter=json'],
        {
          cwd: this.worktreePath,
          env: {
            ...process.env,
            SCREENSHOT_DIR: this.screenshotDir,
            BASE_URL: this.baseUrl
          }
        }
      );

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('error', (error) => {
        resolve({
          testPath,
          status: 'errored',
          duration: 0,
          screenshots: [],
          error: error.message
        });
      });

      proc.on('close', (code) => {
        if (code !== 0) {
          const errorMessage = stderr || stdout || 'Test execution failed';
          resolve({
            testPath,
            status: 'errored',
            duration: 0,
            screenshots: [],
            error: `Exit code ${code}: ${errorMessage}`
          });
          return;
        }

        const screenshots: string[] = [];
        try {
          if (fs.existsSync(this.screenshotDir)) {
            const files = fs.readdirSync(this.screenshotDir);
            screenshots.push(...files.filter(f => f.endsWith('.png')));
          }
        } catch (error) {
          console.warn(`Warning: Could not read screenshot directory: ${error}`);
        }

        let duration = 0;
        try {
          const output = JSON.parse(stdout);
          if (output.suites && output.suites[0]?.specs?.[0]?.tests?.[0]?.results?.[0]) {
            duration = output.suites[0].specs[0].tests[0].results[0].duration;
          }
        } catch (error) {
          // If JSON parsing fails, duration stays 0
        }

        resolve({
          testPath,
          status: 'passed',
          duration,
          screenshots
        });
      });
    });
  }
}
