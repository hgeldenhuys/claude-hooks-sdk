# Failure Queue Feature

**Added:** 2025-11-21
**Version:** 0.2.0

## Overview

The claude-hooks-sdk now includes a built-in **failure queue** for sequential event processing with automatic retry. This ensures events are processed in FIFO order and no events are lost when failures occur.

## Architecture

### FIFO Sequential Processing with Automatic Draining

```
Event 1 arrives → Process → Success → Done
                         ↓
                      Failure → Add to queue

Event 2 arrives → Check queue → Queue has items?
                              ↓
                           YES: Drain queue (retry Event 1)
                              ↓
                           Event 1 succeeds? → Remove from queue, process Event 2
                              ↓
                           Event 1 still fails? → Increment retry, queue Event 2
                              ↓
                           NO: Process Event 2 immediately
```

### Queue Persistence

Failed events are saved to `.claude/hooks/{clientId}/error-queue.jsonl`:

```jsonl
{"event": {...}, "error": "...", "timestamp": "...", "retryCount": 0}
{"event": {...}, "error": "...", "timestamp": "...", "retryCount": 0}
```

### Automatic Retry Mechanism

- **Automatic Drain**: Every hook event triggers queue drain (no cron jobs needed!)
- **FIFO Processing**: Failed events retried in order before new events
- **Retry Limit**: Configurable `maxRetries` (default: 3)
- **Dropped Events**: After max retries, events are dropped
- **Incremental Counter**: Each retry increments `retryCount`

## Configuration

```typescript
const manager = new HookManager({
  enableFailureQueue: true,        // Enable the queue
  clientId: 'my-extension',        // Required for queue organization
  maxRetries: 3,                   // Max retry attempts
  onErrorQueueNotEmpty: async (queueSize, failedEvents) => {
    // Called when new event arrives but queue is not empty
    console.log(`Queue has ${queueSize} events`);
  }
});
```

## API

### Methods

#### `drainQueue(): Promise<{ processed, remaining, dropped }>`

Manually drain the error queue. Returns statistics:
- `processed`: Number of events successfully processed
- `remaining`: Number of events still in queue (will retry later)
- `dropped`: Number of events that reached max retries

```typescript
const result = await manager.drainQueue();
console.log(`Processed: ${result.processed}`);
console.log(`Remaining: ${result.remaining}`);
console.log(`Dropped: ${result.dropped}`);
```

#### `getQueueStatus(): { size, events }`

Get current queue status without draining:

```typescript
const status = manager.getQueueStatus();
console.log(`Queue size: ${status.size}`);
for (const event of status.events) {
  console.log(`- ${event.event.hook_event_name} (retry ${event.retryCount})`);
}
```

### Types

#### `FailedEvent`

```typescript
interface FailedEvent {
  event: AnyHookInput;     // The original hook event
  error: string;           // Error message from failure
  timestamp: string;       // ISO timestamp when queued
  retryCount: number;      // Number of retry attempts
}
```

## Behavior

### When Queue is Empty

1. New hook event arrives
2. Queue is empty, process immediately
3. If fails → add to queue
4. If succeeds → done

### When Queue Has Items (Automatic Draining)

1. New hook event arrives
2. Queue not empty → **automatic drain triggered**
3. Call `onErrorQueueNotEmpty` callback
4. Retry all queued events in FIFO order:
   - If succeeds → remove from queue
   - If fails && retryCount < maxRetries → increment retry, keep in queue
   - If fails && retryCount >= maxRetries → drop from queue
5. After drain, check queue again:
   - If empty → process new event
   - If still has items → queue new event, return success

**Key Insight:** Every hook event is an opportunity to retry failed events!

## Use Cases

### API Integration with Rate Limiting

```typescript
const manager = new HookManager({
  enableFailureQueue: true,
  clientId: 'api-integration',
  maxRetries: 5,
  onErrorQueueNotEmpty: async (size) => {
    console.log(`${size} events queued due to rate limit`);
  }
});

manager.onPreToolUse(async (input) => {
  try {
    await fetch('https://api.example.com/track', {
      method: 'POST',
      body: JSON.stringify(input)
    });
    return success();
  } catch (error) {
    // Will be queued and retried
    return error(`API call failed: ${error.message}`);
  }
});
```

### Database Operations

```typescript
const manager = new HookManager({
  enableFailureQueue: true,
  clientId: 'db-logger',
  maxRetries: 3,
});

manager.onPostToolUse(async (input) => {
  try {
    await db.toolUses.insert({
      toolName: input.tool_name,
      sessionId: input.session_id,
      timestamp: new Date(),
    });
    return success();
  } catch (error) {
    // Queue if DB is down
    return error(`Database error: ${error.message}`);
  }
});
```

### Queue Monitoring (Optional)

The queue drains automatically on every hook event, but you can monitor it:

```typescript
// monitor-queue.ts (optional)
#!/usr/bin/env bun
import { HookManager } from 'claude-hooks-sdk';

const manager = new HookManager({
  enableFailureQueue: true,
  clientId: 'my-extension',
});

// Check queue size
const status = manager.getQueueStatus();

if (status.size > 0) {
  console.log(`⚠️  ${status.size} events in queue`);

  // Optionally manually drain (normally happens automatically)
  const result = await manager.drainQueue();
  console.log(`Processed: ${result.processed}, Dropped: ${result.dropped}`);
} else {
  console.log('✅ Queue is empty');
}
```

**Note:** Manual draining is optional - the queue automatically drains on every hook event!

## Testing

See `sample-extension/FAILURE-QUEUE-TEST.md` for comprehensive testing guide.

**Quick test:**

```bash
# Terminal 1: Send failing event
echo '{"hook_event_name":"PreToolUse",...}' | bun my-hook.ts

# Terminal 2: Check queue
cat .claude/hooks/my-extension/error-queue.jsonl | jq .

# Terminal 3: Drain queue
bun drain-queue.ts my-extension
```

## Files

- `sample-extension/failure-queue-demo.ts` - Full working example
- `sample-extension/drain-queue.ts` - Queue draining utility
- `sample-extension/FAILURE-QUEUE-TEST.md` - Testing guide

## Migration

Existing hooks continue to work without changes. To enable failure queue:

```diff
const manager = new HookManager({
  logEvents: true,
  clientId: 'my-hook',
+  enableFailureQueue: true,
+  maxRetries: 3,
});
```

## Performance

- **File I/O**: Queue reads/writes use synchronous file operations (blocking)
- **Memory**: Queue is loaded into memory during drain operations
- **Scalability**: Tested with up to 1000 events in queue

**Recommendation:** For high-throughput scenarios (>100 events/sec), consider:
1. Using a separate queue draining process
2. Batching queue drains
3. Monitoring queue size and alerting

## Limitations

- Queue is per-clientId (not shared across multiple hooks)
- No automatic drain (must call `drainQueue()` manually or via cron)
- Dropped events are not logged separately (check drain results)
- No dead-letter queue for permanently failed events

## Future Enhancements

Potential improvements:
- Automatic drain on schedule
- Dead-letter queue for dropped events
- Exponential backoff between retries
- Queue size limits
- Redis/database backend for queue persistence
