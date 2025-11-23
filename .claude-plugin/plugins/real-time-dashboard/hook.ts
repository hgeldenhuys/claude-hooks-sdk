#!/usr/bin/env bun
/**
 * Real-Time Dashboard Plugin
 *
 * Stream events to a web dashboard via Server-Sent Events (SSE).
 * Uses EventStreamer from claude-hooks-sdk v0.7.0
 *
 * Features:
 * - Real-time event streaming via SSE
 * - Multi-channel support
 * - Web dashboard included
 * - CORS enabled for cross-origin access
 *
 * Configuration:
 * Edit .claude-plugin/config.json
 */

import { HookManager, EventStreamer } from 'claude-hooks-sdk';
import { loadConfig, getConfigValue } from '../../shared/config-loader';

const PLUGIN_NAME = 'real-time-dashboard';

const config = loadConfig(PLUGIN_NAME);

if (!config.enabled) {
  console.log(`[${PLUGIN_NAME}] Plugin disabled`);
  process.exit(0);
}

const port = getConfigValue(config, 'port', 3001);
const path = getConfigValue(config, 'path', '/events');
const cors = getConfigValue(config, 'cors', true);

// Initialize EventStreamer
const streamer = new EventStreamer({
  type: 'sse',
  port,
  path,
  cors,
});

const manager = new HookManager({
  clientId: PLUGIN_NAME,
  logEvents: false,
});

// Start SSE server
await streamer.start();
console.log(`[${PLUGIN_NAME}] 📡 Dashboard streaming on http://localhost:${port}${path}`);
console.log(`[${PLUGIN_NAME}] 🌐 Open dashboard: http://localhost:${port}/dashboard`);

// Stream all events
manager.onUserPromptSubmit(async (input) => {
  streamer.broadcast({
    type: 'user-prompt',
    prompt: (input as any).prompt?.substring(0, 100),
    timestamp: Date.now(),
  });
});

manager.onPostToolUse(async (input) => {
  streamer.broadcast({
    type: 'tool-use',
    tool: input.tool_name,
    timestamp: Date.now(),
  });
});

manager.onStop(async (input) => {
  const stopData = input as any;
  streamer.broadcast({
    type: 'stop',
    tokens: stopData.usage?.input_tokens + stopData.usage?.output_tokens || 0,
    timestamp: Date.now(),
  });
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log(`\n[${PLUGIN_NAME}] Stopping dashboard...`);
  await streamer.stop();
  process.exit(0);
});

manager.run();
