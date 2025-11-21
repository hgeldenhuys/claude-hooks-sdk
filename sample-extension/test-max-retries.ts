#!/usr/bin/env bun
/**
 * Test Max Retries Behavior
 *
 * This script simulates an event that always fails
 * to demonstrate the max retries limit
 */

import { HookManager, error } from '../src/index';

const manager = new HookManager({
  enableFailureQueue: true,
  clientId: 'test-max-retries',
  maxRetries: 3,
  debug: true,
});

// Handler that always fails
manager.onPreToolUse(async (input) => {
  console.log('❌ Handler always fails');
  return error('Simulated permanent failure');
});

manager.run();
