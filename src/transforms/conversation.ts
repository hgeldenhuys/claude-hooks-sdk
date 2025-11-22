/**
 * Conversation-style logging transform
 *
 * Tracks user prompts between Stop events and logs them as conversation turns.
 * This creates a chat-like log format showing the assistant's response and
 * all user messages that occurred before the next response.
 */

import type { StopInput, UserPromptSubmitInput } from '../types';

export interface ConversationTurn {
  assistant: {
    content: string | null;
    timestamp: string;
    toolsUsed: string[];
  };
  user_prompts: Array<{
    text: string;
    timestamp: string;
  }>;
  turn_number: number;
  session_id: string;
}

/**
 * Conversation Logger - Stateful transformer for chat-style logging
 *
 * Usage:
 * ```typescript
 * const conversationLogger = new ConversationLogger();
 *
 * manager
 *   .onUserPromptSubmit((input) => {
 *     conversationLogger.recordUserPrompt(input);
 *     return success();
 *   })
 *   .onStop(async (input, context) => {
 *     const turn = await conversationLogger.recordStop(input, context);
 *     console.log(JSON.stringify(turn, null, 2));
 *     return success();
 *   });
 * ```
 */
export class ConversationLogger {
  private userPrompts: Array<{ text: string; timestamp: string }> = [];
  private turnNumber = 0;
  private toolsUsedInTurn: Set<string> = new Set();

  /**
   * Record a user prompt (call from UserPromptSubmit hook)
   */
  recordUserPrompt(input: UserPromptSubmitInput): void {
    const promptText = (input as any).prompt_text || (input as any).user_prompt || '';

    this.userPrompts.push({
      text: promptText,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Record a tool use (call from PreToolUse hook)
   */
  recordToolUse(toolName: string): void {
    this.toolsUsedInTurn.add(toolName);
  }

  /**
   * Record a Stop event and create conversation turn
   * Returns the conversation turn object
   */
  async recordStop(
    input: StopInput,
    context: { getLastTranscriptLine?: () => Promise<any> }
  ): Promise<ConversationTurn> {
    this.turnNumber++;

    // Get last assistant message from transcript
    let assistantContent: string | null = null;
    if (context.getLastTranscriptLine) {
      try {
        const lastLine = await context.getLastTranscriptLine();
        assistantContent = this.extractAssistantContent(lastLine);
      } catch (error) {
        // Transcript not available
      }
    }

    const turn: ConversationTurn = {
      assistant: {
        content: assistantContent,
        timestamp: new Date().toISOString(),
        toolsUsed: Array.from(this.toolsUsedInTurn),
      },
      user_prompts: [...this.userPrompts],
      turn_number: this.turnNumber,
      session_id: input.session_id,
    };

    // Clear state for next turn
    this.userPrompts = [];
    this.toolsUsedInTurn.clear();

    return turn;
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
   * Get current turn number
   */
  getTurnNumber(): number {
    return this.turnNumber;
  }

  /**
   * Reset state (useful for new sessions)
   */
  reset(): void {
    this.userPrompts = [];
    this.turnNumber = 0;
    this.toolsUsedInTurn.clear();
  }
}

/**
 * Simple function-based conversation logger (stateless)
 *
 * Usage:
 * ```typescript
 * manager.onStop(async (input, context) => {
 *   const turn = await createConversationTurn(input, context, userPrompts);
 *   console.log(JSON.stringify(turn, null, 2));
 *   return success();
 * });
 * ```
 */
export async function createConversationTurn(
  input: StopInput,
  context: { getLastTranscriptLine?: () => Promise<any> },
  userPrompts: Array<{ text: string; timestamp: string }>,
  turnNumber: number
): Promise<ConversationTurn> {
  let assistantContent: string | null = null;

  if (context.getLastTranscriptLine) {
    try {
      const lastLine = await context.getLastTranscriptLine();
      if (lastLine?.message?.content) {
        const content = lastLine.message.content;
        if (Array.isArray(content)) {
          assistantContent = content
            .filter((block: any) => block.type === 'text')
            .map((block: any) => block.text)
            .join('\n');
        } else if (typeof content === 'string') {
          assistantContent = content;
        }
      }
    } catch (error) {
      // Transcript not available
    }
  }

  return {
    assistant: {
      content: assistantContent,
      timestamp: new Date().toISOString(),
      toolsUsed: [],
    },
    user_prompts: userPrompts,
    turn_number: turnNumber,
    session_id: input.session_id,
  };
}
