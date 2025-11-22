#!/usr/bin/env bun
/**
 * Conversation-Style Logger Example
 *
 * This example demonstrates how to log hook events in a conversation format,
 * capturing the assistant's response and all user prompts between Stop events.
 *
 * Output format:
 * {
 *   "assistant": {
 *     "content": "I'll help you with that...",
 *     "timestamp": "2025-11-21T23:00:00.000Z",
 *     "toolsUsed": ["Read", "Edit"]
 *   },
 *   "user_prompts": [
 *     { "text": "Can you read the file?", "timestamp": "..." },
 *     { "text": "Now edit it", "timestamp": "..." }
 *   ],
 *   "turn_number": 3,
 *   "session_id": "abc123"
 * }
 *
 * Usage:
 *   bun packages/hooks-sdk/examples/transforms/conversation-logger.ts
 */

import {
  HookManager,
  success,
  ConversationLogger,
  type PreToolUseInput,
  type UserPromptSubmitInput,
  type StopInput,
  type HookContext,
} from '../../src';

// Initialize conversation logger
const conversationLogger = new ConversationLogger();

// Create hook manager
const manager = new HookManager({
  debugHooks: false, // Disable default logging for cleaner output
});

// Track user prompts
manager.onUserPromptSubmit((input: UserPromptSubmitInput) => {
  conversationLogger.recordUserPrompt(input);
  return success();
});

// Track tool uses
manager.onPreToolUse((input: PreToolUseInput) => {
  conversationLogger.recordToolUse(input.tool_name);
  return success();
});

// Log conversation turn on Stop
manager.onStop(async (input: StopInput, context: HookContext) => {
  const turn = await conversationLogger.recordStop(input, context);

  // Log to stdout as formatted JSON
  console.log(JSON.stringify(turn, null, 2));

  return success();
});

// Run the manager
manager.run();
