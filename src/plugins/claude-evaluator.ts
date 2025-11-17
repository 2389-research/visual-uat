// ABOUTME: Claude LLM-based evaluator for visual diff assessment
// ABOUTME: Determines if screenshot differences match intended changes

import type { Evaluator, EvaluationInput, EvaluationResult } from '../types/plugins';
import type { EvaluatorConfig } from '../types/config';
import Anthropic from '@anthropic-ai/sdk';

export class ClaudeEvaluator implements Evaluator {
  private client: Anthropic;
  private config: EvaluatorConfig;

  constructor(apiKey: string, config: EvaluatorConfig) {
    this.client = new Anthropic({ apiKey });
    this.config = config;
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
        model: 'claude-3-5-sonnet-20241022',
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

**Your Task:**
Compare the baseline (image 1), current (image 2), and diff (image 3) screenshots. Determine if the visual changes match the test intent.

Respond in this exact format:
PASS: true/false
CONFIDENCE: 0.0-1.0
REASON: <brief explanation>

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
    const autoFailThreshold = this.config.autoFailThreshold || 0.3;

    if (pass && confidence >= autoPassThreshold) return false;
    if (!pass && confidence <= autoFailThreshold) return false;

    return true; // Between thresholds - needs manual review
  }

  private noChangesExpected(intent: string): boolean {
    const noChangeKeywords = ['no change', 'unchanged', 'same as', 'identical'];
    const lowerIntent = intent.toLowerCase();
    return noChangeKeywords.some(keyword => lowerIntent.includes(keyword));
  }
}
