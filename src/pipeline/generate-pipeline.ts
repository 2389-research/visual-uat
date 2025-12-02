// ABOUTME: Test generation pipeline orchestrating story → BDD → test flow
// ABOUTME: Handles caching via manifest to skip unchanged stories

import * as fs from 'fs';
import * as path from 'path';
import { StoryLoader } from '../stories/loader';
import { StoryToBDDTranslator } from '../translators/story-to-bdd';
import { BDDWriter } from '../translators/bdd-writer';
import { SpecManifest } from '../specs/manifest';
import { PlaywrightRunner } from '../runners/playwright-runner';
import { Story, BDDSpec, TestRunnerPlugin } from '../types/plugins';

export interface GenerateOptions {
  storiesDir: string;
  runner: string;
  force?: boolean;
}

export interface RunOptions {
  onProgress?: (storyPath: string, status: 'skipped' | 'generating') => void;
}

export interface GenerateResult {
  generated: number;
  skipped: number;
  errors: Array<{ story: string; error: string }>;
}

export class GeneratePipeline {
  private projectDir: string;
  private options: GenerateOptions;
  private storyLoader: StoryLoader;
  private translator: StoryToBDDTranslator;
  private bddWriter: BDDWriter;
  private manifest: SpecManifest;
  private runner: TestRunnerPlugin;

  constructor(projectDir: string, options: GenerateOptions) {
    this.projectDir = projectDir;
    this.options = options;

    const storiesPath = path.join(projectDir, options.storiesDir);
    const specsPath = path.join(projectDir, '.visual-uat', 'specs');
    const generatedPath = path.join(projectDir, '.visual-uat', 'generated');

    this.storyLoader = new StoryLoader(storiesPath);
    this.translator = new StoryToBDDTranslator();
    this.bddWriter = new BDDWriter(specsPath);
    this.manifest = new SpecManifest(projectDir);

    // For now, only Playwright is supported
    this.runner = new PlaywrightRunner();
  }

  async run(runOptions?: RunOptions): Promise<GenerateResult> {
    const result: GenerateResult = { generated: 0, skipped: 0, errors: [] };

    const stories = this.storyLoader.loadStories();
    const changes = this.manifest.detectStoryChanges(
      stories.map(s => ({ path: s.path, contentHash: s.contentHash }))
    );

    const toGenerate = this.options.force
      ? stories
      : stories.filter(s =>
          changes.new.includes(s.path) || changes.modified.includes(s.path)
        );

    for (const story of stories) {
      if (!toGenerate.includes(story)) {
        result.skipped++;
        runOptions?.onProgress?.(story.path, 'skipped');
        continue;
      }

      try {
        runOptions?.onProgress?.(story.path, 'generating');
        await this.processStory(story);
        result.generated++;
      } catch (error) {
        result.errors.push({
          story: story.path,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    this.manifest.save();
    return result;
  }

  private async processStory(story: Story): Promise<void> {
    // Stage 1: Story → BDD
    const bddSpec = await this.translator.translate(story);
    const specPath = this.bddWriter.write(bddSpec);

    // Stage 2: BDD → Test
    const testCode = await this.runner.generate(bddSpec);
    const testPath = this.writeTest(bddSpec, testCode);

    // Update manifest
    const specHash = this.computeHash(fs.readFileSync(specPath, 'utf-8'));
    this.manifest.trackStory(story.path, {
      contentHash: story.contentHash,
      specPath,
      specHash
    });
  }

  private writeTest(spec: BDDSpec, code: string): string {
    const generatedDir = path.join(this.projectDir, '.visual-uat', 'generated');
    fs.mkdirSync(generatedDir, { recursive: true });

    const testPath = path.join(
      generatedDir,
      path.basename(spec.path).replace('.spec.md', this.runner.fileExtension)
    );

    fs.writeFileSync(testPath, code);
    return testPath;
  }

  private computeHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
