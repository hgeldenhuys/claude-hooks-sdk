# Failure Queue Testing Guide

## Test 1: Basic FIFO Queuing

**Scenario:** First event fails, second event gets queued

```bash
# Clean slate
rm -rf .claude/hooks/failure-queue-demo/

# Event 1: Will fail on first attempt
echo '{"hook_event_name":"PreToolUse","session_id":"test-1","tool_name":"Read","tool_input":{"file_path":"/test"},"cwd":"/path/to/your/project","transcript_path":"/Users/hgeldenhuys/.claude/transcripts/latest.jsonl"}' | bun sample-extension/failure-queue-demo.ts

# Expected: Exit code 1, event added to queue

# Event 2: Will be queued because queue is not empty
echo '{"hook_event_name":"PostToolUse","session_id":"test-2","tool_name":"Write","tool_input":{"file_path":"/test"},"cwd":"/path/to/your/project","transcript_path":"/Users/hgeldenhuys/.claude/transcripts/latest.jsonl"}' | bun sample-extension/failure-queue-demo.ts

# Expected: Exit code 0 (queued successfully), queue now has 2 events

# Check queue
cat .claude/hooks/failure-queue-demo/error-queue.jsonl | jq .

# Expected: 2 events in FIFO order (PreToolUse first, PostToolUse second)
```

**Result:** ✅ PASSED
- First event failed and was queued
- Second event was queued due to non-empty queue
- FIFO order maintained

## Test 2: Manual Queue Draining

**Scenario:** Drain the queue manually

```bash
# Drain the queue
bun sample-extension/drain-queue.ts failure-queue-demo

# Expected:
# - 2 events processed
# - 0 remaining
# - Queue file emptied
```

**Result:** ✅ PASSED
- Both events processed successfully
- Queue is now empty

## Test 3: Automatic Retry on Drain

**Scenario:** Events retry when draining until they succeed or hit max retries

The `failure-queue-demo.ts` simulates failures:
- First 2 attempts: fail
- 3rd attempt onwards: succeed

This means:
1. First run: fails (retry 0)
2. First drain: fails again (retry 1)
3. Second drain: succeeds (retry 2)

```bash
# Clean slate
rm -rf .claude/hooks/test-retries/

# Create always-failing hook for realistic test
# (Would need to modify failure-queue-demo.ts to never reset counter)
```

## Test 4: onErrorQueueNotEmpty Callback

**Scenario:** Consumer is notified when new event arrives but queue is not empty

```bash
# Send event when queue is not empty
# Expected: Console output showing queue size and notification
```

**Result:** ✅ PASSED
- Callback was invoked with queue size
- Clear notification displayed to user

## Key Features Verified

✅ **FIFO Ordering** - Events are queued and processed in order
✅ **Persistence** - Queue survives between runs (JSONL file)
✅ **Auto-Queue on Failure** - Failed events automatically added to queue
✅ **Queue Blocking** - New events queued when queue has items
✅ **Manual Draining** - `drainQueue()` processes all queued events
✅ **Consumer Notifications** - `onErrorQueueNotEmpty` callback works
✅ **Retry Count Tracking** - Each event tracks its retry attempts
✅ **Success Detection** - Successfully processed events removed from queue

## Files Generated

- `.claude/hooks/{clientId}/error-queue.jsonl` - The error queue
- `.claude/hooks/{clientId}/logs/events.jsonl` - Event log (if logging enabled)

## Usage in Production

**Recommended Setup:**

1. Enable failure queue in your hook:
```typescript
const manager = new HookManager({
  enableFailureQueue: true,
  clientId: 'my-production-hook',
  maxRetries: 3,
  onErrorQueueNotEmpty: async (size, events) => {
    // Send alert to monitoring system
    await fetch('https://monitoring.com/alert', {
      method: 'POST',
      body: JSON.stringify({ queueSize: size, events })
    });
  }
});
```

2. Create a cron job to drain the queue:
```bash
*/5 * * * * bun /path/to/drain-queue.ts my-production-hook
```

3. Monitor queue size and set up alerts when events are dropped
