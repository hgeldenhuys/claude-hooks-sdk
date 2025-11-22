# Integration Complete! 🎉

The event logger extension has been successfully integrated into your Agios project.

## What Changed

Updated `.claude/settings.json` to run **both**:
1. ✅ Existing Agios hooks (`.agent/hooks.ts`)
2. ✅ Event logger extension (`sample-extension/event-logger.ts`)

Both hooks will run in parallel for each event - the Agios hooks continue working exactly as before, and the event logger adds structured logging.

## How It Works

When a hook event fires:
```
SessionStart (or any event)
    ↓
Agios Hook (.agent/hooks.ts)
    ↓
Event Logger (sample-extension/event-logger.ts)
    ↓
Both complete successfully
```

## Monitoring Logs

### Real-time Monitoring

```bash
# Watch logs as they come in
tail -f packages/claude-hooks-sdk/sample-extension/logs/events.jsonl

# Pretty-print with jq
tail -f packages/claude-hooks-sdk/sample-extension/logs/events.jsonl | jq .
```

### Analysis

```bash
# Run analysis script
./packages/claude-hooks-sdk/sample-extension/analyze-logs.sh

# Or manually with jq
cat packages/claude-hooks-sdk/sample-extension/logs/events.jsonl | jq .
```

## What Gets Logged

Every hook event will log:
- `timestamp` - When the event occurred
- `event` - Event type (SessionStart, PreToolUse, etc.)
- `sessionId` - Claude Code session ID
- `toolName` - Tool being used (for tool events)
- `cwd` - Current working directory
- `exitCode` - Hook exit code (0 = success)
- `success` - Boolean success flag

## Example Log Entry

```json
{
  "timestamp": "2025-11-21T08:00:00.000Z",
  "event": "PreToolUse",
  "sessionId": "abc-123-def-456",
  "toolName": "Read",
  "cwd": "/path/to/your/project",
  "exitCode": 0,
  "success": true
}
```

## Testing

The extension is now active! It will start logging with your next Claude Code session.

To verify it's working:
1. Start a new Claude Code session (or this one will log on Stop)
2. Check the log file: `cat packages/claude-hooks-sdk/sample-extension/logs/events.jsonl`
3. You should see events appearing

## Disabling the Logger

If you want to disable the event logger temporarily:

**Option 1: Comment out in settings**
Edit `.claude/settings.json` and comment out the event-logger lines

**Option 2: Remove from settings**
Delete the second hook entry from each event in `.claude/settings.json`

**Option 3: Use a different hook**
Replace `event-logger.ts` with another extension you build!

## Next Steps

### Use the Logs

- **Debug Issues**: See exactly what tools were called
- **Analyze Usage**: Count tool usage, session lengths
- **Track Performance**: Identify slow operations
- **Audit Trail**: Full event history

### Build Your Own Extension

Use `event-logger.ts` as a template:
1. Copy the file
2. Modify the `loggingPlugin` to do what you need
3. Update `.claude/settings.json` to use your new hook
4. Test it!

## Troubleshooting

### No logs appearing?
- Check file permissions: `ls -la packages/claude-hooks-sdk/sample-extension/event-logger.ts`
- Should be executable: `chmod +x packages/claude-hooks-sdk/sample-extension/event-logger.ts`
- Check for errors: Look in Claude Code output

### Logs but no data?
- Verify JSONL format: `cat logs/events.jsonl | jq .`
- Check timestamps are recent

### Too many logs?
- Filter by event type when viewing:
  ```bash
  cat logs/events.jsonl | jq 'select(.event == "PreToolUse")'
  ```

## Success Metrics

With this integration, you can now:
- ✅ Monitor all Claude Code activity
- ✅ Analyze tool usage patterns
- ✅ Debug hook issues
- ✅ Track session metrics
- ✅ Build custom analytics

Enjoy your new observability into Claude Code! 🚀
