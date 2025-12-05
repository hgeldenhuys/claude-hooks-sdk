---
name: claude-hooks-sdk
description: Expert guide for building Claude Code hooks using claude-hooks-sdk. Provides setup, configuration, patterns, troubleshooting, and best practices for the hooks SDK.
version: 0.8.5
tags: [hooks, sdk, typescript, claude-code, observability, logger, transforms]
last_updated: 2025-12-05
---

# Claude Hooks SDK Expert

You are an expert on the `claude-hooks-sdk` npm package. Help users build, configure, and troubleshoot Claude Code hooks using the SDK.

## Quick Reference

### Installation
```bash
npm install claude-hooks-sdk
# or
bun add claude-hooks-sdk
```

### Basic Setup
```typescript
#!/usr/bin/env bun
import { HookManager, success, block } from 'claude-hooks-sdk';

const manager = new HookManager({
  logEvents: true,        // Enable enriched logging
  clientId: 'my-hook',    // Organize logs
  enableContextTracking: true,  // Transaction IDs, git metadata
  trackEdits: true,       // Track file edits automatically
});

manager.onPreToolUse(async (input, context) => {
  if (input.tool_name === 'Bash' && input.tool_input.command.includes('rm -rf /')) {
    return block('Dangerous command blocked');
  }
  return success();
});

manager.run();
```

### Configuration Options

```typescript
interface HookManagerOptions {
  // Logging
  logEvents?: boolean;           // Enable enriched logging to file
  clientId?: string;             // Client ID for log organization (default: 'default')
  logDir?: string;               // Custom log directory path
  debug?: boolean;               // Enable debug output to console

  // Context & Tracking
  enableContextTracking?: boolean;  // Track transactions, git, sessions (default: true)
  trackEdits?: boolean;             // Automatically track edited files (default: false)

  // Error Handling
  blockOnFailure?: boolean;         // Make failures blocking (default: false)
  enableFailureQueue?: boolean;     // FIFO queue with retry (default: false)
  maxRetries?: number;              // Max retry attempts (default: 3)
  maxQueueDrainPerEvent?: number;   // Events to process per drain (default: 10)
  handlerTimeout?: number;          // Handler timeout in ms (default: none)

  // Callbacks
  onErrorQueueNotEmpty?: (size: number, events: FailedEvent[]) => void | Promise<void>;
}
```

### Log Locations

**When `logEvents: true`:**
- Logs: `.claude/hooks/{clientId}/logs/events.jsonl`
- Error Queue: `.claude/hooks/{clientId}/error-queue.jsonl`

**Monitor logs:**
```bash
tail -f .claude/hooks/{clientId}/logs/events.jsonl | jq
```

### Enriched Log Format

```json
{
  "input": {
    "hook": { /* Raw hook event */ },
    "conversation": { /* Last transcript line */ },
    "context": {
      "transactionId": "tx_...",
      "conversationId": "session_id",
      "git": {
        "user": "...",
        "email": "...",
        "repo": "...",
        "branch": "...",
        "commit": "...",
        "dirty": false,
        "repoInstanceId": "repo_..."
      },
      "editedFiles": ["file1.ts", "file2.ts"]
    },
    "timestamp": "2025-11-21T..."
  },
  "output": {
    "exitCode": 0,
    "success": true,
    "hasOutput": false
  }
}
```

## Progressive Disclosure

<details>
<summary>📖 Hook Event Types</summary>

### All Available Events

1. **SessionStart** - Session begins (startup or resume)
2. **SessionEnd** - Session ends (reason: user_quit, error, etc.)
3. **Stop** - AI completes response
4. **SubagentStop** - Subagent completes task
5. **PreToolUse** - Before tool executes (can block)
6. **PostToolUse** - After tool executes
7. **UserPromptSubmit** - User submits prompt
8. **Notification** - System notification
9. **PreCompact** - Before context compaction (can block)

### Handler Registration

```typescript
manager.onSessionStart(async (input, context) => {
  console.log('Session started:', input.session_id);
  return success();
});

manager.onStop(async (input, context) => {
  console.log('Edited files:', context.editedFiles);
  return success();
});

manager.onPreToolUse(async (input, context) => {
  if (shouldBlock(input)) {
    return block('Reason for blocking');
  }
  return success();
});
```

