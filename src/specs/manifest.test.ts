// ABOUTME: Tests for spec file manifest management
// ABOUTME: Validates hash tracking and change detection for test specifications

import { SpecManifest } from './manifest';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

describe('SpecManifest', () => {
  const testDir = path.join(__dirname, '../../test-fixtures/manifest-test');
  const manifestPath = path.join(testDir, '.visual-uat', 'manifest.json');

  beforeEach(() => {
    // Clean test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should create new manifest if none exists', () => {
    const manifest = new SpecManifest(testDir);
    expect(manifest).toBeDefined();
  });

  it('should detect new spec file', () => {
    const specPath = path.join(testDir, 'test.md');
    fs.writeFileSync(specPath, 'test content');

    const manifest = new SpecManifest(testDir);
    const changes = manifest.detectChanges([specPath]);

    expect(changes.new).toContain(specPath);
    expect(changes.modified).toHaveLength(0);
    expect(changes.deleted).toHaveLength(0);
  });

  it('should detect modified spec file', () => {
    const specPath = path.join(testDir, 'test.md');
    fs.writeFileSync(specPath, 'original content');

    const manifest = new SpecManifest(testDir);
    manifest.detectChanges([specPath]);
    manifest.updateSpec(specPath, 'generated/test.spec.ts');
    manifest.save();

    // Modify file
    fs.writeFileSync(specPath, 'modified content');

    const changes = manifest.detectChanges([specPath]);
    expect(changes.modified).toContain(specPath);
    expect(changes.new).toHaveLength(0);
  });

  it('should detect deleted spec file', () => {
    const specPath = path.join(testDir, 'test.md');
    fs.writeFileSync(specPath, 'test content');

    const manifest = new SpecManifest(testDir);
    manifest.detectChanges([specPath]);
    manifest.updateSpec(specPath, 'generated/test.spec.ts');
    manifest.save();

    // Delete file
    fs.unlinkSync(specPath);

    const changes = manifest.detectChanges([]);
    expect(changes.deleted).toContain(specPath);
  });

  it('should update manifest after changes', () => {
    const specPath = path.join(testDir, 'test.md');
    fs.writeFileSync(specPath, 'test content');

    const manifest = new SpecManifest(testDir);
    const changes = manifest.detectChanges([specPath]);
    manifest.updateSpec(specPath, 'generated/test.spec.ts');
    manifest.save();

    // Load again and verify no changes
    const manifest2 = new SpecManifest(testDir);
    const changes2 = manifest2.detectChanges([specPath]);
    expect(changes2.new).toHaveLength(0);
    expect(changes2.modified).toHaveLength(0);
  });
});

describe('StoryManifest', () => {
  const testDir = path.join(__dirname, '../../test-fixtures/story-manifest-test');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('trackStory', () => {
    it('should track story hash and generated spec path', () => {
      const manifest = new SpecManifest(testDir);

      manifest.trackStory('tests/stories/cart.story.md', {
        contentHash: 'abc123',
        specPath: '.visual-uat/specs/cart.spec.md',
        specHash: 'def456'
      });

      const entry = manifest.getStoryEntry('tests/stories/cart.story.md');
      expect(entry?.contentHash).toBe('abc123');
      expect(entry?.specPath).toBe('.visual-uat/specs/cart.spec.md');
      expect(entry?.specHash).toBe('def456');
    });
  });

  describe('detectStoryChanges', () => {
    it('should detect new stories', () => {
      const manifest = new SpecManifest(testDir);

      const changes = manifest.detectStoryChanges([
        { path: 'tests/stories/new.story.md', contentHash: 'xyz789' }
      ]);

      expect(changes.new).toContain('tests/stories/new.story.md');
    });

    it('should detect modified stories', () => {
      const manifest = new SpecManifest(testDir);
      manifest.trackStory('tests/stories/cart.story.md', {
        contentHash: 'old-hash',
        specPath: '.visual-uat/specs/cart.spec.md',
        specHash: 'spec-hash'
      });
      manifest.save();

      const manifest2 = new SpecManifest(testDir);
      const changes = manifest2.detectStoryChanges([
        { path: 'tests/stories/cart.story.md', contentHash: 'new-hash' }
      ]);

      expect(changes.modified).toContain('tests/stories/cart.story.md');
    });
  });
});
