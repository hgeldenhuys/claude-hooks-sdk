# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**claude-hooks-sdk** is a type-safe TypeScript SDK for building Claude Code hook extensions. It provides a fluent API for registering event handlers, automatic context tracking, edit tracking, failure queues, and transform utilities for common patterns like conversation logging and file change tracking.

## Development Commands

### Build & Test
```bash
bun run build          # Compile TypeScript to ./dist
bun run typecheck      # Type check without emitting files
bun test               # Run test suite
```

### Development Workflow
```bash
bun install            # Install dependencies
bun run build          # Build before publishing
```

### Testing Hooks
```bash
# Test a hook directly (reads JSON from stdin)
bun examples/basic-hook.ts

# Test with actual Claude Code event
echo '{"hook_event_name":"SessionStart","session_id":"test",...}' | bun test-hook.ts
```

## Architecture

### Core Components

#### 1. **HookManager** (`src/manager.ts`)
The central orchestrator for hook execution. Key responsibilities:
- Registers handlers via fluent API (`onPreToolUse()`, `onStop()`, etc.)
- Reads stdin, executes handlers, writes to stdout/stderr
- Manages event logging to `.claude/hooks/{clientId}/logs/events.jsonl`
- Implements failure queue for sequential FIFO retry with `error-queue.jsonl`
- Coordinates edit tracking across UserPromptSubmit → PostToolUse → Stop lifecycle
- Integrates ContextTracker and SessionNamer

**Non-blocking by default**: Handler failures don't block Claude Code unless `blockOnFailure: true` is set. Failed events go to the failure queue for automatic retry.

#### 2. **ContextTracker** (`src/context-tracker.ts`)
Enriches all events with correlation metadata:
- `transactionId`: Persists across session, generated on SessionStart
- `promptId`: Timestamp-based ID for each user prompt
- `git`: Branch, commit, repo, dirty state, repoInstanceId
- `project_dir`: From `CLAUDE_PROJECT_DIR` environment variable

All enrichment happens in `manager.ts` via `contextTracker.enrichEvent(input)`.

#### 3. **SessionNamer** (`src/session-namer.ts`)
Generates human-friendly session names (e.g., "brave-elephant") and maintains bidirectional lookup in `.claude/sessions.json`. Names are auto-populated in SessionStart events as `session_name` field.

#### 4. **Transform Utilities** (`src/transforms/`)
Production-ready utilities for common hook patterns:
- **ConversationLogger**: Tracks user prompts and assistant responses between Stop events
- **FileChangeTracker**: Monitors Write/Edit/MultiEdit operations
- **TodoTracker**: Extracts and monitors TodoWrite events with progress tracking
- **AISummarizer**: Auto-summarizes Stop events using Claude Haiku API

#### 5. **Advanced Features** (v0.7.0+)
- **PersistentState** (`src/persistent-state.ts`): SQLite/file/memory storage
- **SessionAnalytics** (`src/session-analytics.ts`): Cost tracking, token usage, performance metrics
- **EventRecorder/Replayer** (`src/event-recorder.ts`, `src/event-replayer.ts`): Record sessions to JSONL and replay
- **EventStreamer** (`src/event-streamer.ts`): SSE-based real-time streaming
- **Middleware** (`src/middleware.ts`): Rate limiting, deduplication, PII redaction
- **AnomalyDetector** (`src/anomaly-detector.ts`): Error spikes, token anomalies, response time issues

### Type System (`src/types.ts`)

All 9 hook events are fully typed:
- Input types: `PreToolUseInput`, `PostToolUseInput`, `StopInput`, etc.
- Output types: `PreToolUseOutput`, `PostToolUseOutput`, `StopOutput`, etc.
- `EnrichedContext`: Optional context added by ContextTracker

Type guards available: `isPreToolUse()`, `isStop()`, etc.

### Edit Tracking Flow

When `trackEdits: true` is enabled in HookManager options:

1. **UserPromptSubmit**: Set `trackingEdits = true`, clear `editedFiles` set
2. **PostToolUse**: If tool is Edit/Write/MultiEdit, add file paths to `editedFiles` set
3. **Stop**: Add `editedFiles` array to event context, reset tracking state

The tracked files appear in Stop events as `context.editedFiles`.

### Failure Queue (Sequential Event Processing)

When `enableFailureQueue: true`:

1. Every hook event checks if error queue has items
2. If queue not empty, drain queue first (FIFO order) up to `maxQueueDrainPerEvent` (default: 10)
3. If queue still has items after drain, queue the new event and exit
4. If queue empty, process the new event
5. If new event fails, add to queue with retry count

Failed events in `error-queue.jsonl` format:
```json
{"event": {...}, "error": "...", "timestamp": "...", "retryCount": 0}
```

Events are dropped after `maxRetries` (default: 3) attempts.

### Plugin System

Plugins extend HookManager via `onBeforeExecute` and `onAfterExecute` lifecycle hooks. Plugins run before/after all handlers and receive the full input, result, context, and last conversation line.

