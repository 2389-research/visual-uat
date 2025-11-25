// ABOUTME: Claude LLM-based evaluator for visual diff assessment
// ABOUTME: Determines if screenshot differences match intended changes

import type { Evaluator, EvaluationInput, EvaluationResult } from '../types/plugins';
import type { EvaluatorConfig } from '../types/config';
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeEvaluator implements Evaluator {
  private client: Anthropic;
  private config: EvaluatorConfig;

  constructor(fullConfig: any) {
    // Extract evaluator config
    this.config = fullConfig.evaluator || {};

    // Anthropic SDK automatically reads from ANTHROPIC_API_KEY env var
    if (!process.env.ANTHROPIC_API_KEY) {
      console.warn('Warning: ANTHROPIC_API_KEY not set - LLM evaluation will fail');
    }

    // Don't pass apiKey - let SDK read from environment automatically
    this.client = new Anthropic();
  }

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    // Fast path: identical images
    if (input.diffResult.identical) {
      return {
        pass: true,
        confidence: 1.0,
        reason: 'Screenshots are identical - no visual changes detected',
        needsReview: false
      };
    }

    // Fast path: no changes expected but diff found
    if (this.noChangesExpected(input.intent) && !input.diffResult.identical) {
      return {
        pass: false,
        confidence: 0.9,
        reason: 'Visual changes detected but none were expected based on intent',
        needsReview: true
      };
    }

    // Call LLM for evaluation
    const result = await this.evaluateWithLLM(input);

    return result;
  }

  private async evaluateWithLLM(input: EvaluationInput): Promise<EvaluationResult> {
    const prompt = this.buildPrompt(input);

    try {
      const message = await this.client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: prompt
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: input.baselineImage.toString('base64')
              }
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: input.currentImage.toString('base64')
              }
            },
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: input.diffResult.diffImage.toString('base64')
              }
            }
          ]
        }]
      });

      // Parse LLM response
      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const parsed = this.parseResponse(responseText);

      return {
        pass: parsed.pass,
        confidence: parsed.confidence,
        reason: parsed.reason,
        needsReview: this.determineNeedsReview(parsed.confidence, parsed.pass)
      };
    } catch (error) {
      // Fallback if API fails
      return {
        pass: false,
        confidence: 0,
        reason: `LLM evaluation failed: ${error}`,
        needsReview: true
      };
    }
  }

  private buildPrompt(input: EvaluationInput): string {
    return `You are evaluating visual changes in a UI test.

**Test Intent:**
${input.intent}

**Checkpoint:** ${input.checkpoint}

**Diff Metrics:**
- Pixel difference: ${input.diffResult.pixelDiffPercent.toFixed(2)}%
- Changed regions: ${input.diffResult.changedRegions.length}

**Images Provided:**
1. **Baseline** - Screenshot from the base branch (before changes)
2. **Current** - Screenshot from the current branch (after changes)
3. **Diff visualization** - A computed diff image showing what changed:
   - **Green/cyan areas** = Content ADDED in current (not present in baseline)
   - **Magenta/pink areas** = Content REMOVED from baseline (not present in current)
   - These colors are visualization markers only, NOT actual colors in the UI

**Your Task:**
Compare the actual UI changes between baseline and current screenshots. Determine if the visual changes match the test intent. Ignore the diff visualization colors - focus on what actually changed in the UI.

Respond in this exact format:
PASS: true/false
CONFIDENCE: 0.0-1.0
REASON: <brief explanation of whether UI changes align with intent>

Be strict: only pass if changes clearly align with intent.`;
  }

  private parseResponse(response: string): { pass: boolean; confidence: number; reason: string } {
    const passMatch = response.match(/PASS:\s*(true|false)/i);
    const confMatch = response.match(/CONFIDENCE:\s*([\d.]+)/i);
    const reasonMatch = response.match(/REASON:\s*(.+?)(?=\n|$)/is);

    return {
      pass: passMatch ? passMatch[1].toLowerCase() === 'true' : false,
      confidence: confMatch ? parseFloat(confMatch[1]) : 0.5,
      reason: reasonMatch ? reasonMatch[1].trim() : 'Unable to parse evaluation'
    };
  }

  private determineNeedsReview(confidence: number, pass: boolean): boolean {
    const autoPassThreshold = this.config.autoPassThreshold || 0.95;
    const autoFailThreshold = this.config.autoFailThreshold || 0.95;

    // High confidence in pass → auto-pass (no review)
    if (pass && confidence >= autoPassThreshold) return false;

    // High confidence in fail → auto-fail (no review)
    if (!pass && confidence >= autoFailThreshold) return false;

    // Low/medium confidence → needs manual review
    return true;
  }

  private noChangesExpected(intent: string): boolean {
    const noChangeKeywords = ['no change', 'unchanged', 'same as', 'identical'];
    const lowerIntent = intent.toLowerCase();
    return noChangeKeywords.some(keyword => lowerIntent.includes(keyword));
  }
}
