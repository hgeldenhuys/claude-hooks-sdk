#!/usr/bin/env bun
/**
 * Test Context Tracking
 *
 * Demonstrates transaction ID, prompt ID, and git metadata tracking
 */

import { HookManager, success } from '../src/index';

const manager = new HookManager({
  enableContextTracking: true,
  clientId: 'context-test',
  logEvents: true,
  debug: true,
});

// All events will have context automatically injected
manager.onSessionStart(async (input: any) => {
  console.log('\n📊 SessionStart Context:');
  console.log(`   Transaction ID: ${input.context?.transactionId}`);
  console.log(`   Conversation ID: ${input.context?.conversationId}`);
  if (input.context?.git) {
    console.log(`   Git User: ${input.context.git.user}`);
    console.log(`   Git Branch: ${input.context.git.branch}`);
    console.log(`   Git Commit: ${input.context.git.commit?.slice(0, 7)}`);
    console.log(`   Git Dirty: ${input.context.git.dirty}`);
  }
  return success();
});

manager.onUserPromptSubmit(async (input: any) => {
  console.log('\n📊 UserPromptSubmit Context:');
  console.log(`   Transaction ID: ${input.context?.transactionId}`);
  console.log(`   Prompt ID: ${input.context?.promptId || 'N/A (will be set after this event)'}`);
  return success();
});

manager.onPreToolUse(async (input: any) => {
  console.log('\n📊 PreToolUse Context:');
  console.log(`   Transaction ID: ${input.context?.transactionId}`);
  console.log(`   Prompt ID: ${input.context?.promptId || 'N/A'}`);
  console.log(`   Tool: ${input.tool_name}`);
  return success();
});

manager.onSessionEnd(async (input: any) => {
  console.log('\n📊 SessionEnd Context:');
  console.log(`   Transaction ID: ${input.context?.transactionId}`);
  console.log(`   Session Reason: ${input.reason}`);
  return success();
});

manager.run();
