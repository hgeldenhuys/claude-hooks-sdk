/**
 * AI summarization transform
 *
 * Uses Claude Haiku to generate summaries of Stop events.
 * Provides concise summaries of what the AI accomplished in each turn.
 */

import type { StopInput } from '../types';

export interface SummaryEvent {
  summary: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  timestamp: string;
  session_id: string;
  turn_number?: number;
}

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeAPIResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{ type: string; text: string }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * AI Summarizer - Uses Claude Haiku to summarize Stop events
 *
 * Usage:
 * ```typescript
 * const summarizer = new AISummarizer({
 *   apiKey: process.env.ANTHROPIC_API_KEY!,
 *   model: 'claude-haiku-3-5-20241022'
 * });
 *
 * manager.onStop(async (input, context) => {
 *   const summary = await summarizer.summarizeStop(input, context);
 *   if (summary) {
 *     console.log(JSON.stringify(summary, null, 2));
 *   }
 *   return success();
 * });
 * ```
 */
export class AISummarizer {
  private apiKey: string;
  private model: string;
  private apiUrl: string;
  private turnNumber: number = 0;

  constructor(options: { apiKey: string; model?: string; apiUrl?: string }) {
    this.apiKey = options.apiKey;
    this.model = options.model || 'claude-haiku-3-5-20241022';
    this.apiUrl = options.apiUrl || 'https://api.anthropic.com/v1/messages';
  }

  /**
   * Summarize a Stop event using Claude Haiku
   */
  async summarizeStop(
    input: StopInput,
    context: { getLastTranscriptLine?: () => Promise<any> }
  ): Promise<SummaryEvent | null> {
    this.turnNumber++;

    // Get last assistant message from transcript
    let assistantContent: string | null = null;
    if (context.getLastTranscriptLine) {
      try {
        const lastLine = await context.getLastTranscriptLine();
        assistantContent = this.extractAssistantContent(lastLine);
      } catch (error) {
        return null;
      }
    }

    if (!assistantContent) {
      return null;
    }

    // Call Claude API for summary
    try {
      const response = await this.callClaudeAPI([
        {
          role: 'user',
          content: this.buildSummaryPrompt(assistantContent),
        },
      ]);

      const summary = response.content[0]?.text || 'No summary generated';

      return {
        summary,
        model: response.model,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        timestamp: new Date().toISOString(),
        session_id: input.session_id,
        turn_number: this.turnNumber,
      };
    } catch (error) {
      console.error('[AISummarizer] Error calling Claude API:', error);
      return null;
    }
  }

  /**
   * Summarize with custom prompt
   */
  async summarizeWithPrompt(
    content: string,
    prompt: string,
    sessionId: string
  ): Promise<SummaryEvent | null> {
    try {
      const response = await this.callClaudeAPI([
        {
          role: 'user',
          content: prompt.replace('{content}', content),
        },
      ]);

      const summary = response.content[0]?.text || 'No summary generated';

      return {
        summary,
        model: response.model,
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        timestamp: new Date().toISOString(),
        session_id: sessionId,
      };
    } catch (error) {
      console.error('[AISummarizer] Error calling Claude API:', error);
      return null;
    }
  }

  /**
   * Call Claude Messages API
   */
  private async callClaudeAPI(messages: ClaudeMessage[]): Promise<ClaudeAPIResponse> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} ${error}`);
    }

    return (await response.json()) as ClaudeAPIResponse;
  }

  /**
   * Build summary prompt
   */
  private buildSummaryPrompt(content: string): string {
    return `Summarize the following AI assistant response in ONE concise sentence (max 20 words). Focus on the main action or outcome, not the details.

Response to summarize:
${content}

One-sentence summary:`;
  }

  /**
   * Extract assistant content from transcript line
   */
  private extractAssistantContent(transcriptLine: any): string | null {
    if (!transcriptLine?.message?.content) {
      return null;
    }

    const content = transcriptLine.message.content;

    // Handle array of content blocks
    if (Array.isArray(content)) {
      return content
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');
    }

    // Handle string content
    if (typeof content === 'string') {
      return content;
    }

    return null;
  }

  /**
   * Reset turn counter
   */
  reset(): void {
    this.turnNumber = 0;
  }

  /**
   * Get current turn number
   */
  getTurnNumber(): number {
    return this.turnNumber;
  }
}

/**
 * Simple function to call Claude API for summarization (stateless)
 *
 * Usage:
 * ```typescript
 * manager.onStop(async (input, context) => {
 *   const summary = await summarizeWithClaude({
 *     apiKey: process.env.ANTHROPIC_API_KEY!,
 *     content: assistantContent,
 *     sessionId: input.session_id
 *   });
 *   console.log(summary);
 *   return success();
 * });
 * ```
 */
export async function summarizeWithClaude(options: {
  apiKey: string;
  content: string;
  sessionId: string;
  model?: string;
}): Promise<SummaryEvent | null> {
  const { apiKey, content, sessionId, model = 'claude-haiku-3-5-20241022' } = options;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: `Summarize this AI response in ONE sentence (max 20 words): ${content}`,
          },
        ],
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as ClaudeAPIResponse;
    const summary = data.content[0]?.text || 'No summary generated';

    return {
      summary,
      model: data.model,
      input_tokens: data.usage.input_tokens,
      output_tokens: data.usage.output_tokens,
      timestamp: new Date().toISOString(),
      session_id: sessionId,
    };
  } catch (error) {
    console.error('[summarizeWithClaude] Error:', error);
    return null;
  }
}
