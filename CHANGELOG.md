# Changelog

All notable changes to the claude-hooks-sdk will be documented in this file.

## [0.4.1] - 2025-11-21

### Fixed

**🐛 Critical Bug Fixes from Agent Review**

1. **Type Safety for editedFiles** - No TypeScript types for enriched context fields
   - Added `EnrichedContext` interface with all context fields
   - Added `EnrichedHookInput` base type for type-safe access
   - `StopInput` and `SubagentStopInput` now extend `EnrichedHookInput`
   - No more `(input as any).context` type assertions needed!

2. **No Timeout Support** - Handlers could hang indefinitely
   - Added `handlerTimeout` option (default: 30000ms / 30 seconds)
   - Handlers that exceed timeout are terminated with error
   - Set to 0 to disable timeout
   - Prevents stuck hooks from blocking Claude Code

3. **No Control Over Auto-Drain** - Queue draining was always automatic
   - Added `autoDrainQueue` option (default: true)
   - When false, queue draining must be done manually via `drainQueue()`
   - Gives consumers control over when draining happens

4. **Double Enrichment Bug** - Events were being enriched twice (in both `run()` and `execute()` methods)
   - Removed enrichment from `run()` method
   - Context enrichment now only happens in `execute()` method
   - Prevents duplicate context fields and potential data corruption

5. **Blocking Queue Drain** - Queue draining could block for minutes with many failed events
   - Added `maxQueueDrainPerEvent` option (default: 10)
   - Limits number of events drained per hook invocation
   - Prevents long-running operations from blocking Claude Code

6. **Limited Edit Tracking** - Only tracked `Edit` tool, ignored `Write` and `MultiEdit`
   - Now tracks `Edit`, `Write`, and `MultiEdit` tools
   - `Write` tool: Tracks newly created files
   - `MultiEdit` tool: Tracks all files in edits array
   - More complete file modification tracking

7. **No Plugin Error Handling** - Plugin failures could crash entire hook
   - Wrapped plugin callbacks in try/catch blocks
   - Errors logged with debug flag but don't crash hooks
   - Plugins are isolated - one failure doesn't affect others

### Added

**Type Safety**
- `EnrichedContext` interface for type-safe context access
- `EnrichedHookInput` base type with optional context field
- Full TypeScript autocomplete for all context fields

**Repo Instance ID**
- Added `git.repoInstanceId` - unique ID for each checkout/clone
- Generated once on first hook event, then persisted
- Distinguishes between different checkouts of the same repository
- Useful for analytics to track which machine/directory events came from

**New Options**

```typescript
interface HookManagerOptions {
  // NEW: Timeout for handler execution
  handlerTimeout?: number;  // Default: 30000 (30 seconds), set to 0 to disable

  // NEW: Limit queue drain to prevent blocking
  maxQueueDrainPerEvent?: number;  // Default: 10

  // NEW: Control automatic queue draining
  autoDrainQueue?: boolean;  // Default: true
}
```

**Usage Example**

```typescript
// Before (no type safety)
manager.onStop(async (input) => {
  const files = (input as any).context?.editedFiles;  // ❌
});

// After (fully typed)
manager.onStop(async (input) => {
  const files = input.context?.editedFiles;  // ✅ string[] | undefined
  //            ^? Full autocomplete!
});
```

### Breaking Changes

None! All fixes are backward compatible. Existing code works unchanged.

---

## [0.4.0] - 2025-11-21

### Added

**🎯 Edit Tracking - Automatically Track Modified Files**

- **Automatic File Tracking**: Tracks all files edited via Edit tool between UserPromptSubmit and Stop events
- **Deduplication**: Same file edited multiple times appears once
- **Zero Configuration**: Enable with single `trackEdits: true` flag
- **Stop Event Integration**: Edited files attached to Stop event context as `editedFiles` array

#### Configuration

```typescript
const manager = new HookManager({
  trackEdits: true,  // Enable edit tracking
});
```

#### Result in Stop Event

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

#### Use Cases

- Auto-commit changed files to git
- Run tests on modified files only
- Slack notifications for large changesets
- Code review workflows
- Lint only changed files

**🎯 Non-Blocking Error Handling - Hook Failures Don't Block Claude Code**

