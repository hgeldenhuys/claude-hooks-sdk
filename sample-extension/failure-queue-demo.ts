#!/usr/bin/env bun
/**
 * Sample Extension: Failure Queue Demo
 *
 * Demonstrates the built-in failure queue feature:
 * - Sequential event processing (FIFO)
 * - Automatic retry with configurable max retries
 * - Consumer notification when queue is not empty
 * - Manual queue draining
 */

import { HookManager, success, error, type FailedEvent } from '../src/index';

// Simulate a service that sometimes fails
let failureCount = 0;
const MAX_FAILURES = 2; // Fail first 2 attempts, then succeed

async function processEvent(eventName: string): Promise<boolean> {
  failureCount++;

  // Simulate intermittent failure
  if (failureCount <= MAX_FAILURES) {
    console.log(`❌ Simulating failure #${failureCount} for ${eventName}`);
    return false;
  }

  console.log(`✅ Successfully processed ${eventName}`);
  return true;
}

// Create manager with failure queue enabled
const manager = new HookManager({
  enableFailureQueue: true,
  clientId: 'failure-queue-demo',
  maxRetries: 3,
  debug: true,
  logEvents: true,

  // Called when a new event arrives but queue is not empty
  onErrorQueueNotEmpty: async (queueSize: number, failedEvents: FailedEvent[]) => {
    console.log(`\n⚠️  Error queue not empty!`);
    console.log(`   Queue size: ${queueSize}`);
    console.log(`   Current event will be queued (FIFO maintained)\n`);

    // Show what's in the queue
    for (const failed of failedEvents) {
      console.log(`   - ${failed.event.hook_event_name} (retry: ${failed.retryCount}/${3})`);
    }

    console.log(`\n💡 To drain the queue, call manager.drainQueue()\n`);
  }
});

// Register handlers with simulated failures
manager.onPreToolUse(async (input) => {
  const success = await processEvent(`PreToolUse:${input.tool_name}`);

  if (!success) {
    return error('Processing failed, will retry');
  }

  return { exitCode: 0 };
});

manager.onSessionStart(async (input) => {
  const success = await processEvent('SessionStart');

  if (!success) {
    return error('Processing failed, will retry');
  }

  return { exitCode: 0 };
});

manager.onPostToolUse(async (input) => {
  const success = await processEvent(`PostToolUse:${input.tool_name}`);

  if (!success) {
    return error('Processing failed, will retry');
  }

  return { exitCode: 0 };
});

// Run the hook
manager.run();
