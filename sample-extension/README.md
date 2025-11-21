# Sample Extension Examples

Real-world examples of building Claude Code hook extensions using `claude-hooks-sdk` v0.4.1.

## 📁 Files

### Production Examples

- **[event-logger-v2.ts](./event-logger-v2.ts)** - Full-featured event logger with all v0.4.1 capabilities
  - Built-in event logging
  - Edit tracking (Edit, Write, MultiEdit)
  - Repo instance ID tracking
  - Type-safe context access
  - Non-blocking error handling
  - Timeout support

- **[failure-queue-demo.ts](./failure-queue-demo.ts)** - Demonstrates automatic retry queue
- **[test-edit-tracking.ts](./test-edit-tracking.ts)** - Edit tracking example
- **[test-non-blocking.ts](./test-non-blocking.ts)** - Non-blocking error handling
- **[drain-queue.ts](./drain-queue.ts)** - Manual queue management

### Test Scripts

- **[analyze-logs.sh](./analyze-logs.sh)** - Analyze event logs
- **[test-auto-drain.sh](./test-auto-drain.sh)** - Test queue draining
- **[test-context.ts](./test-context.ts)** - Test context tracking
- **[test-max-retries.ts](./test-max-retries.ts)** - Test retry limits

## 🚀 Quick Start

### 1. Use event-logger-v2.ts

The simplest way to get started:

```bash
# Make executable
chmod +x packages/claude-hooks-sdk/sample-extension/event-logger-v2.ts

# Test it
echo '{"hook_event_name":"SessionStart","session_id":"test","transcript_path":"/tmp/test.jsonl","cwd":"/tmp","source":"startup"}' | \
  bun packages/claude-hooks-sdk/sample-extension/event-logger-v2.ts
```

### 2. Configure Claude Code

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/packages/claude-hooks-sdk/sample-extension/event-logger-v2.ts"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/packages/claude-hooks-sdk/sample-extension/event-logger-v2.ts"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/packages/claude-hooks-sdk/sample-extension/event-logger-v2.ts"
          }
        ]
      }
    ]
  }
}
```

Or use the provided [settings.json](./settings.json) template.

### 3. View Logs

```bash
# Real-time log viewing
tail -f .claude/hooks/event-logger/logs/events.jsonl | jq '.'

# Analyze logs
./sample-extension/analyze-logs.sh

# Event count by type
jq -r '.input.hook.hook_event_name' .claude/hooks/event-logger/logs/events.jsonl | sort | uniq -c
```

## 📊 Example Log Entry (v0.4.1)

```json
{
  "input": {
    "hook": {
      "hook_event_name": "Stop",
      "session_id": "abc-123",
      "transcript_path": "/path/transcript.jsonl",
      "cwd": "/project"
    },
    "conversation": {...},
    "context": {
      "transactionId": "tx_1732195847123_abc123",
      "conversationId": "abc-123",
      "git": {
        "repo": "https://github.com/org/repo.git",
        "branch": "main",
        "commit": "abc123",
        "repoInstanceId": "repo_1732195847123_xyz789"
      },
      "editedFiles": [
        "/project/src/index.ts",
        "/project/README.md"
      ]
    },
    "timestamp": "2025-11-21T19:58:02.789Z"
  },
  "output": {
    "exitCode": 0,
    "success": true
  }
}
```

## 🎯 Features Demonstrated

### event-logger-v2.ts
- ✅ Built-in event logging (`logEvents: true`)
- ✅ Edit tracking for Edit, Write, MultiEdit tools
- ✅ Repo instance ID (unique per checkout)
- ✅ Transaction IDs and correlation context
- ✅ Type-safe context access
- ✅ Non-blocking error handling
- ✅ 30-second timeout support

### failure-queue-demo.ts
- ✅ Automatic retry queue (FIFO)
- ✅ Sequential event processing
- ✅ Configurable retry limits
- ✅ Manual queue inspection

### test-edit-tracking.ts
- ✅ Track files modified by Claude
- ✅ Deduplicated file paths
- ✅ Works with Edit, Write, MultiEdit tools

## 📖 Documentation

- **[Edit Tracking Guide](../docs/guides/EDIT-TRACKING.md)**
- **[Non-Blocking Hooks](../docs/guides/NON-BLOCKING-HOOKS.md)**
- **[Failure Queue](../docs/guides/FAILURE-QUEUE.md)**
- **[Repo Instance ID](../docs/guides/REPO-INSTANCE-ID.md)**

## 🛠️ Analyzing Logs

```bash
# Count events by type
jq -r '.input.hook.hook_event_name' .claude/hooks/event-logger/logs/events.jsonl | \
  sort | uniq -c | sort -rn

# Filter by session
jq 'select(.input.hook.session_id == "your-session-id")' \
  .claude/hooks/event-logger/logs/events.jsonl

# Show edited files from recent sessions
jq -r 'select(.input.context.editedFiles) | .input.context.editedFiles[]' \
  .claude/hooks/event-logger/logs/events.jsonl

# Show repo instances
jq -r '.input.context.git.repoInstanceId' \
  .claude/hooks/event-logger/logs/events.jsonl | sort -u
```

## 🔧 Extending Examples

Use these as templates for:

- **Analytics Tracking** - Send events to analytics service
- **Performance Monitoring** - Track tool execution times
- **Audit Logging** - Compliance and security logs
- **Cost Tracking** - Monitor API usage
- **Custom Integrations** - Slack, Discord, webhooks, etc.

### Example: Send to Analytics

```typescript
manager.onStop(async (input) => {
  await fetch('https://analytics.example.com/track', {
    method: 'POST',
    body: JSON.stringify({
      event: 'claude_session_end',
      repoInstanceId: input.context?.git?.repoInstanceId,
      editedFiles: input.context?.editedFiles,
      transactionId: input.context?.transactionId,
    }),
  });

  return success();
});
```

## 📦 Related Files

- **[settings.json](./settings.json)** - Hook configuration template
- **[INTEGRATION-GUIDE.md](./INTEGRATION-GUIDE.md)** - Integration patterns
- **[TEST-RESULTS.md](./TEST-RESULTS.md)** - Test results and verification
- **[COMPARISON.md](./COMPARISON.md)** - Before/after SDK comparison

## ✨ v0.4.1 Features

All examples updated to demonstrate:

1. **Type Safety** - Full TypeScript autocomplete for context fields
2. **Timeout Support** - 30-second default timeout (configurable)
3. **Auto-drain Control** - Optional manual queue draining
4. **Expanded Edit Tracking** - Edit, Write, and MultiEdit tools
5. **Plugin Error Handling** - Isolated plugin failures
6. **Repo Instance ID** - Unique identifier per checkout
7. **Non-blocking by Default** - Hooks never block Claude Code

See [CHANGELOG](../CHANGELOG.md) for complete v0.4.1 details.
