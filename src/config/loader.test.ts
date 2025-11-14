// ABOUTME: Tests for configuration file loading
// ABOUTME: Validates config file discovery, loading, and merging with defaults

import { loadConfig } from './loader';
import { DEFAULT_CONFIG } from '../types/config';
import * as fs from 'fs';
import * as path from 'path';

describe('Config Loader', () => {
  const fixtureDir = path.join(__dirname, '../../test-fixtures');

  beforeAll(() => {
    // Create test fixture directory
    if (!fs.existsSync(fixtureDir)) {
      fs.mkdirSync(fixtureDir, { recursive: true });
    }

    // Create test config file
    const testConfig = `
module.exports = {
  baseBranch: 'develop',
  specsDir: './specs',
  generatedDir: './specs/generated',
  plugins: {
    targetRunner: '@test/runner',
    testGenerator: '@test/generator',
    differ: '@test/differ',
    evaluator: '@test/evaluator'
  },
  targetRunner: {
    startCommand: 'npm start',
    baseUrl: 'http://localhost:4000'
  },
  evaluator: {
    autoPassThreshold: 0.9
  }
};
    `;
    fs.writeFileSync(path.join(fixtureDir, 'visual-uat.config.js'), testConfig);
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(fixtureDir)) {
      fs.rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it('should load config from file', async () => {
    const config = await loadConfig(fixtureDir);
    expect(config.baseBranch).toBe('develop');
    expect(config.specsDir).toBe('./specs');
    expect(config.plugins.targetRunner).toBe('@test/runner');
  });

  it('should merge with defaults', async () => {
    const config = await loadConfig(fixtureDir);
    // User specified 0.9, should use that
    expect(config.evaluator.autoPassThreshold).toBe(0.9);
    // User didn't specify autoFailThreshold, should use default
    expect(config.evaluator.autoFailThreshold).toBe(0.3);
  });

  it('should throw error if config file not found', async () => {
    await expect(loadConfig('/nonexistent')).rejects.toThrow();
  });
});
