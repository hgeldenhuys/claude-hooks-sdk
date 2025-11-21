#!/usr/bin/env bun
/**
 * Test: Non-Blocking Error Handling
 *
 * Demonstrates that hook failures don't block Claude Code by default
 */

import { HookManager, success, error } from '../src/index';

// Test 1: Non-blocking mode (DEFAULT)
console.log('\n=== Test 1: Non-Blocking Mode (Default) ===');
const nonBlockingManager = new HookManager({
  debug: true,
  clientId: 'test-non-blocking',
  // blockOnFailure: false is the default
});

nonBlockingManager.onPreToolUse(async (input) => {
  console.log('Handler executing...');

  // Simulate API failure
  throw new Error('API call failed!');

  // This would never be reached
  return success();
});

// Test 2: Blocking mode (Opt-in)
console.log('\n=== Test 2: Blocking Mode (Opt-in) ===');
const blockingManager = new HookManager({
  debug: true,
  clientId: 'test-blocking',
  blockOnFailure: true,  // ← Opt-in to blocking
});

blockingManager.onPreToolUse(async (input) => {
  console.log('Handler executing...');

  // Simulate API failure
  throw new Error('API call failed!');

  return success();
});

// Run the appropriate test based on command line arg
const mode = process.argv[2];

if (mode === 'blocking') {
  console.log('Running BLOCKING test - will exit with error code 1');
  blockingManager.run();
} else {
  console.log('Running NON-BLOCKING test - will exit with error code 0');
  nonBlockingManager.run();
}
