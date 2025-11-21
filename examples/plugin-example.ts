#!/usr/bin/env bun
/**
 * Plugin Example
 * Shows how to create and use plugins for custom functionality
 */

import { HookManager, HookPlugin, success } from '../src/index';

// Create a logging plugin
const loggingPlugin: HookPlugin = {
  name: 'logging',
  async onBeforeExecute(input, context) {
    console.log(`[Plugin] Before: ${input.hook_event_name}`);
  },
  async onAfterExecute(input, result, context) {
    console.log(`[Plugin] After: ${input.hook_event_name} (exit: ${result.exitCode})`);
  },
};

// Create an analytics plugin (simulated)
const analyticsPlugin: HookPlugin = {
  name: 'analytics',
  async onAfterExecute(input, result) {
    // In real usage, you'd send to an analytics service
    const event = {
      type: input.hook_event_name,
      timestamp: new Date().toISOString(),
      success: result.exitCode === 0,
    };
    console.log('[Analytics]', JSON.stringify(event));
  },
};

// Create manager and add plugins
const manager = new HookManager();
manager.use(loggingPlugin);
manager.use(analyticsPlugin);

// Register handlers
manager.onSessionStart(async (input) => {
  console.log(`Session ${input.session_id} started`);
  return success();
});

manager.run();
