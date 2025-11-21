#!/usr/bin/env bun
/**
 * Sample Extension: Event Logger v2
 *
 * Demonstrates using SDK's built-in logging feature with all v0.4.1 features:
 * - Built-in event logging
 * - Edit tracking (Edit, Write, MultiEdit tools)
 * - Repo instance ID tracking
 * - Non-blocking error handling
 * - Timeout support
 * - Type-safe context access
 */

import { HookManager, success } from '../src/index';

// Create manager with all v0.4.1 features enabled
const manager = new HookManager({
  // Logging
  logEvents: true,              // Enable built-in logging
  clientId: 'event-logger',     // Organize logs by client
  debug: false,                 // Disable debug output

  // Features
  trackEdits: true,             // Track edited files (Edit, Write, MultiEdit)
  enableContextTracking: true,  // Transaction IDs, git metadata, repo instance ID

  // Error Handling
  blockOnFailure: false,        // Non-blocking by default
  handlerTimeout: 30000,        // 30 second timeout (0 = disabled)

  // Failure Queue (optional)
  enableFailureQueue: false,    // Enable retry queue if needed
  maxRetries: 3,                // Max retry attempts
  maxQueueDrainPerEvent: 10,    // Limit drain per event
});

// Register handlers for all events
// No need for custom logging plugin - SDK handles it!

manager.onSessionStart(async (input) => {
  console.log(`📝 Logging SessionStart event`);
  return success();
});

manager.onSessionEnd(async (input) => {
  console.log(`📝 Logging SessionEnd event (reason: ${input.reason})`);
  return success();
});

manager.onPreToolUse(async (input) => {
  console.log(`📝 Logging PreToolUse: ${input.tool_name}`);
  return success();
});

manager.onPostToolUse(async (input) => {
  console.log(`📝 Logging PostToolUse: ${input.tool_name}`);
  return success();
});

manager.onUserPromptSubmit(async (input) => {
  console.log(`📝 Logging UserPromptSubmit`);
  return success();
});

manager.onStop(async (input) => {
  console.log(`📝 Logging Stop event`);

  // Type-safe access to enriched context (v0.4.1)
  const context = input.context;

  if (context) {
    // Transaction ID
    console.log(`   Transaction: ${context.transactionId}`);

    // Git metadata with repo instance ID
    if (context.git) {
      console.log(`   Branch: ${context.git.branch}`);
      console.log(`   Repo Instance: ${context.git.repoInstanceId}`);
    }

    // Edited files (Edit, Write, MultiEdit tools)
    if (context.editedFiles && context.editedFiles.length > 0) {
      console.log(`   Edited ${context.editedFiles.length} files:`);
      for (const file of context.editedFiles) {
        console.log(`     - ${file}`);
      }
    }
  }

  return success();
});

manager.onSubagentStop(async (input) => {
  console.log(`📝 Logging SubagentStop event`);
  return success();
});

manager.onNotification(async (input) => {
  console.log(`📝 Logging Notification: ${input.message}`);
  return success();
});

manager.onPreCompact(async (input) => {
  console.log(`📝 Logging PreCompact (trigger: ${input.trigger})`);
  return success();
});

// Run the hook - SDK automatically logs to .claude/hooks/event-logger/logs/events.jsonl
// View logs: tail -f .claude/hooks/event-logger/logs/events.jsonl | jq '.'
manager.run();
