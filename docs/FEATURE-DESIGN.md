# claude-hooks-sdk v0.7.0 - Feature Design

## Overview

This document outlines the API design for 6 new features being added to claude-hooks-sdk v0.7.0.

## 1. Persistent State Management

**Purpose:** Store state that survives restarts, enabling production-ready transforms.

### API Design

```typescript
import { PersistentState } from 'claude-hooks-sdk';

// Initialize with storage backend
const state = new PersistentState({
  storage: 'sqlite',  // 'sqlite' | 'file' | 'memory'
  path: '.claude/state.db'
});

// Basic operations
await state.set('lastSync', Date.now());
const lastSync = await state.get<number>('lastSync');
await state.delete('lastSync');
await state.clear();

// Namespaced state
const sessionState = state.namespace('session-123');
await sessionState.set('turnCount', 5);

// Atomic operations
await state.increment('requestCount');
await state.append('errors', { message: 'Failed', timestamp: Date.now() });
```

### Implementation Notes
- Default to SQLite for reliability
- Support file-based JSON for simplicity
- Include in-memory fallback for testing
- Automatic migrations for schema changes

---

## 2. Session Analytics & Metrics

**Purpose:** Track costs, performance, and usage patterns automatically.

### API Design

```typescript
import { SessionAnalytics } from 'claude-hooks-sdk';

const analytics = new SessionAnalytics({
  pricing: {
    'claude-sonnet-4': { input: 3.00, output: 15.00 },  // per million tokens
    'claude-haiku-3': { input: 0.25, output: 1.25 }
  }
});

// Record events
manager.onPostToolUse((input) => {
  analytics.recordToolUse(input);
});

// Get metrics
const metrics = analytics.getMetrics(sessionId);
// {
//   duration: { start: Date, end: Date, elapsed: '15m 32s' },
//   tools: { Read: 45, Write: 12, Edit: 8 },
//   tokens: { input: 100000, output: 25000, total: 125000 },
//   cost: { input: 0.30, output: 0.375, total: 0.675 },
//   turns: 12,
//   errors: 2,
//   errorRate: 0.167
// }

// Aggregated stats
const allSessions = analytics.getAllSessions();
const avgCost = analytics.getAverageCost();
```

### Implementation Notes
- Track token usage from Stop events
- Calculate costs based on model pricing
- Store metrics in PersistentState
- Support custom pricing models

---

## 3. Event Replay & Testing

**Purpose:** Record real sessions and replay them for testing.

### API Design

```typescript
import { EventRecorder, EventReplayer } from 'claude-hooks-sdk';

// Recording
const recorder = new EventRecorder({
  output: 'test-fixtures/session.jsonl',
  events: ['UserPromptSubmit', 'PostToolUse', 'Stop']  // filter
});

manager.onPostToolUse((input) => {
  recorder.record(input);
});

await recorder.save();

// Replaying
const replayer = new EventReplayer('test-fixtures/session.jsonl');

// Replay all events
await replayer.replay((event) => {
  myTransform.process(event);
});

// Replay with filters
await replayer.replay((event) => {
  // ...
}, {
  events: ['PostToolUse'],
  speed: 2.0,  // 2x speed
  realtime: false  // instant replay
});

// Assertions for testing
const events = await replayer.load();
expect(events).toHaveLength(10);
expect(events[0].hook_event_name).toBe('UserPromptSubmit');
```

### Implementation Notes
- JSONL format for easy parsing
- Support filtering by event type
- Realtime vs instant replay modes
- Integration with test frameworks

---

## 4. Real-time Event Streaming

**Purpose:** Stream events to dashboards/monitoring tools in real-time.

### API Design

```typescript
import { EventStreamer } from 'claude-hooks-sdk';

// Server-Sent Events
const streamer = new EventStreamer({
  type: 'sse',
  port: 3001,
  path: '/events'
});

// Broadcast events
manager.onPostToolUse((input) => {
  streamer.broadcast({
    type: 'file-change',
    file: input.tool_input.file_path,
    operation: input.tool_name,
    timestamp: Date.now()
  });
});

// Custom channels
streamer.broadcast({ type: 'error', message: '...' }, 'errors');

// Client connection
const client = new EventClient('http://localhost:3001/events');
client.on('file-change', (data) => {
  console.log('File changed:', data.file);
});
```

### Implementation Notes
- SSE for simplicity (WebSocket optional)
- Support multiple channels
- Auto-reconnect on disconnect
- CORS configuration

---

## 5. Hook Middleware & Filters

**Purpose:** Composable middleware for common patterns.

### API Design

```typescript
import { HookManager, middleware } from 'claude-hooks-sdk';

const manager = new HookManager()
  // Rate limiting
  .use(middleware.rateLimit({
    maxEvents: 100,
    window: '1m',
    type: 'sliding'
  }))

  // Deduplication
  .use(middleware.deduplicate({
    key: (input) => `${input.tool_name}:${input.tool_input.file_path}`,
    window: 5000  // 5 seconds
  }))

  // Tool filtering
  .use(middleware.filterByTool(['Read', 'Write', 'Edit']))

  // PII redaction
  .use(middleware.piiRedaction({
    fields: ['content', 'prompt'],
    patterns: [/\b\d{3}-\d{2}-\d{4}\b/g]  // SSN
  }))

  // Custom middleware
  .use(async (input, next) => {
    console.log('Before:', input.hook_event_name);
    const result = await next(input);
    console.log('After:', result);
    return result;
  });

// Middleware can modify input
manager.onPostToolUse((input) => {
  // input has been processed by all middleware
});
```

### Implementation Notes
- Koa/Express-style middleware pattern
- Built-in common middleware
- Async support
- Early termination (skip handler)

---

## 6. Anomaly Detection

**Purpose:** Automatically detect unusual patterns and alert.

### API Design

```typescript
import { AnomalyDetector } from 'claude-hooks-sdk';

const detector = new AnomalyDetector({
  rules: {
    errorRate: { threshold: 0.1, window: '5m' },
    responseTime: { threshold: 30000, type: 'p95' },
    toolSequence: { unexpected: ['Write', 'Write', 'Write'] },
    tokenSpike: { stdDev: 3 }
  },
  onAnomaly: (anomaly) => {
    // Alert via email, Slack, etc.
    console.error('Anomaly detected:', anomaly);
  }
});

manager.onPostToolUse((input) => {
  detector.check(input);
});

// Get anomalies
const anomalies = detector.getAnomalies(sessionId);
// [
//   { type: 'error_rate', value: 0.25, threshold: 0.1, timestamp: Date },
//   { type: 'response_time', value: 45000, threshold: 30000, timestamp: Date }
// ]

// Statistics
const stats = detector.getStatistics(sessionId);
// { mean: 5000, median: 4500, p95: 8000, stdDev: 1200 }
```

### Implementation Notes
- Statistical analysis (mean, median, stdDev)
- Pattern matching for sequences
- Configurable rules
- Alert integration hooks

---

## Implementation Order

1. **PersistentState** - Foundation for other features
2. **SessionAnalytics** - Immediately useful, depends on PersistentState
3. **EventRecorder/Replayer** - Testing infrastructure
4. **Middleware** - Composability layer
5. **EventStreamer** - Real-time capabilities
6. **AnomalyDetector** - Advanced monitoring

## Testing Strategy

- Unit tests for each feature
- Integration tests using EventReplayer
- Performance benchmarks for PersistentState
- Example apps demonstrating each feature

## Documentation

- API reference for each feature
- Migration guide from v0.6.0
- Best practices guide
- Production deployment examples
