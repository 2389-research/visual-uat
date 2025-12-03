// ABOUTME: BDD spec writer for serializing specs to markdown
// ABOUTME: Writes Gherkin-format markdown files with metadata

import * as fs from 'fs';
import * as path from 'path';
import { BDDSpec, BDDScenario, BDDStep, Checkpoint } from '../types/plugins';

export class BDDWriter {
  private outputDir: string;

  constructor(outputDir: string) {
    this.outputDir = outputDir;
  }

  write(spec: BDDSpec): string {
    const content = this.serialize(spec);
    const outputPath = path.join(this.outputDir, path.basename(spec.path));

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, content);

    return outputPath;
  }

  private serialize(spec: BDDSpec): string {
    const lines: string[] = [];

    lines.push(`# ${spec.feature}`);
    lines.push('');
    lines.push('## Metadata');
    lines.push(`- story: ${spec.sourceStory}`);
    lines.push(`- story_hash: ${spec.storyHash}`);
    lines.push(`- generated: ${spec.generatedAt}`);
    lines.push('');
    lines.push(`## Feature: ${spec.feature}`);
    lines.push('');

    for (const scenario of spec.scenarios) {
      lines.push(...this.serializeScenario(scenario));
      lines.push('');
    }

    return lines.join('\n');
  }

  private serializeScenario(scenario: BDDScenario): string[] {
    const lines: string[] = [];

    lines.push(`Scenario: ${scenario.name}`);

    for (const step of scenario.steps) {
      const prefix = step.type.charAt(0).toUpperCase() + step.type.slice(1);
      lines.push(`  ${prefix} ${step.text}`);
    }

    for (const checkpoint of scenario.checkpoints) {
      lines.push('');
      lines.push(`  Checkpoint: ${checkpoint.name}`);
      lines.push(`    - capture: ${checkpoint.capture}`);
      if (checkpoint.focus && checkpoint.focus.length > 0) {
        lines.push(`    - focus: ${JSON.stringify(checkpoint.focus)}`);
      }
      if (checkpoint.selector) {
        lines.push(`    - selector: ${checkpoint.selector}`);
      }
    }

    return lines;
  }
}