</details>

<details>
<summary>🎯 Context Tracking</summary>

### What is Context?

Context provides correlation data across events:

```typescript
interface EventContext {
  transactionId: string;      // Groups events between SessionStart/Stop
  conversationId: string;     // Current session ID
  promptId?: string;          // Current prompt ID
  project_dir?: string;       // CLAUDE_PROJECT_DIR
  git?: GitMetadata;          // Git info (user, repo, branch, commit, repoInstanceId)
  editedFiles?: string[];     // Files edited (when trackEdits: true)
}
```

### Usage

```typescript
manager.onStop(async (input, context) => {
  console.log('Transaction:', context.transactionId);
  console.log('Branch:', context.git?.branch);
  console.log('Edited:', context.editedFiles);
  return success();
});
```

### Transaction Grouping

All events between `SessionStart` and `Stop` share the same `transactionId`.

</details>

<details>
<summary>✏️ Edit Tracking</summary>

### Automatic File Tracking

When `trackEdits: true`, the SDK automatically tracks files modified by:
- `Edit` tool
- `Write` tool
- `MultiEdit` tool

### Access Edited Files

```typescript
manager.onStop(async (input, context) => {
  if (context.editedFiles && context.editedFiles.length > 0) {
    console.log('Modified files:');
    for (const file of context.editedFiles) {
      console.log(`  - ${file}`);
    }

    // Run tests on changed files
    await runTestsOn(context.editedFiles);
  }
  return success();
});
```

### Use Cases

- Run tests only on modified files
- Send notifications for large changesets
- Lint only changed files
- Auto-commit changed files
- Trigger CI/CD for specific paths

</details>

<details>
<summary>🔄 Failure Queue & Retry</summary>

### Sequential Processing with Retry

When `enableFailureQueue: true`:
1. Failed events are saved to error queue
2. Queue is FIFO (first in, first out)
3. Queue drains automatically before new events
4. Retry with exponential backoff

### Configuration

```typescript
const manager = new HookManager({
  enableFailureQueue: true,
  maxRetries: 3,                    // Retry up to 3 times
  maxQueueDrainPerEvent: 10,        // Process 10 queued events per new event
  onErrorQueueNotEmpty: (size) => {
    console.log(`Queue has ${size} failed events`);
  },
});
```

### Manual Queue Management

```typescript
// Drain queue manually
const result = await manager.drainQueue();
console.log(`Processed: ${result.processed}`);
console.log(`Remaining: ${result.remaining}`);
console.log(`Dropped: ${result.dropped}`);
```

### Use Cases

- Ensure all events reach external API
- Handle transient network failures
- Guarantee event ordering
- Retry failed database inserts

</details>

<details>
<summary>🚫 Blocking vs Non-Blocking</summary>

### Non-Blocking (Default)

Hook failures don't stop Claude Code:

```typescript
const manager = new HookManager({
  blockOnFailure: false,  // Default
});

manager.onPreToolUse(async (input, context) => {
  await sendToAPI(input);  // If this fails, Claude continues
  return success();
});
```

**Use non-blocking for:**
- Analytics/logging
- Metrics collection
- Non-critical notifications
- Optional API calls

### Blocking

Hook failures stop Claude Code:

```typescript
const manager = new HookManager({
  blockOnFailure: true,
});

manager.onPreToolUse(async (input, context) => {
  const allowed = await checkPermissions(input);
  if (!allowed) {
    return block('Unauthorized');
  }
  return success();
});
```

**Use blocking for:**
- Security enforcement
- Access control
- Critical validation
- Compliance checks

### Blocking Specific Events

Only `PreToolUse` and `PreCompact` can block:

```typescript
// Block dangerous commands
manager.onPreToolUse(async (input, context) => {
  if (input.tool_name === 'Bash') {
    const dangerous = ['rm -rf /', 'dd if=/dev/zero'];
    if (dangerous.some(cmd => input.tool_input.command.includes(cmd))) {
      return block('Dangerous command blocked');
    }
  }
  return success();
});

// Block compaction during critical operations
manager.onPreCompact(async (input, context) => {
  if (await hasUnsavedWork()) {
    return block('Save work before compacting');
  }
  return success();
});
```

</details>

