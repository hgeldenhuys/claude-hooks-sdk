# claude-hooks-sdk

> Type-safe TypeScript SDK for building Claude Code hook extensions

[![npm version](https://badge.fury.io/js/claude-hooks-sdk.svg)](https://www.npmjs.com/package/claude-hooks-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- ✅ **Full Type Safety** - Complete TypeScript types for all 10 Claude Code hook events
- ✅ **Fluent API** - Intuitive `manager.onPreToolUse(...)` handler registration
- ✅ **Zero Dependencies** - No runtime dependencies, works anywhere
- ✅ **Non-Blocking by Default** - Hook failures don't block Claude Code (opt-in blocking available)
- ✅ **Built-in Event Logging** - Enable with one flag, organized by client ID
- ✅ **Edit Tracking** - Automatically track files modified during Claude's response
- ✅ **Context Tracking** - Automatic transaction IDs, prompt IDs, git metadata, and parent session tracking
- ✅ **Failure Queue** - Sequential event processing with automatic retry (FIFO)
- ✅ **Transcript Access** - Built-in utilities for parsing and searching conversation history
- ✅ **Plugin System** - Extensible architecture for custom integrations
- ✅ **Async/Await Support** - Full async handler support for API calls, database queries, etc.
- 🆕 **Transform Utilities** - Conversation logging, file tracking, todo monitoring, AI summaries

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Built-in Event Logging](#built-in-event-logging)
- [Edit Tracking](#edit-tracking)
- [Context Tracking](#context-tracking-event-correlation)
- [Non-Blocking Error Handling](#non-blocking-error-handling)
- [Failure Queue](#failure-queue)
- [API Reference](#api-reference)
- [Documentation](#documentation)
- [Examples](#examples)
- [Contributing](#contributing)

## Installation

### Method 1: npm Package (For Developers)

Install the SDK to build custom hooks:

```bash
npm install claude-hooks-sdk
# or
bun add claude-hooks-sdk
```

### Method 2: Claude Code Plugin (For Ready-to-Use Examples + Expert Skill)

Install pre-built example hooks and comprehensive SDK skill via the Claude Code marketplace:

```bash
# Add the marketplace
/plugin marketplace add hgeldenhuys/claude-hooks-sdk

# Install the plugin (includes examples + skill)
/plugin install claude-hooks-sdk-examples
```

**What you get:**

📚 **Expert Skill** - Makes Claude Code self-aware of the SDK:
```bash
/skill claude-hooks-sdk
# Now Claude can answer: "How do I enable edit tracking?"
# "Show me a blocking hook example", etc.
```

🔌 **Production-Ready Hooks:**
- **event-logger** - Full-featured event logging with edit tracking
- **failure-queue-demo** - Automatic retry queue demonstration
- **edit-tracking** - Track files modified by Claude
- **non-blocking** - Non-blocking error handling example

## Quick Start

Create a hook file (e.g., `.claude/hooks/my-hook.ts`):

```typescript
#!/usr/bin/env bun
import { HookManager, success, block } from 'claude-hooks-sdk';

const manager = new HookManager({
  logEvents: true,          // Enable automatic event logging
  clientId: 'my-hook',      // Organize logs by client
});

// Block dangerous bash commands
manager.onPreToolUse(async (input) => {
  if (input.tool_name === 'Bash' && input.tool_input.command.includes('rm -rf /')) {
    return block('Dangerous command detected!');
  }
  return success();
});

// Log session starts
manager.onSessionStart(async (input) => {
  console.log(`Session started: ${input.session_id}`);
  return success();
});

manager.run();
```

**That's it!** Events are automatically logged to `.claude/hooks/my-hook/logs/events.jsonl`

Register the hook in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/my-hook.ts"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/my-hook.ts"
          }
        ]
      }
    ]
  }
}
```

## Transform Utilities

**NEW**: Convenient transform utilities for common hook patterns.

The SDK now includes powerful transform utilities that make it easy to implement common logging and analytics patterns. These are production-ready and can be used in backend services.

### Available Transforms

1. **ConversationLogger** - Track conversation turns with user prompts and assistant responses
2. **FileChangeTracker** - Monitor file modifications from Write/Edit/MultiEdit tools
3. **TodoTracker** - Track todo items and progress
4. **AISummarizer** - Auto-summarize Stop events using Claude Haiku

### Quick Start with Transforms

```typescript
import {
  HookManager,
  success,
  ConversationLogger,
  FileChangeTracker,
  TodoTracker,
} from 'claude-hooks-sdk';

const conversationLogger = new ConversationLogger();
const fileTracker = new FileChangeTracker();
const todoTracker = new TodoTracker();

const manager = new HookManager();

manager
  .onUserPromptSubmit((input) => {
    conversationLogger.recordUserPrompt(input);
    return success();
  })
  .onPreToolUse((input) => {
    conversationLogger.recordToolUse(input.tool_name);
    return success();
  })
  .onPostToolUse((input) => {
    fileTracker.recordChange(input);
    todoTracker.recordTodoWrite(input);
    return success();
  })
  .onStop(async (input, context) => {
    // Get all transform data
    const turn = await conversationLogger.recordStop(input, context);
    const files = fileTracker.getBatch(input.session_id);
    const todos = todoTracker.getSnapshot(input.session_id);

    console.log('Conversation Turn:', turn.turn_number);
    console.log('Files Modified:', files.total_files);
    console.log('Todo Progress:', todoTracker.getCompletionPercentage(input.session_id) + '%');

    return success();
  });

manager.run();
```

### Example Output

**Conversation Turn:**
```json
{
  "assistant": {
    "content": "I'll help you implement that feature...",
    "timestamp": "2025-11-21T23:00:00.000Z",
    "toolsUsed": ["Read", "Edit", "TodoWrite"]
  },
  "user_prompts": [
    { "text": "Can you add error handling?", "timestamp": "..." }
  ],
  "turn_number": 5,
  "session_id": "abc123"
}
```

**File Changes:**
```json
{
  "file": "src/utils/api.ts",
  "operation": "modified",
  "tool": "Edit",
  "timestamp": "2025-11-21T23:00:00.000Z",
  "session_id": "abc123",
  "size_hint": 1234
}
```

**Todo Progress:**
```json
{
  "event_type": "todos_updated",
  "todos": [...],
  "completed": 3,
  "in_progress": 1,
  "pending": 2,
  "timestamp": "2025-11-21T23:00:00.000Z"
}
```

**AI Summary (requires ANTHROPIC_API_KEY):**
```json
{
  "summary": "Added error handling to API utility functions",
  "model": "claude-haiku-3-5-20241022",
  "input_tokens": 125,
  "output_tokens": 12,
  "timestamp": "2025-11-21T23:00:00.000Z"
}
```

### Complete Examples

See [`examples/transforms/`](./examples/transforms/) for complete working examples:

- **conversation-logger.ts** - Chat-style logging
- **file-changes-logger.ts** - File modification tracking
- **todo-logger.ts** - Todo progress monitoring
- **ai-summarizer.ts** - Automatic Stop event summaries
- **all-transforms.ts** - All transforms combined

### Transform API Reference

#### ConversationLogger

```typescript
const logger = new ConversationLogger();

// Record events
logger.recordUserPrompt(input);
logger.recordToolUse(toolName);
const turn = await logger.recordStop(input, context);

// Utilities
logger.getTurnNumber(); // Current turn number
logger.reset(); // Reset state
```

#### FileChangeTracker

```typescript
const tracker = new FileChangeTracker();

// Record changes
const change = tracker.recordChange(input);

// Get data
const batch = tracker.getBatch(sessionId);
const files = tracker.getUniqueFiles(sessionId);
const count = tracker.getFileModificationCount(sessionId, filePath);

// Cleanup
tracker.clearSession(sessionId);
```

#### TodoTracker

```typescript
const tracker = new TodoTracker();

// Record todos
const event = tracker.recordTodoWrite(input);

// Get data
const snapshot = tracker.getSnapshot(sessionId);
const inProgress = tracker.getTodosByStatus(sessionId, 'in_progress');
const pct = tracker.getCompletionPercentage(sessionId);

// Cleanup
tracker.clearSession(sessionId);
```

#### AISummarizer

```typescript
const summarizer = new AISummarizer({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-haiku-3-5-20241022',
});

// Generate summaries
const summary = await summarizer.summarizeStop(input, context);

// Custom prompts
const custom = await summarizer.summarizeWithPrompt(
  content,
  'Summarize: {content}',
  sessionId
);

// Utilities
summarizer.getTurnNumber(); // Current turn
summarizer.reset(); // Reset counter
```

### Production Usage

```typescript
manager.onStop(async (input, context) => {
  const turn = await conversationLogger.recordStop(input, context);
  const files = fileTracker.getBatch(input.session_id);
  const todos = todoTracker.getSnapshot(input.session_id);

  // Send to your analytics backend
  await fetch('https://api.example.com/sessions/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'stop',
      conversation: turn,
      files,
      todos,
      timestamp: new Date().toISOString(),
    }),
  });

  return success();
});
```

## Built-in Event Logging

The SDK includes automatic event logging - just enable it with a flag!

```typescript
const manager = new HookManager({
  logEvents: true,              // Enable logging
  clientId: 'my-extension',     // Organize by client
  // logDir: '/custom/path',    // Optional: custom directory
});
```

**Logs are saved to:** `$CLAUDE_PROJECT_DIR/.claude/hooks/{clientId}/logs/events.jsonl`
(Falls back to current directory if `CLAUDE_PROJECT_DIR` not set)

**Each log entry contains:**
```json
{
  "input": {
    "hook": {                    // Full hook event
      "hook_event_name": "PreToolUse",
      "session_id": "...",
      "tool_name": "Read",
      "tool_input": {...}
    },
    "conversation": {            // Last transcript line
      "type": "user",
      "message": {...}
    },
    "context": {                 // Event correlation context
      "transactionId": "tx_...",
      "conversationId": "...",
      "project_dir": "/path/to/project",
      "promptId": "prompt_...",
      "git": {...}
    },
    "timestamp": "2025-11-21T..."
  },
  "output": {                    // What your handler returned
    "exitCode": 0,
    "success": true,
    "hasOutput": false,
    "hasStdout": false,
    "hasStderr": false
  }
}
```

**View logs:**
```bash
# From project root (uses CLAUDE_PROJECT_DIR)
tail -f .claude/hooks/my-extension/logs/events.jsonl | jq .

# All events
cat .claude/hooks/my-extension/logs/events.jsonl | jq .

# Filter by event type
cat .claude/hooks/my-extension/logs/events.jsonl | jq 'select(.input.hook.hook_event_name == "PreToolUse")'

# View just context
tail -f .claude/hooks/my-extension/logs/events.jsonl | jq '.input.context'

# View event summary
cat .claude/hooks/my-extension/logs/events.jsonl | jq -c '{event: .input.hook.hook_event_name, tool: .input.hook.tool_name, tx: .input.context.transactionId}'
```

---

## Edit Tracking

**Track all files modified during Claude's response!**

Enable with one flag to automatically collect all files edited via the Edit tool:

```typescript
const manager = new HookManager({
  trackEdits: true,  // ← Enable edit tracking
  logEvents: true
});

manager.onStop(async (input) => {
  const editedFiles = (input as any).context?.editedFiles;

  if (editedFiles) {
    console.log(`Files edited: ${editedFiles.length}`);
    editedFiles.forEach(file => console.log(`  - ${file}`));

    // Auto-commit changed files
    execSync(`git add ${editedFiles.join(' ')}`);
    execSync(`git commit -m "Claude edits"`);
  }

  return success();
});
```

**Result in Stop event:**
```json
{
  "context": {
    "transactionId": "tx_...",
    "editedFiles": [
      "/project/src/app.ts",
      "/project/src/utils.ts"
    ]
  }
}
```

**Use cases:**
- Auto-commit changed files
- Run tests on modified files only
- Slack notifications for large changesets
- Code review workflows
- Lint only changed files

See [docs/guides/EDIT-TRACKING.md](./docs/guides/EDIT-TRACKING.md) for complete documentation.

---

## Context Tracking (Event Correlation)

**Enabled by default** - All events are automatically enriched with correlation context!

### What's Tracked

Every hook event gets enriched with:

```typescript
{
  hook_event_name: "PreToolUse",
  // ... normal event fields ...
  context: {
    transactionId: "tx_1234567890_abc123def",  // Persists across session
    conversationId: "session-uuid",             // Session identifier
    promptId: "prompt_1234567890",              // Last prompt ID
    project_dir: "/path/to/project",            // CLAUDE_PROJECT_DIR environment variable
    git: {                                      // Git repository metadata
      user: "John Doe",
      email: "john@example.com",
      repo: "https://github.com/user/repo.git",
      branch: "main",
      commit: "abc1234...",
      dirty: false                              // Has uncommitted changes?
    }
  }
}
```

### Transaction ID Lifecycle

```
SessionStart  → Generate new transaction ID
                ↓
All Events    → Same transaction ID (correlation!)
                ↓
SessionEnd    → Clear context
```

### Usage Example

```typescript
const manager = new HookManager({
  enableContextTracking: true,  // Default: true
  clientId: 'my-hook',
});

manager.onPreToolUse(async (input: any) => {
  console.log(`Transaction: ${input.context.transactionId}`);
  console.log(`Prompt: ${input.context.promptId}`);
  console.log(`Git Branch: ${input.context.git?.branch}`);

  // Send to analytics with correlation
  await analytics.track({
    event: 'tool_use',
    transactionId: input.context.transactionId,
    promptId: input.context.promptId,
    tool: input.tool_name,
  });

  return success();
});
```

### Benefits

- **Event Correlation**: Link all events in a session with same transaction ID
- **Prompt Tracking**: Know which prompt triggered which tool uses
- **Git Context**: Track which branch/commit events occurred on
- **Parent-Child Tracking**: Subagent events include `parentSessionId` and `agentId`

---

## Non-Blocking Error Handling

**By default, hook failures DON'T block Claude Code!**

This is critical for reliability - a failed API call or network timeout shouldn't freeze your session.

```typescript
const manager = new HookManager({
  blockOnFailure: false,  // Default: non-blocking
  enableFailureQueue: true,
  maxRetries: 3
});

manager.onPreToolUse(async (input) => {
  // If this fails, Claude Code continues normally
  await fetch('https://analytics.com/track', {
    method: 'POST',
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(5000)
  });

  return success();
});
```

**What happens when handler fails:**

| Mode | Exit Code | Claude Code | Queue | User Impact |
|------|-----------|-------------|-------|-------------|
| **Non-Blocking** (default) | 0 (success) | Continues | Event queued for retry | None ✅ |
| **Blocking** (opt-in) | 1 (error) | Blocked | No queue | Error shown ❌ |

**Use non-blocking for:**
- Analytics/telemetry
- Logging services
- Notifications (Slack, Discord)
- Metrics (Datadog, Prometheus)
- Non-critical API calls

**Use blocking for:**
- Security enforcement
- Access control
- Critical validation
- Compliance checks

See [docs/guides/NON-BLOCKING-HOOKS.md](./docs/guides/NON-BLOCKING-HOOKS.md) for complete documentation.
- **Analytics Ready**: Perfect for sending to analytics platforms
- **Debugging**: Easily trace event chains

### Disabling Context Tracking

```typescript
const manager = new HookManager({
  enableContextTracking: false,  // Disable if not needed
});
```

---

## Failure Queue (Sequential Event Processing)

The SDK includes a built-in failure queue for resilient, sequential event processing. When enabled, failed events are automatically queued and retried, ensuring FIFO (First-In-First-Out) ordering.

### Why Use the Failure Queue?

- **Guaranteed Ordering**: Events are processed sequentially - if one fails, subsequent events wait
- **Automatic Retry**: Failed events retry automatically with configurable max attempts
- **No Lost Events**: Failures are persisted to disk and survive restarts
- **Consumer Notifications**: Get notified when the queue has items waiting

### Basic Usage

```typescript
const manager = new HookManager({
  enableFailureQueue: true,        // Enable the queue
  clientId: 'my-extension',        // Required for queue organization
  maxRetries: 3,                   // Max retry attempts (default: 3)

  // Optional: get notified when queue has items
  onErrorQueueNotEmpty: async (queueSize, failedEvents) => {
    console.log(`⚠️ ${queueSize} events in error queue`);
    // Could trigger a notification, log to monitoring, etc.
  }
});

manager.onPreToolUse(async (input) => {
  // If this handler fails (returns exitCode !== 0 or throws),
  // the event is automatically added to the error queue
  const result = await processEvent(input);

  if (!result.success) {
    return error('Processing failed, will retry');
  }

  return success();
});

manager.run();
```

### How It Works

**Every hook event automatically drains the queue first (FIFO order):**

1. **Hook Event Arrives** → Check if queue has events
2. **Queue Not Empty?** → Drain queue synchronously:
   - Call `onErrorQueueNotEmpty` callback
   - Retry all queued events in FIFO order
   - Successfully processed events removed from queue
   - Still-failing events remain (retry count incremented)
3. **Queue Still Not Empty After Drain?** → Queue the new event, return success
4. **Queue Empty?** → Process the new event
5. **New Event Fails?** → Add to queue for next hook event

### Error Queue File Format

Failed events are saved to `$CLAUDE_PROJECT_DIR/.claude/hooks/{clientId}/error-queue.jsonl`:

```json
{"event": {...}, "error": "Connection timeout", "timestamp": "2025-11-21T...", "retryCount": 0}
{"event": {...}, "error": "API rate limit", "timestamp": "2025-11-21T...", "retryCount": 1}
```

### Automatic Queue Draining

**The queue is automatically drained on every hook event - no cron jobs needed!**

When a hook event arrives:
1. SDK checks if queue has items
2. If yes, drain queue synchronously (retry all events in FIFO order)
3. Successfully processed events removed
4. Still-failing events remain (retry count incremented)
5. If queue still has items after draining, queue the new event
6. If queue is empty, process the new event

### Queue Behavior

- **FIFO Order**: Events always processed in order they failed
- **Automatic Retry**: Every hook event triggers drain attempt
- **Retry Limit**: After `maxRetries`, events are dropped
- **No External Jobs**: No cron jobs or background workers needed

### Optional: Manual Queue Inspection

For monitoring or debugging:

```typescript
// Check queue status (optional)
const status = manager.getQueueStatus();
console.log(`Queue has ${status.size} events`);

// Manually drain if needed (optional - normally automatic)
const result = await manager.drainQueue();
console.log(`Processed: ${result.processed}`);
```

### Use Cases

- **API Integrations**: Retry failed API calls without losing events
- **Database Operations**: Ensure all events are persisted even during outages
- **External Services**: Queue events when external service is down
- **Rate Limiting**: Respect rate limits by queuing excess events

**📖 For detailed documentation, see [docs/guides/FAILURE-QUEUE.md](./docs/guides/FAILURE-QUEUE.md)**

---

## API Reference

### HookManager

The main class for registering and executing hook handlers.

```typescript
const manager = new HookManager(options?: HookManagerOptions);
```

**Options:**
```typescript
interface HookManagerOptions {
  debug?: boolean;          // Enable debug output
  logEvents?: boolean;      // Enable event logging
  clientId?: string;        // Client ID for organizing logs
  logDir?: string;          // Custom log directory

  // Failure Queue Options
  enableFailureQueue?: boolean;  // Enable sequential event processing with retry
  maxRetries?: number;           // Max retry attempts (default: 3)
  onErrorQueueNotEmpty?: (       // Callback when queue has items
    queueSize: number,
    failedEvents: FailedEvent[]
  ) => Promise<void> | void;
}
```

#### Methods

**Event Handlers:**
- `onPreToolUse(handler)` - Before tool execution
- `onPostToolUse(handler)` - After tool execution
- `onNotification(handler)` - On Claude notifications
- `onUserPromptSubmit(handler)` - Before processing user input
- `onStop(handler)` - When main agent finishes
- `onSubagentStop(handler)` - When subagent completes
- `onPreCompact(handler)` - Before context compaction
- `onSessionStart(handler)` - Session lifecycle start
- `onSessionEnd(handler)` - Session lifecycle end

**Execution:**
- `run()` - Execute handlers (reads stdin, writes stdout/stderr)
- `execute(input)` - Manually execute handlers (advanced usage)

**Plugins:**
- `use(plugin)` - Register a plugin to extend functionality

**Failure Queue (Optional - queue drains automatically):**
- `drainQueue()` - Manually drain queue (optional), returns `{ processed, remaining, dropped }`
- `getQueueStatus()` - Inspect queue status, returns `{ size, events }`

### Handler Response Helpers

```typescript
import { success, block, error } from 'claude-hooks-sdk';

// Allow execution to continue
return success();

// Block execution (PreToolUse only)
return block('Reason for blocking');

// Return error (non-blocking)
return error('Error message');

// Custom response
return {
  exitCode: 0,  // 0 = success, 2 = blocking error
  stdout: 'Message to Claude',
  output: {
    continue: true,
    // ... hook-specific fields
  }
};
```

### Hook Context

Each handler receives a `context` object with transcript utilities:

```typescript
manager.onSessionStart(async (input, context) => {
  // Get a specific transcript line
  const line = await context.getTranscriptLine(42);

  // Get full transcript
  const transcript = await context.getFullTranscript();

  // Search transcript
  const matches = await context.searchTranscript(line =>
    line.content?.role === 'user'
  );

  return success();
});
```

### Plugin System

Create custom plugins to extend functionality:

```typescript
import { HookPlugin } from 'claude-hooks-sdk';

const myPlugin: HookPlugin = {
  name: 'my-plugin',

  async onBeforeExecute(input, context) {
    // Called before handlers execute
    console.log(`Event: ${input.hook_event_name}`);
  },

  async onAfterExecute(input, result, context) {
    // Called after handlers execute
    if (result.exitCode !== 0) {
      console.error('Handler failed');
    }
  }
};

manager.use(myPlugin);
```

## Documentation

### 🧠 Interactive Skill (Recommended)

Install the **claude-hooks-sdk skill** for interactive guidance:

```bash
/plugin marketplace add hgeldenhuys/claude-hooks-sdk
/plugin install claude-hooks-sdk-examples
/skill claude-hooks-sdk
```

The skill makes Claude Code self-aware of the SDK - ask questions like:
- "How do I enable edit tracking?"
- "Show me a blocking hook example"
- "Why aren't my logs appearing?"

### 📚 Written Guides

Comprehensive guides and references in the [`docs/`](./docs/) directory:

#### Feature Guides
- **[Edit Tracking](./docs/guides/EDIT-TRACKING.md)** - Automatically track files modified by Claude
- **[Non-Blocking Hooks](./docs/guides/NON-BLOCKING-HOOKS.md)** - Error handling that doesn't block Claude Code
- **[Failure Queue](./docs/guides/FAILURE-QUEUE.md)** - Sequential event processing with automatic retry
- **[Repo Instance ID](./docs/guides/REPO-INSTANCE-ID.md)** - Unique ID for each repo checkout

### 📖 Reference
- **[Schema Discoveries](./docs/reference/SCHEMA_DISCOVERIES.md)** - Undocumented Claude Code schema fields
- **[Publication Checklist](./docs/reference/PUBLICATION-CHECKLIST.md)** - Pre-publication verification

### 🚀 Releases
- **[v0.4.1 Release Notes](./docs/releases/v0.4.1-SUMMARY.md)** - Latest release overview
- **[v0.4.1 Bug Fixes](./docs/releases/BUG-FIXES-v0.4.1.md)** - Detailed bug fix documentation

See the **[Documentation Index](./docs/README.md)** for complete list.

## Examples

Complete working examples in [`sample-extension/`](./sample-extension/):
- **[event-logger-v2.ts](./sample-extension/event-logger-v2.ts)** - Production-ready event logger

### Security Validation

```typescript
manager.onPreToolUse(async (input) => {
  if (input.tool_name !== 'Bash') {
    return success();
  }

  const command = input.tool_input.command;

  // Block dangerous patterns
  if (/rm\s+-rf\s+\//.test(command)) {
    return block('Dangerous command: rm -rf /');
  }

  // Warn about sudo
  if (command.includes('sudo')) {
    return {
      exitCode: 0,
      output: {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: 'Requires elevated privileges'
        }
      }
    };
  }

  return success();
});
```

### API Integration Plugin

```typescript
const apiPlugin: HookPlugin = {
  name: 'api-logger',
  async onAfterExecute(input, result) {
    await fetch('https://my-api.com/hooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: input.hook_event_name,
        sessionId: input.session_id,
        timestamp: new Date().toISOString(),
        success: result.exitCode === 0
      })
    });
  }
};

