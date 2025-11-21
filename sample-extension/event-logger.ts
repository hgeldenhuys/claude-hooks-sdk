#!/usr/bin/env bun
/**
 * Sample Extension: Event Logger
 *
 * Logs all Claude Code hook events to a structured log file
 * Demonstrates how to build a real extension using claude-hooks-sdk
 */

import { HookManager, success } from '../src/index';
import { writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

// Configuration
const LOG_DIR = join(process.cwd(), 'packages/claude-hooks-sdk/sample-extension/logs');
const LOG_FILE = join(LOG_DIR, 'events.jsonl');

// Ensure log directory exists
if (!existsSync(LOG_DIR)) {
  mkdirSync(LOG_DIR, { recursive: true });
}

// Create manager
const manager = new HookManager({ debug: false });

// Create a plugin that logs all events
const loggingPlugin = {
  name: 'event-logger',

  async onAfterExecute(input: any, result: any, context: any, conversation: any) {
    // SDK automatically provides conversation (last transcript line)
    const logEntry = {
      event: input,             // Full event object
      timestamp: new Date().toISOString(),
      conversation,             // Last transcript line (provided by SDK)
    };

    // Append to JSONL file
    appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
  }
};

// Add plugin to manager
manager.use(loggingPlugin);

// Register handlers for all events
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

// Run the hook
manager.run();
