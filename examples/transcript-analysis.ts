#!/usr/bin/env bun
/**
 * Transcript Analysis Example
 *
 * Demonstrates using the transcript utilities to analyze conversation history
 */

import { HookManager, success } from '../src/index';

const manager = new HookManager({
  logEvents: true,
  clientId: 'transcript-analyzer',
});

manager.onStop(async (input, context) => {
  // Get full transcript
  const transcript = await context.getFullTranscript();

  // Count different message types
  const userMessages = transcript.filter(line =>
    line.content?.role === 'user'
  );

  const assistantMessages = transcript.filter(line =>
    line.content?.role === 'assistant'
  );

  const toolUses = transcript.filter(line =>
    line.content?.type === 'tool_use'
  );

  console.log(`\n📊 Session Statistics:`);
  console.log(`   User messages: ${userMessages.length}`);
  console.log(`   Assistant messages: ${assistantMessages.length}`);
  console.log(`   Tool uses: ${toolUses.length}`);
  console.log(`   Total lines: ${transcript.length}\n`);

  return success();
});

manager.run();