Example: `examples/plugin-example.ts`

## Directory Structure

```
src/
├── index.ts              # Main exports
├── manager.ts            # Core HookManager class
├── types.ts              # Type definitions for all hook events
├── context-tracker.ts    # Transaction ID, git metadata, prompt tracking
├── session-namer.ts      # Human-friendly session names
├── userPromptSubmit.ts   # Helper for session context injection
├── event-enricher.ts     # Utilities to enrich events with git/transcript context
├── transcript.ts         # Transcript parsing utilities
├── utils.ts              # success(), block(), error() helpers
├── transforms/           # Transform utilities
│   ├── conversation.ts   # ConversationLogger
│   ├── file-tracker.ts   # FileChangeTracker
│   ├── todo-tracker.ts   # TodoTracker
│   ├── ai-summary.ts     # AISummarizer
│   └── index.ts          # Transform exports
├── persistent-state.ts   # Durable state management
├── session-analytics.ts  # Cost/token tracking
├── event-recorder.ts     # Record sessions to JSONL
├── event-replayer.ts     # Replay recorded sessions
├── event-streamer.ts     # SSE streaming
├── middleware.ts         # Composable middleware
└── anomaly-detector.ts   # Pattern detection

tests/                    # Bun test files
examples/                 # Working examples
sample-extension/         # Production-ready examples
.claude-plugin/           # Plugin definitions for Claude Code marketplace
docs/                     # Comprehensive guides and references
```

## Key Patterns

### Creating a Hook

```typescript
import { HookManager, success, block } from 'claude-hooks-sdk';

const manager = new HookManager({
  logEvents: true,          // Enable event logging
  clientId: 'my-hook',      // Organize logs by client
  trackEdits: true,         // Track file edits
  enableFailureQueue: true, // Enable retry queue
  maxRetries: 3,
});

manager.onPreToolUse(async (input) => {
  if (input.tool_name === 'Bash' && input.tool_input.command.includes('rm -rf /')) {
    return block('Dangerous command detected!');
  }
  return success();
});

manager.run();
```

### Using Transforms

```typescript
import { ConversationLogger, FileChangeTracker } from 'claude-hooks-sdk';

const conversationLogger = new ConversationLogger();
const fileTracker = new FileChangeTracker();

manager
  .onUserPromptSubmit((input) => {
    conversationLogger.recordUserPrompt(input);
    return success();
  })
  .onPostToolUse((input) => {
    fileTracker.recordChange(input);
    return success();
  })
  .onStop(async (input, context) => {
    const turn = await conversationLogger.recordStop(input, context);
    const files = fileTracker.getBatch(input.session_id);
    console.log('Turn:', turn.turn_number, 'Files:', files.total_files);
    return success();
  });
```

### Session Context Injection

```typescript
import { createUserPromptSubmitHook } from 'claude-hooks-sdk';

// ONE-LINE helper - automatically injects session info into Claude's context
createUserPromptSubmitHook();
```

This saves 50-100+ tokens per request by making session ID and name instantly available to Claude without tool calls.

## Testing

Tests are located in `tests/` and use Bun's test runner:

```bash
bun test                           # Run all tests
bun test tests/session-namer.test.ts  # Run specific test
```

## Important Notes

### Context Enrichment
- Always enabled by default (`enableContextTracking: true`)
- Also automatically enabled when `trackEdits: true` (editedFiles needs context)
- Happens in `manager.ts` via `contextTracker.enrichEvent(input)` before handlers execute
- Avoid double enrichment by enriching only once in the execution pipeline

### Edit Tracking
- Must set `trackEdits: true` in HookManager options
- Requires tracking across 3 event types: UserPromptSubmit, PostToolUse, Stop
- Files are stored in a Set during the tracking window to deduplicate

### Failure Queue
- Events are ALWAYS drained before processing new events (FIFO order)
- Queue draining is limited by `maxQueueDrainPerEvent` (default: 10) to prevent blocking
- If queue still has items after drain, new event is queued
- Use `autoDrainQueue: false` to disable automatic draining

### Non-blocking Error Handling
- Default behavior: Handler failures don't block Claude Code (exit code 0)
- Set `blockOnFailure: true` to make failures blocking (exit code 1)
- Non-blocking failures are logged and added to failure queue if enabled

### Session Naming
- Always enabled, no configuration needed
- Names generated on SessionStart and persisted to `.claude/sessions.json`
- Use `getSessionName(sessionId)` or `getSessionId(name)` for lookup
- Manual renames supported via `renameSession()`

### Plugin Development
- Plugins run before/after handlers but failures don't crash the hook
- Plugins receive enriched context and last conversation line
- Use for analytics, logging, notifications, or custom integrations

## Publishing Checklist

Before publishing, ensure:
1. Version bumped in `package.json`
2. `CHANGELOG.md` updated
3. `bun run build` succeeds
4. `bun test` passes
5. Types are exported from `src/index.ts`
6. README examples are current

See `PUBLISHING.md` for detailed publication workflow.
