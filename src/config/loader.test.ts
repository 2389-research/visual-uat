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

  it('should default storiesDir to ./tests/stories when not specified', async () => {
    const config = await loadConfig(fixtureDir);
    // storiesDir should always be set, defaulting to ./tests/stories
    expect(config.storiesDir).toBe('./tests/stories');
  });

  it('should default runner to playwright when not specified', async () => {
    const config = await loadConfig(fixtureDir);
    // runner should always be set, defaulting to playwright
    expect(config.runner).toBe('playwright');
  });

  it('should throw error if config file not found', async () => {
    await expect(loadConfig('/nonexistent')).rejects.toThrow();
  });

  describe('Config Validation', () => {
    it('should use default plugins if not specified', async () => {
      const testDir = path.join(__dirname, '../../test-fixtures-no-plugins');
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testDir, { recursive: true });

      const configWithoutPlugins = `
module.exports = {
  baseBranch: 'main',
  specsDir: './tests',
  generatedDir: './tests/generated'
};
      `;
      fs.writeFileSync(path.join(testDir, 'visual-uat.config.js'), configWithoutPlugins);

      const config = await loadConfig(testDir);
      expect(config.plugins.differ).toBe('@visual-uat/quadtree-differ');
      expect(config.plugins.evaluator).toBe('@visual-uat/claude-evaluator');

      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should merge user plugins with defaults', async () => {
      const testDir = path.join(__dirname, '../../test-fixtures-incomplete-plugins');
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testDir, { recursive: true });

      const configWithIncompletePlugins = `
module.exports = {
  baseBranch: 'main',
  specsDir: './tests',
  generatedDir: './tests/generated',
  plugins: {
    targetRunner: '@test/runner'
    // Missing testGenerator, differ, evaluator - will use defaults
  }
};
      `;
      fs.writeFileSync(path.join(testDir, 'visual-uat.config.js'), configWithIncompletePlugins);

      const config = await loadConfig(testDir);
      expect(config.plugins.targetRunner).toBe('@test/runner');
      expect(config.plugins.differ).toBe('@visual-uat/quadtree-differ');

      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should throw error if autoPassThreshold is not between 0 and 1', async () => {
      const testDir = path.join(__dirname, '../../test-fixtures-invalid-pass-threshold');
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testDir, { recursive: true });

      const configWithInvalidThreshold = `
module.exports = {
  baseBranch: 'main',
  specsDir: './tests',
  generatedDir: './tests/generated',
  plugins: {
    targetRunner: '@test/runner',
    testGenerator: '@test/generator',
    differ: '@test/differ',
    evaluator: '@test/evaluator'
  },
  evaluator: {
    autoPassThreshold: 1.5
  }
};
      `;
      fs.writeFileSync(path.join(testDir, 'visual-uat.config.js'), configWithInvalidThreshold);

      await expect(loadConfig(testDir)).rejects.toThrow('autoPassThreshold');

      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should throw error if autoFailThreshold is not between 0 and 1', async () => {
      const testDir = path.join(__dirname, '../../test-fixtures-invalid-fail-threshold');
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testDir, { recursive: true });

      const configWithInvalidThreshold = `
module.exports = {
  baseBranch: 'main',
  specsDir: './tests',
  generatedDir: './tests/generated',
  plugins: {
    targetRunner: '@test/runner',
    testGenerator: '@test/generator',
    differ: '@test/differ',
    evaluator: '@test/evaluator'
  },
  evaluator: {
    autoFailThreshold: -0.1
  }
};
      `;
      fs.writeFileSync(path.join(testDir, 'visual-uat.config.js'), configWithInvalidThreshold);

      await expect(loadConfig(testDir)).rejects.toThrow('autoFailThreshold');

      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });

    it('should throw error if autoPassThreshold is not greater than autoFailThreshold', async () => {
      const testDir = path.join(__dirname, '../../test-fixtures-invalid-threshold-relationship');
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
      fs.mkdirSync(testDir, { recursive: true });

      const configWithInvalidRelationship = `
module.exports = {
  baseBranch: 'main',
  specsDir: './tests',
  generatedDir: './tests/generated',
  plugins: {
    targetRunner: '@test/runner',
    testGenerator: '@test/generator',
    differ: '@test/differ',
    evaluator: '@test/evaluator'
  },
  evaluator: {
    autoPassThreshold: 0.3,
    autoFailThreshold: 0.9
  }
};
      `;
      fs.writeFileSync(path.join(testDir, 'visual-uat.config.js'), configWithInvalidRelationship);

      await expect(loadConfig(testDir)).rejects.toThrow('autoPassThreshold must be greater than autoFailThreshold');

      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });
  });
});
