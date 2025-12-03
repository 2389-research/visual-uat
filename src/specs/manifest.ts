// ABOUTME: Spec file manifest for tracking changes via content hashing
// ABOUTME: Detects new, modified, and deleted test specification files

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface ManifestEntry {
  hash: string;
  generatedPath: string;
  lastModified: number;
}

export interface SpecChanges {
  new: string[];
  modified: string[];
  deleted: string[];
}

export interface StoryManifestEntry {
  contentHash: string;
  specPath: string;
  specHash: string;
}

export interface StoryChanges {
  new: string[];
  modified: string[];
  deleted: string[];
}

export class SpecManifest {
  private manifestPath: string;
  private entries: Map<string, ManifestEntry>;
  private storyEntries: Map<string, StoryManifestEntry> = new Map();

  constructor(projectDir: string) {
    const visualUatDir = path.join(projectDir, '.visual-uat');
    if (!fs.existsSync(visualUatDir)) {
      fs.mkdirSync(visualUatDir, { recursive: true });
    }

    this.manifestPath = path.join(visualUatDir, 'manifest.json');
    this.entries = new Map();

    if (fs.existsSync(this.manifestPath)) {
      const data = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
      if (data.specs) {
        Object.entries(data.specs).forEach(([path, entry]) => {
          this.entries.set(path, entry as ManifestEntry);
        });
      } else {
        // Legacy format: data is directly the specs map
        Object.entries(data).forEach(([path, entry]) => {
          // Check if this is a story entry or spec entry
          if ('contentHash' in (entry as any) && 'specPath' in (entry as any)) {
            // Skip - this is actually a story entry in the old location
          } else {
            this.entries.set(path, entry as ManifestEntry);
          }
        });
      }
      if (data.stories) {
        Object.entries(data.stories).forEach(([path, entry]) => {
          this.storyEntries.set(path, entry as StoryManifestEntry);
        });
      }
    }
  }

  private hashFile(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  detectChanges(currentSpecPaths: string[]): SpecChanges {
    const changes: SpecChanges = {
      new: [],
      modified: [],
      deleted: []
    };

    const currentPathSet = new Set(currentSpecPaths);

    // Check for new and modified
    for (const specPath of currentSpecPaths) {
      const currentHash = this.hashFile(specPath);
      const entry = this.entries.get(specPath);

      if (!entry) {
        changes.new.push(specPath);
      } else if (entry.hash !== currentHash) {
        changes.modified.push(specPath);
      }
    }

    // Check for deleted
    for (const [specPath] of this.entries) {
      if (!currentPathSet.has(specPath)) {
        changes.deleted.push(specPath);
      }
    }

    return changes;
  }

  updateSpec(specPath: string, generatedPath: string): void {
    const hash = this.hashFile(specPath);
    const stats = fs.statSync(specPath);

    this.entries.set(specPath, {
      hash,
      generatedPath,
      lastModified: stats.mtimeMs
    });
  }

  removeSpec(specPath: string): void {
    this.entries.delete(specPath);
  }

  getGeneratedPath(specPath: string): string | undefined {
    return this.entries.get(specPath)?.generatedPath;
  }

  trackStory(storyPath: string, entry: StoryManifestEntry): void {
    this.storyEntries.set(storyPath, entry);
  }

  getStoryEntry(storyPath: string): StoryManifestEntry | undefined {
    return this.storyEntries.get(storyPath);
  }

  detectStoryChanges(currentStories: Array<{ path: string; contentHash: string }>): StoryChanges {
    const changes: StoryChanges = { new: [], modified: [], deleted: [] };
    const currentPathSet = new Set(currentStories.map(s => s.path));

    for (const story of currentStories) {
      const entry = this.storyEntries.get(story.path);
      if (!entry) {
        changes.new.push(story.path);
      } else if (entry.contentHash !== story.contentHash) {
        changes.modified.push(story.path);
      }
    }

    for (const [storyPath] of this.storyEntries) {
      if (!currentPathSet.has(storyPath)) {
        changes.deleted.push(storyPath);
      }
    }

    return changes;
  }

  save(): void {
    const data = {
      specs: Object.fromEntries(this.entries),
      stories: Object.fromEntries(this.storyEntries)
    };
    fs.writeFileSync(this.manifestPath, JSON.stringify(data, null, 2));
  }
}