- **Non-Blocking by Default**: Hook failures exit with code 0, Claude Code continues normally
- **Opt-In Blocking**: Set `blockOnFailure: true` for critical operations
- **Error Logging**: Failed events logged (if `debug: true`)
- **Queue Integration**: Works seamlessly with failure queue for retry

#### Configuration

```typescript
const manager = new HookManager({
  blockOnFailure: false,  // Default: non-blocking
  enableFailureQueue: true,
  maxRetries: 3
});
```

#### Behavior

| Mode | Exit Code | Claude Code | Queue | User Impact |
|------|-----------|-------------|-------|-------------|
| Non-Blocking (default) | 0 | Continues | Event queued | None ✅ |
| Blocking (opt-in) | 1 | Blocked | No queue | Error shown ❌ |

**🎯 Parent-Child Session Tracking**

- **Subagent Tracking**: SubagentStop events now include `parentSessionId` and `agentId` in context
- **Correlation**: Easy filtering of all subagent events for a specific parent session
- **Automatic Enrichment**: Works automatically when context tracking is enabled

#### Context Structure

```json
{
  "context": {
    "parentSessionId": "parent-session-id",
    "agentId": "agent-short-id"
  }
}
```

**🎯 Schema Discovery Tools**

- **analyze-schemas.ts**: Extract all schemas from actual events, compare against documented schemas
- **schema-diff.ts**: Detect schema changes over time with baseline comparison
- **Baseline Tracking**: `schemas/baseline.json` for change detection
- **Documented Discoveries**: `SCHEMA_DISCOVERIES.md` with all findings

#### Discovered Schema Differences

- `permission_mode` - Undocumented in 5 event types
- `source` - Undocumented in SessionStart (`"resume"` vs `"new"`)
- `stop_hook_active` - Undocumented safety mechanism
- `agent_id` vs `agent_name` - Documentation mismatch
- `prompt` vs `user_input` - Documentation mismatch
- `tool_response` vs `tool_output` - Documentation mismatch
- Notification event structure - Completely undocumented

### Changed

- **Context Enrichment**: Now happens in `execute()` method, not just `run()`
- **Event Logger**: Updated to use `trackEdits: true`
- **README**: Added Edit Tracking and Non-Blocking sections with examples
- **Version**: 0.3.0 → 0.4.0

### Documentation

- `EDIT-TRACKING.md`: Complete guide for edit tracking feature
- `NON-BLOCKING-HOOKS.md`: Non-blocking error handling documentation
- `SCHEMA_DISCOVERIES.md`: All discovered schema differences
- `scripts/README.md`: Schema discovery workflow guide
- Updated README with table of contents and new feature sections

### New Files

- `scripts/analyze-schemas.ts`: Schema extraction tool
- `scripts/schema-diff.ts`: Change detection tool
- `scripts/trigger-all-events.md`: Event triggering guide
- `schemas/baseline.json`: Current schema baseline
- `sample-extension/test-edit-tracking.ts`: Edit tracking test
- `sample-extension/test-non-blocking.ts`: Non-blocking test

---

## [0.3.0] - 2025-11-21

### Added

**🎯 Context Tracking - Event Correlation & Analytics**

**🎯 CLAUDE_PROJECT_DIR Support**
- Logs, error queues, and context files now use `$CLAUDE_PROJECT_DIR` as base directory
- Falls back to `process.cwd()` if environment variable not set
- All files now in project root: `$CLAUDE_PROJECT_DIR/.claude/hooks/{clientId}/`

- **Transaction IDs**: Automatically generated on SessionStart, persists across all events in session
- **Prompt ID Tracking**: Captures and propagates prompt ID from UserPromptSubmit events
- **Conversation ID**: Tracks session/conversation identifier across all events
- **Git Metadata**: Automatic collection of git user, email, repo URL, branch, commit, and dirty status
- **Event Enrichment**: All events automatically enriched with `context` field (enabled by default)

#### Context Structure

Every event now includes:
```typescript
{
  hook_event_name: "...",
  // ... normal event fields ...
  context: {
    transactionId: "tx_1234567890_abc123def",
    conversationId: "session-uuid",
    promptId: "prompt_1234567890",
    git: {
      user: "...",
      email: "...",
      repo: "...",
      branch: "...",
      commit: "...",
      dirty: boolean
    }
  }
}
```