<details>
<summary>🔍 Transcript Access</summary>

### Built-in Utilities

```typescript
import {
  getTranscriptLine,
  getFullTranscript,
  searchTranscript
} from 'claude-hooks-sdk';

// Get specific line
const line = await getTranscriptLine(transcriptPath, 10);

// Get full transcript
const transcript = await getFullTranscript(transcriptPath);

// Search transcript
const results = await searchTranscript(
  transcriptPath,
  (line) => line.role === 'user'
);
```

### Access in Handlers

```typescript
manager.onStop(async (input, context) => {
  const transcript = await context.getFullTranscript();
  const lastMessage = transcript[transcript.length - 1];

  if (lastMessage.role === 'assistant') {
    console.log('AI said:', lastMessage.content);
  }

  return success();
});
```

</details>

<details>
<summary>🔌 Plugin System</summary>

### Creating Plugins

Extend HookManager with custom plugins:

```typescript
interface HookPlugin {
  name: string;
  onBeforeExecute?: (input, context) => void | Promise<void>;
  onAfterExecute?: (input, result, context, conversation) => void | Promise<void>;
}

const analyticsPlugin: HookPlugin = {
  name: 'analytics',
  onAfterExecute: async (input, result, context) => {
    await sendToAnalytics({
      event: input.hook_event_name,
      duration: Date.now() - context.startTime,
      success: result.exitCode === 0,
    });
  },
};

manager.use(analyticsPlugin);
```

### Use Cases

- Analytics integration
- Performance monitoring
- Custom logging formats
- External API integration
- Database persistence

</details>

## Common Patterns

### Pattern 1: API Integration

```typescript
import { HookManager, success } from 'claude-hooks-sdk';

const manager = new HookManager({
  logEvents: true,
  clientId: 'api-integration',
  enableContextTracking: true,
});

manager.onStop(async (input, context) => {
  try {
    const response = await fetch('https://api.example.com/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: input.hook_event_name,
        context,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.error('API error:', await response.text());
    }
  } catch (error) {
    console.error('Failed to send event:', error);
  }

  return success();
});

manager.run();
```

### Pattern 2: Command Blocking

```typescript
manager.onPreToolUse(async (input, context) => {
  if (input.tool_name !== 'Bash') {
    return success();
  }

  const command = input.tool_input.command;

  // Block dangerous patterns
  const dangerous = [
    /rm\s+-rf\s+\//,
    /dd\s+if=\/dev\/zero/,
    /mkfs/,
    /:(){ :|:& };:/,  // Fork bomb
  ];

  for (const pattern of dangerous) {
    if (pattern.test(command)) {
      return block(`Blocked dangerous command: ${command}`);
    }
  }

  return success();
});
```

### Pattern 3: File Change Notifications

```typescript
manager.onStop(async (input, context) => {
  if (!context.editedFiles || context.editedFiles.length === 0) {
    return success();
  }

  // Send Slack notification for large changesets
  if (context.editedFiles.length > 10) {
    await sendSlackMessage({
      text: `⚠️ Large changeset: ${context.editedFiles.length} files modified`,
      files: context.editedFiles.slice(0, 5),
      more: context.editedFiles.length - 5,
    });
  }

  return success();
});
```

### Pattern 4: Conditional Testing

```typescript
manager.onStop(async (input, context) => {
  if (!context.editedFiles) {
    return success();
  }

  // Run tests for edited TypeScript files
  const tsFiles = context.editedFiles.filter(f => f.endsWith('.ts'));
  if (tsFiles.length > 0) {
    console.log('Running tests for:', tsFiles);
    await runTests(tsFiles);
  }

  return success();
});
```

## Troubleshooting

### Issue: Logs not appearing

**Check:**
1. `logEvents: true` is set
2. Correct log path: `.claude/hooks/{clientId}/logs/events.jsonl`
3. Hook is actually running (check hook success messages)
4. File system permissions

**Debug:**
```typescript
const manager = new HookManager({
  logEvents: true,
  debug: true,  // Enable debug output
  clientId: 'test',
});
```

### Issue: Context not enriched

**Check:**
1. `enableContextTracking: true` (default)
2. For git metadata: verify you're in a git repository
3. For edited files: `trackEdits: true` must be set

