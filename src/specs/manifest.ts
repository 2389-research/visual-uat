// ABOUTME: Spec file manifest for tracking changes via content hashing
// ABOUTME: Detects new, modified, and deleted test specification files

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

interface ManifestEntry {
  hash: string;
  generatedPath: string;
  lastModified: number;
}

interface SpecChanges {
  new: string[];
  modified: string[];
  deleted: string[];
}

export class SpecManifest {
  private manifestPath: string;
  private entries: Map<string, ManifestEntry>;

  constructor(projectDir: string) {
    const visualUatDir = path.join(projectDir, '.visual-uat');
    if (!fs.existsSync(visualUatDir)) {
      fs.mkdirSync(visualUatDir, { recursive: true });
    }

    this.manifestPath = path.join(visualUatDir, 'manifest.json');
    this.entries = new Map();

    if (fs.existsSync(this.manifestPath)) {
      const data = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
      Object.entries(data).forEach(([path, entry]) => {
        this.entries.set(path, entry as ManifestEntry);
      });
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

  save(): void {
    const data = Object.fromEntries(this.entries);
    fs.writeFileSync(this.manifestPath, JSON.stringify(data, null, 2));
  }
}
