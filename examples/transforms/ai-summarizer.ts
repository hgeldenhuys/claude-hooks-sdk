#!/usr/bin/env bun
/**
 * AI Summarizer Example
 *
 * This example demonstrates how to use Claude Haiku to automatically
 * summarize each Stop event, creating concise one-sentence summaries
 * of what the AI accomplished.
 *
 * Output format:
 * {
 *   "summary": "Read configuration files and updated database schema",
 *   "model": "claude-haiku-3-5-20241022",
 *   "input_tokens": 125,
 *   "output_tokens": 12,
 *   "timestamp": "2025-11-21T23:00:00.000Z",
 *   "session_id": "abc123",
 *   "turn_number": 3
 * }
 *
 * Requirements:
 *   - Set ANTHROPIC_API_KEY environment variable
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... bun packages/hooks-sdk/examples/transforms/ai-summarizer.ts
 */

import { HookManager, success, AISummarizer, type StopInput, type HookContext } from '../../src';

// Check for API key
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}

// Initialize AI summarizer
const summarizer = new AISummarizer({
  apiKey,
  model: 'claude-haiku-3-5-20241022', // Fast and cheap model
});

// Create hook manager
const manager = new HookManager({
  debugHooks: false, // Disable default logging for cleaner output
});

// Summarize on every Stop event
manager.onStop(async (input: StopInput, context: HookContext) => {
  console.log(`\n🤖 Generating summary for turn ${summarizer.getTurnNumber() + 1}...`);

  const summary = await summarizer.summarizeStop(input, context);

  if (summary) {
    console.log('\nSUMMARY:', JSON.stringify(summary, null, 2));
    console.log(`\n📝 ${summary.summary}`);
    console.log(
      `💰 Cost: ${summary.input_tokens} input + ${summary.output_tokens} output tokens`
    );
  } else {
    console.log('⚠️  Could not generate summary (no transcript content)');
  }

  return success();
});

// Run the manager
manager.run();