**Example:**
```typescript
manager.onStop(async (input, context) => {
  console.log('Context:', JSON.stringify(context, null, 2));
  return success();
});
```

### Issue: Hook failures blocking Claude

**Check:**
1. `blockOnFailure` setting (default is false)
2. Only `PreToolUse` and `PreCompact` can block execution
3. Check return value: `block()` vs `success()` vs `error()`

**Fix:**
```typescript
const manager = new HookManager({
  blockOnFailure: false,  // Explicit non-blocking
  handlerTimeout: 5000,   // Timeout after 5s
});
```

### Issue: Handler timeout

**Add timeout:**
```typescript
const manager = new HookManager({
  handlerTimeout: 10000,  // 10 second timeout
});
```

### Issue: Queue not draining

**Check queue:**
```typescript
manager.onStop(async (input, context) => {
  const result = await manager.drainQueue();
  console.log('Queue status:', result);
  return success();
});
```

## Best Practices

### 1. Use Non-Blocking by Default

Unless you need security enforcement, use non-blocking hooks:

```typescript
const manager = new HookManager({
  blockOnFailure: false,  // Default - safe choice
});
```

### 2. Enable All Tracking Features

Get maximum observability:

```typescript
const manager = new HookManager({
  logEvents: true,
  enableContextTracking: true,
  trackEdits: true,
  clientId: 'my-hook',
});
```

### 3. Handle Errors Gracefully

Don't let hook errors crash Claude:

```typescript
manager.onStop(async (input, context) => {
  try {
    await riskyOperation();
  } catch (error) {
    console.error('Non-critical error:', error);
    // Continue anyway
  }
  return success();
});
```

### 4. Use Failure Queue for Critical Operations

For API calls that must succeed:

```typescript
const manager = new HookManager({
  enableFailureQueue: true,
  maxRetries: 5,
  onErrorQueueNotEmpty: (size) => {
    console.warn(`⚠️ ${size} events queued`);
  },
});
```

### 5. Set Reasonable Timeouts

Prevent hanging hooks:

```typescript
const manager = new HookManager({
  handlerTimeout: 30000,  // 30 seconds max
});
```

### 6. Organize Logs by Client ID

Use descriptive client IDs:

```typescript
const manager = new HookManager({
  clientId: 'security-audit',  // Not 'default'
  logEvents: true,
});
```

## New in v0.8.5

### Logger Utility

Structured logging with debug mode support:

```typescript
import { createLogger } from 'claude-hooks-sdk';

const logger = createLogger('my-hook');

logger.info('Always shown');
logger.logDebug('Only shown when DEBUG=1');
logger.warn('Warning message');
logger.error(new Error('Something failed'));
```

### Constants

Centralized magic numbers:

```typescript
import {
  DEFAULT_HANDLER_TIMEOUT_MS,
  DEFAULT_MAX_RETRIES,
  EXIT_CODE_SUCCESS,
  EXIT_CODE_ERROR,
  EXIT_CODE_BLOCK,
} from 'claude-hooks-sdk';
```

### Transforms

Production-ready utilities:

```typescript
import {
  ConversationLogger,
  FileChangeTracker,
  TodoTracker,
  AISummarizer,
} from 'claude-hooks-sdk';

const conversationLogger = new ConversationLogger();
const fileTracker = new FileChangeTracker();

manager.onUserPromptSubmit((input) => {
  conversationLogger.recordUserPrompt(input);
  return success();
});

manager.onPostToolUse((input) => {
  fileTracker.recordChange(input);
  return success();
});

manager.onStop(async (input, context) => {
  const turn = await conversationLogger.recordStop(input, context);
  const changes = fileTracker.getBatch(input.session_id);
  return success();
});
```

## Version Information

**SDK Version:** 0.8.5
**Release Date:** December 2025
**npm:** https://www.npmjs.com/package/claude-hooks-sdk
**GitHub:** https://github.com/hgeldenhuys/claude-hooks-sdk

## Related Resources

- [Claude Code Documentation](https://code.claude.com/docs)
- [Hooks Reference](https://code.claude.com/docs/en/hooks)
- [SDK GitHub](https://github.com/hgeldenhuys/claude-hooks-sdk)
- [npm Package](https://www.npmjs.com/package/claude-hooks-sdk)
