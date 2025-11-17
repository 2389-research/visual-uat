// ABOUTME: Persists test artifacts (screenshots, diffs) and results to .visual-uat/ directory.
// ABOUTME: Handles JSON serialization and directory structure management.

import * as fs from 'fs';
import * as path from 'path';
import { RunResult } from '../types/results';

export class ResultStore {
  private visualUatDir: string;

  constructor(private projectRoot: string) {
    this.visualUatDir = path.join(projectRoot, '.visual-uat');
  }

  async saveRunResult(result: RunResult): Promise<string> {
    const resultsDir = path.join(this.visualUatDir, 'results');

    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `run-${result.timestamp}.json`;
    const filePath = path.join(resultsDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(result, null, 2));

    return filePath;
  }

  async loadLatestResult(): Promise<RunResult | null> {
    const resultsDir = path.join(this.visualUatDir, 'results');

    if (!fs.existsSync(resultsDir)) {
      return null;
    }

    const files = fs.readdirSync(resultsDir)
      .filter(f => f.startsWith('run-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) {
      return null;
    }

    const latestFile = path.join(resultsDir, files[0]);
    const content = fs.readFileSync(latestFile, 'utf-8');
    return JSON.parse(content);
  }

  async loadResult(timestamp: number): Promise<RunResult | null> {
    const filePath = path.join(this.visualUatDir, 'results', `run-${timestamp}.json`);

    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  ensureDirectories(): void {
    const dirs = [
      path.join(this.visualUatDir, 'screenshots', 'base'),
      path.join(this.visualUatDir, 'screenshots', 'current'),
      path.join(this.visualUatDir, 'diffs'),
      path.join(this.visualUatDir, 'results')
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  getScreenshotPath(branch: 'base' | 'current', testName: string, checkpoint: string): string {
    return path.join(
      this.visualUatDir,
      'screenshots',
      branch,
      testName,
      `${checkpoint}.png`
    );
  }

  getDiffPath(testName: string, checkpoint: string): string {
    return path.join(
      this.visualUatDir,
      'diffs',
      testName,
      `${checkpoint}.png`
    );
  }
}
