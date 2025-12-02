// ABOUTME: Story-to-BDD translator using LLM for natural language processing
// ABOUTME: Converts user stories to structured Gherkin-style BDD specifications

import Anthropic from '@anthropic-ai/sdk';
import { Story, BDDSpec, BDDScenario } from '../types/plugins';

export class StoryToBDDTranslator {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic();
  }

  async translate(story: Story): Promise<BDDSpec> {
    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: this.buildPrompt(story)
      }]
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from LLM');
    }

    const parsed = JSON.parse(content.text);

    return {
      path: this.generateSpecPath(story.path),
      sourceStory: story.path,
      storyHash: story.contentHash,
      generatedAt: new Date().toISOString(),
      feature: parsed.feature,
      scenarios: parsed.scenarios as BDDScenario[]
    };
  }

  private buildPrompt(story: Story): string {
    return `Convert this natural language test story into a structured BDD specification.

## Story
${story.content}

## Output Format
Return ONLY valid JSON with this structure:
{
  "feature": "Feature name",
  "scenarios": [
    {
      "name": "Scenario name",
      "steps": [
        { "type": "given", "text": "I am on the page" },
        { "type": "when", "text": "I click something" },
        { "type": "then", "text": "I should see something" }
      ],
      "checkpoints": [
        { "name": "checkpoint-name", "capture": "full-page", "focus": [".selector"] }
      ]
    }
  ]
}

Rules:
- Extract meaningful scenarios from the story
- Use given/when/then/and/but step types
- Create checkpoints for visual verification points mentioned
- Infer CSS selectors where possible, use descriptive placeholders if not
- capture must be: "full-page", "viewport", or "element"
- Return ONLY the JSON, no markdown fences or explanation`;
  }

  private generateSpecPath(storyPath: string): string {
    const basename = storyPath.replace(/.*\//, '').replace('.story.md', '.spec.md');
    return `.visual-uat/specs/${basename}`;
  }
}