manager.use(apiPlugin);
```

### Context Injection

```typescript
manager.onUserPromptSubmit(async (input) => {
  return {
    exitCode: 0,
    stdout: `
Current time: ${new Date().toISOString()}
Working directory: ${input.cwd}
Session: ${input.session_id}
    `.trim(),
    output: { continue: true }
  };
});
```

### Transcript Analysis

```typescript
manager.onStop(async (input, context) => {
  const transcript = await context.getFullTranscript();

  // Count tool uses
  const toolUses = transcript.filter(line =>
    line.content?.type === 'tool_use'
  );

  console.log(`Session used ${toolUses.length} tools`);

  return success();
});
```

## Type Definitions

All hook events are fully typed:

```typescript
import type {
  // Input types
  PreToolUseInput,
  PostToolUseInput,
  SessionStartInput,
  // ... all other events

  // Output types
  PreToolUseOutput,
  PostToolUseOutput,
  // ...

  // Context
  HookContext,
  TranscriptLine,
} from 'claude-hooks-sdk';
```

## Hook Events

| Event | When It Fires | Common Use Cases |
|-------|---------------|------------------|
| `PreToolUse` | Before tool execution | Validation, blocking, security |
| `PostToolUse` | After tool completion | Formatting, testing, logging |
| `Notification` | On Claude notifications | Custom notifications |
| `UserPromptSubmit` | Before processing input | Context injection, validation |
| `Stop` | Agent finishes responding | Cleanup, analytics |
| `SubagentStop` | Subagent completes | Delegation tracking |
| `PreCompact` | Before context compaction | State preservation |
| `SessionStart` | Session begins | Initialization, setup |
| `SessionEnd` | Session terminates | Cleanup, reporting |

## Advanced Usage

### Multiple Handlers

You can register multiple handlers for the same event:

```typescript
manager
  .onPreToolUse(validateSecurity)
  .onPreToolUse(logToolUse)
  .onPreToolUse(checkRateLimit);
```

Handlers execute in registration order and can stop the chain by returning `exitCode: 2`.

### Conditional Execution

```typescript
manager.onPostToolUse(async (input) => {
  // Only process Write tool
  if (input.tool_name !== 'Write') {
    return success();
  }

  const filePath = input.tool_input.file_path;

  // Format TypeScript files
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    await formatFile(filePath);
  }

  return success();
});
```

### Error Handling

```typescript
manager.onSessionStart(async (input) => {
  try {
    await initializeServices();
    return success();
  } catch (err) {
    return error(`Initialization failed: ${err.message}`);
  }
});
```

## Development

```bash
# Install dependencies
bun install

# Build
bun run build

# Type check
bun run typecheck

# Run examples
bun examples/basic-hook.ts
```

## License

MIT © hgeldenhuys

## Contributing

Contributions welcome! Please read our [contributing guidelines](CONTRIBUTING.md) first.

## Resources

- [Claude Code Documentation](https://code.claude.com/docs)
- [Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Examples](./examples)

## Related Projects

This is the standalone, zero-dependency version of the SDK. For platform-specific integrations, check the repository for additional tooling.
