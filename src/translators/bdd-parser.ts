// ABOUTME: BDD spec parser for reading Gherkin-format markdown
// ABOUTME: Parses BDD spec files back into BDDSpec objects for test generation

import { BDDSpec, BDDScenario, BDDStep, BDDStepType, Checkpoint } from '../types/plugins';

export class BDDParser {
  parse(content: string, specPath: string): BDDSpec {
    const metadata = this.parseMetadata(content);
    const feature = this.parseFeature(content);
    const scenarios = this.parseScenarios(content);

    return {
      path: specPath,
      sourceStory: metadata.story,
      storyHash: metadata.storyHash,
      generatedAt: metadata.generated,
      feature,
      scenarios
    };
  }

  private parseMetadata(content: string): { story: string; storyHash: string; generated: string } {
    const storyMatch = content.match(/- story:\s*(.+)/);
    const hashMatch = content.match(/- story_hash:\s*(.+)/);
    const generatedMatch = content.match(/- generated:\s*(.+)/);

    return {
      story: storyMatch?.[1]?.trim() || '',
      storyHash: hashMatch?.[1]?.trim() || '',
      generated: generatedMatch?.[1]?.trim() || ''
    };
  }

  private parseFeature(content: string): string {
    const match = content.match(/## Feature:\s*(.+)/);
    return match?.[1]?.trim() || 'Unknown Feature';
  }

  private parseScenarios(content: string): BDDScenario[] {
    const scenarios: BDDScenario[] = [];
    const scenarioBlocks = content.split(/(?=Scenario:)/);

    for (const block of scenarioBlocks) {
      if (!block.startsWith('Scenario:')) continue;

      const scenario = this.parseScenarioBlock(block);
      if (scenario) scenarios.push(scenario);
    }

    return scenarios;
  }

  private parseScenarioBlock(block: string): BDDScenario | null {
    const nameMatch = block.match(/Scenario:\s*(.+)/);
    if (!nameMatch) return null;

    const steps = this.parseSteps(block);
    const checkpoints = this.parseCheckpoints(block);

    return {
      name: nameMatch[1].trim(),
      steps,
      checkpoints
    };
  }

  private parseSteps(block: string): BDDStep[] {
    const steps: BDDStep[] = [];
    const stepRegex = /^\s*(Given|When|Then|And|But)\s+(.+)$/gm;

    let match;
    while ((match = stepRegex.exec(block)) !== null) {
      steps.push({
        type: match[1].toLowerCase() as BDDStepType,
        text: match[2].trim()
      });
    }

    return steps;
  }

  private parseCheckpoints(block: string): Checkpoint[] {
    const checkpoints: Checkpoint[] = [];
    const checkpointRegex = /Checkpoint:\s*([a-z0-9-]+)([\s\S]*?)(?=Checkpoint:|Scenario:|$)/gi;

    let match;
    while ((match = checkpointRegex.exec(block)) !== null) {
      const name = match[1];
      const details = match[2];

      const captureMatch = details.match(/- capture:\s*(\S+)/);
      const focusMatch = details.match(/- focus:\s*(\[.+\])/);
      const selectorMatch = details.match(/- selector:\s*(.+)/);

      let focus: string[] | undefined;
      if (focusMatch) {
        try {
          const parsed = JSON.parse(focusMatch[1]);
          if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
            focus = parsed;
          }
        } catch {
          focus = undefined;
        }
      }
      const captureValue = captureMatch?.[1];
      const validCapture: 'full-page' | 'viewport' | 'element' =
        (captureValue === 'full-page' || captureValue === 'viewport' || captureValue === 'element')
          ? captureValue
          : 'full-page';
      checkpoints.push({
        name,
        capture: validCapture,
        focus,
        selector: selectorMatch?.[1]?.trim()
      });
    }

    return checkpoints;
  }
}