#### New Types

- `EventContext` - Context structure added to all events
- `GitMetadata` - Git repository metadata
- `ContextTracker` - Class for managing context across events

#### Configuration

```typescript
const manager = new HookManager({
  enableContextTracking: true,  // Default: true
});
```

#### Files

- `src/context-tracker.ts` - Context tracking implementation
- `sample-extension/test-context.ts` - Working example

### Benefits

- **Event Correlation**: Link all events in a session with same transaction ID
- **Analytics Ready**: Perfect for sending to analytics platforms
- **Git Context**: Know which branch/commit events occurred on
- **Debugging**: Easily trace event chains

---

## [0.2.0] - 2025-11-21

### Added

**🎯 Failure Queue - Sequential Event Processing with Automatic Retry**

- **FIFO Queue System**: Events are processed sequentially - if one fails, subsequent events wait in queue
- **Automatic Draining**: Every hook event automatically drains the queue first - no cron jobs needed!
- **Automatic Retry**: Failed events retry automatically with configurable `maxRetries` (default: 3)
- **Queue Persistence**: Failed events saved to `.claude/hooks/{clientId}/error-queue.jsonl`
- **Consumer Notifications**: `onErrorQueueNotEmpty` callback when queue draining begins
- **Optional Manual Access**: `drainQueue()` and `getQueueStatus()` methods for monitoring

#### Configuration

```typescript
const manager = new HookManager({
  enableFailureQueue: true,        // Enable the queue
  maxRetries: 3,                   // Max retry attempts
  onErrorQueueNotEmpty: async (queueSize, failedEvents) => {
    console.log(`Queue has ${queueSize} events`);
  }
});
```

#### New Methods

- `drainQueue()`: Manually drain error queue, returns `{ processed, remaining, dropped }`
- `getQueueStatus()`: Get current queue status, returns `{ size, events }`

#### New Types

- `FailedEvent`: Interface for failed events in queue

#### Files

- `src/manager.ts`: Added queue persistence and draining logic
- `sample-extension/failure-queue-demo.ts`: Working example with simulated failures
- `sample-extension/drain-queue.ts`: Utility for manual queue draining
- `sample-extension/FAILURE-QUEUE-TEST.md`: Comprehensive testing guide
- `FAILURE-QUEUE.md`: Detailed architecture and usage documentation

### Changed

- Updated `HookManagerOptions` with failure queue options
- Updated README with failure queue section
- Version bump: 0.1.0 → 0.2.0

### Documentation

- Added comprehensive failure queue documentation
- Added testing guide with examples
- Updated API reference with new methods
- Added use case examples for API integrations, database operations, rate limiting

---

## [0.1.0] - 2025-11-21

### Initial Release

**🎉 First release of claude-hooks-sdk**

#### Features

- **Full Type Safety**: Complete TypeScript types for all 10 Claude Code hook events
- **Fluent API**: Intuitive `manager.onPreToolUse(...)` handler registration
- **Zero Dependencies**: No runtime dependencies
- **Built-in Event Logging**: Automatic event logging to `.claude/hooks/{clientId}/logs/events.jsonl`
- **Transcript Access**: Built-in utilities for parsing and searching conversation history
- **Plugin System**: Extensible architecture with lifecycle hooks
- **Simple Integration**: Works with any API or service

#### Core Components

- `HookManager`: Main class for registering and executing handlers
- Event handlers for all 10 hook types
- Response helpers: `success()`, `block()`, `error()`
- Transcript utilities: `getTranscriptLine()`, `getFullTranscript()`, `searchTranscript()`
- Plugin system with `onBeforeExecute` and `onAfterExecute` hooks

#### Files

- `src/index.ts`: Main exports
- `src/manager.ts`: HookManager implementation
- `src/types.ts`: Complete type definitions
- `src/utils.ts`: Helper functions
- `src/transcript.ts`: Transcript utilities
- `examples/`: Working examples
- `sample-extension/`: Event logger sample

#### Documentation

- `README.md`: Comprehensive documentation
- `CONTRIBUTING.md`: Development guidelines
- `LICENSE`: MIT license
- `SUMMARY.md`: Project summary
