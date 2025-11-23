#!/usr/bin/env bun
/**
 * Event Recorder Plugin
 *
 * Record all hook events to JSONL files for debugging and replay.
 * Uses EventRecorder from claude-hooks-sdk v0.7.0
 *
 * Features:
 * - Record events to JSONL format
 * - Configurable event filtering
 * - Auto-save mode for continuous recording
 * - File rotation support
 * - Perfect for debugging and testing
 *
 * Configuration:
 * Edit .claude-plugin/config.json or set environment variables:
 * - EVENT_RECORDER_ENABLED=true
 * - EVENT_RECORDER_OUTPUT_PATH=.claude/events.jsonl
 */

import { HookManager, EventRecorder } from 'claude-hooks-sdk';
import { loadConfig, getConfigValue } from '../../shared/config-loader';

const PLUGIN_NAME = 'event-recorder';

// Load configuration
const config = loadConfig(PLUGIN_NAME);

if (!config.enabled) {
  console.log(`[${PLUGIN_NAME}] Plugin disabled`);
  process.exit(0);
}

// Get config values
const outputPath = getConfigValue(config, 'outputPath', '.claude/events.jsonl');
const autoSave = getConfigValue(config, 'autoSave', true);
const events = getConfigValue(config, 'events', [
  'UserPromptSubmit',
  'PostToolUse',
  'Stop',
]);

// Initialize EventRecorder
const recorder = new EventRecorder({
  output: outputPath,
  autoSave,
  events: events.length > 0 ? events : undefined,
});

// Create HookManager
const manager = new HookManager({
  clientId: PLUGIN_NAME,
  logEvents: false,
});

let sessionStartTime: number | null = null;

// Record session start
manager.onSessionStart(async (input) => {
  sessionStartTime = Date.now();
  recorder.record(input);
  console.log(`[${PLUGIN_NAME}] 📹 Recording started: ${outputPath}`);
});

// Record user prompts
manager.onUserPromptSubmit(async (input) => {
  recorder.record(input);
});

// Record tool usage
manager.onPreToolUse(async (input) => {
  recorder.record(input);
  return { continue: true };
});

manager.onPostToolUse(async (input) => {
  recorder.record(input);
});

// Record stops
manager.onStop(async (input) => {
  recorder.record(input);
});

// Record session end and save
manager.onSessionEnd(async (input) => {
  recorder.record(input);

  if (!autoSave) {
    await recorder.save();
  }

  const count = recorder.count();
  const duration = sessionStartTime ? Date.now() - sessionStartTime : 0;
  const durationStr = `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`;

  console.log(`\n[${PLUGIN_NAME}] 📹 Recording Summary`);
  console.log(`  Events recorded: ${count}`);
  console.log(`  Duration: ${durationStr}`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  \n  Replay with: bun .claude-plugin/plugins/event-recorder/replay.ts`);
});

// Run the hook
manager.run();
