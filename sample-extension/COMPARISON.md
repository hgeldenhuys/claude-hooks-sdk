# Event Logger: Manual vs SDK Built-in Logging

## Comparison

### ❌ Old Way (event-logger.ts) - Manual Logging

**Lines of code**: ~40 lines
**Complexity**: Medium
**Maintenance**: You maintain logging logic

```typescript
// Create a custom plugin
const loggingPlugin = {
  name: 'event-logger',
  async onAfterExecute(input, result, context, conversation) {
    const logEntry = {
      event: input,
      timestamp: new Date().toISOString(),
      conversation,
    };
    appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
  }
};

manager.use(loggingPlugin);
```

**Pros:**
- Full control over log format
- Can customize logging behavior

**Cons:**
- More code to write and maintain
- Need to handle file I/O yourself
- Need to create log directory manually
- No built-in output metadata

---

### ✅ New Way (event-logger-v2.ts) - SDK Built-in Logging

**Lines of code**: ~5 lines (just config!)
**Complexity**: Minimal
**Maintenance**: SDK handles everything

```typescript
const manager = new HookManager({
  logEvents: true,              // Enable logging
  clientId: 'event-logger',     // Organize by client
});

// That's it! SDK handles all logging automatically
```

**Pros:**
- Minimal code - just enable a flag
- SDK handles file I/O, directory creation
- Automatic output metadata (exitCode, success, etc.)
- Consistent log format across all consumers
- Organized by clientId in `.claude/hooks/{clientId}/`

**Cons:**
- Less customization (but you can still use plugins for custom logic)

---

## Log Output Comparison

### Manual Plugin Output
```json
{
  "event": {...},
  "timestamp": "2025-11-21T...",
  "conversation": {...}
}
```

### SDK Built-in Output (Enhanced!)
```json
{
  "event": {...},
  "timestamp": "2025-11-21T...",
  "conversation": {...},
  "output": {
    "exitCode": 0,
    "success": true,
    "hasOutput": false,
    "hasStdout": false,
    "hasStderr": false
  }
}
```

**SDK adds automatic output metadata** - tracks what your handlers returned!

---

## File Organization

### Manual Plugin
```
packages/claude-hooks-sdk/sample-extension/logs/events.jsonl
```
You decide where logs go (but have to manage it)

### SDK Built-in
```
.claude/hooks/
  ├── event-logger/
  │   └── events.jsonl
  ├── my-analytics/
  │   └── events.jsonl
  └── security-monitor/
      └── events.jsonl
```
Automatically organized by `clientId` - clean and predictable!

---

## Configuration Options

```typescript
const manager = new HookManager({
  // Enable event logging
  logEvents: true,

  // Client identifier (organizes logs)
  clientId: 'my-extension',

  // Optional: custom log directory
  logDir: '/custom/path',

  // Optional: debug output
  debug: true,
});
```

**Default behavior:**
- Logs to: `.claude/hooks/{clientId}/logs/events.jsonl`
- Creates directory automatically
- Silent failures (won't break hooks)

---

## When to Use Each Approach

### Use SDK Built-in Logging
✅ Quick debugging
✅ Standard event tracking
✅ Consistent format needed
✅ Multiple extensions (organized by clientId)
✅ You want minimal code

### Use Custom Plugin
✅ Need custom log format
✅ Want to send to external API
✅ Need complex transformations
✅ Require special error handling
✅ Building specialized analytics

---

## Recommendation

**Start with SDK built-in logging** - it's dead simple:

```typescript
const manager = new HookManager({
  logEvents: true,
  clientId: 'my-hook',
});
```

**Add custom plugins** only when you need special behavior beyond logging.

---

## Migration

Converting from manual to SDK logging:

```diff
- import { appendFileSync } from 'fs';
- const LOG_FILE = './logs/events.jsonl';

- const loggingPlugin = {
-   name: 'event-logger',
-   async onAfterExecute(input, result, context, conversation) {
-     const logEntry = { event: input, timestamp: new Date().toISOString(), conversation };
-     appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');
-   }
- };

const manager = new HookManager({
+  logEvents: true,
+  clientId: 'event-logger',
});

- manager.use(loggingPlugin);
```

**Result:** ~30 fewer lines of code, better log format, organized by client!
