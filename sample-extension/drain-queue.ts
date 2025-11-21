#!/usr/bin/env bun
/**
 * Queue Draining Utility
 *
 * Manually drain the error queue for a specific client
 * Useful for background jobs or scheduled retries
 */

import { HookManager } from '../src/index';

const clientId = process.argv[2] || 'failure-queue-demo';

console.log(`🔧 Draining error queue for client: ${clientId}\n`);

const manager = new HookManager({
  enableFailureQueue: true,
  clientId,
  maxRetries: 3,
  debug: true,
});

// Check current queue status
const beforeStatus = manager.getQueueStatus();
console.log(`📊 Queue status before:`);
console.log(`   Size: ${beforeStatus.size}`);

if (beforeStatus.size === 0) {
  console.log(`\n✅ Queue is empty, nothing to drain\n`);
  process.exit(0);
}

console.log(`   Events:`);
for (const event of beforeStatus.events) {
  console.log(`   - ${event.event.hook_event_name} (retry: ${event.retryCount}/3)`);
  console.log(`     Error: ${event.error}`);
  console.log(`     Timestamp: ${event.timestamp}`);
}

// Drain the queue
console.log(`\n🔄 Draining queue...\n`);

const result = await manager.drainQueue();

console.log(`\n📊 Drain results:`);
console.log(`   Processed: ${result.processed}`);
console.log(`   Remaining: ${result.remaining}`);
console.log(`   Dropped: ${result.dropped}`);

// Check final status
const afterStatus = manager.getQueueStatus();
if (afterStatus.size > 0) {
  console.log(`\n⚠️  ${afterStatus.size} events still in queue (will retry later)\n`);
} else {
  console.log(`\n✅ Queue successfully drained!\n`);
}

process.exit(0);
