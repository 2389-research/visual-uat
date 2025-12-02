// ABOUTME: Story loader service for natural language test definitions
// ABOUTME: Loads .story.md files and computes content hashes for change detection

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { Story } from '../types/plugins';

export class StoryLoader {
  private storiesDir: string;

  constructor(storiesDir: string) {
    this.storiesDir = storiesDir;
  }

  loadStories(): Story[] {
    if (!fs.existsSync(this.storiesDir)) {
      return [];
    }

    const files = fs.readdirSync(this.storiesDir);
    const storyFiles = files.filter(f => f.endsWith('.story.md'));

    return storyFiles.map(file => {
      const filePath = path.join(this.storiesDir, file);
      return this.loadStory(filePath);
    });
  }

  loadStory(storyPath: string): Story {
    const content = fs.readFileSync(storyPath, 'utf-8');
    const title = this.extractTitle(content);
    const contentHash = this.computeHash(content);

    return {
      path: storyPath,
      content,
      title,
      contentHash
    };
  }

  private extractTitle(content: string): string {
    const match = content.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : 'Untitled Story';
  }

  private computeHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
