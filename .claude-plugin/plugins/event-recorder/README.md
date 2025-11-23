# Event Recorder Plugin

Record all Claude Code hook events to JSONL files for debugging, testing, and replay.

## Features

- 📹 **JSONL Recording** - Events saved in newline-delimited JSON format
- 🎯 **Event Filtering** - Record only specific event types
- 💾 **Auto-Save** - Events saved in real-time or at session end
- 🔄 **Replay Support** - Replay recorded sessions for testing
- 🐛 **Debugging Aid** - Inspect exactly what happened in a session

## Installation

```bash
# Install from marketplace
/plugin install event-recorder

# Or copy hook manually
chmod +x .claude-plugin/plugins/event-recorder/hook.ts
```

## Configuration

Edit `.claude-plugin/config.json`:

```json
{
  "event-recorder": {
    "enabled": true,
    "outputPath": ".claude/events.jsonl",
    "autoSave": true,
    "events": [
      "UserPromptSubmit",
      "PostToolUse",
      "Stop"
    ]
  }
}
```

### Configuration Options

- **outputPath**: Where to save recorded events
- **autoSave**: Save after each event (true) or at session end (false)
- **events**: Array of event types to record, or empty array for all events

### Event Types

Available event types to filter:
- `SessionStart`
- `SessionEnd`
- `UserPromptSubmit`
- `PreToolUse`
- `PostToolUse`
- `Stop`
- `SubagentStop`
- `PreCompact`
- `Notification`

## Usage

Once enabled, all events are automatically recorded:

```bash
# Events are recorded in real-time
claude

# At session end, you'll see:
# [event-recorder] 📹 Recording Summary
#   Events recorded: 245
#   Duration: 12m 34s
#   Output: .claude/events.jsonl
#   Replay with: bun .claude-plugin/plugins/event-recorder/replay.ts
```

## File Format

Events are saved as JSONL (newline-delimited JSON):

```json
{"timestamp":1706012345678,"event":{"hook_event_name":"UserPromptSubmit","session_id":"abc-123","prompt":"Fix the bug"}}
{"timestamp":1706012346123,"event":{"hook_event_name":"PostToolUse","session_id":"abc-123","tool_name":"Read"}}
{"timestamp":1706012347890,"event":{"hook_event_name":"Stop","session_id":"abc-123"}}
```

## Replay

Use the EventReplayer to replay recorded sessions:

```typescript
import { EventReplayer } from 'claude-hooks-sdk';

const replayer = new EventReplayer('.claude/events.jsonl');

// Replay at 2x speed
await replayer.replay((event, index) => {
  console.log(`Event ${index}:`, event.hook_event_name);
}, {
  speed: 2.0,
  realtime: true
});

// Get summary
const summary = await replayer.getSummary();
console.log('Total events:', summary.total);
console.log('By type:', summary.byType);
```

## Use Cases

### Debugging

Record a session where a bug occurs, then replay it to understand what happened:

```bash
# Bug occurs during this session (events recorded)
claude

# Replay the session
bun replay.ts
```

### Testing

Create test fixtures from real sessions:

```typescript
// Record real usage
const recorder = new EventRecorder({
  output: 'test-fixtures/session-001.jsonl',
  autoSave: true
});

// Later, use for tests
const replayer = new EventReplayer('test-fixtures/session-001.jsonl');
await replayer.replay(testHandler);
```

### Analysis

Analyze patterns across multiple sessions:

```bash
# Count events by type
cat .claude/events.jsonl | jq '.event.hook_event_name' | sort | uniq -c

# Find errors
cat .claude/events.jsonl | jq 'select(.event.tool_response.error)'

# Calculate average tokens
cat .claude/events.jsonl | jq 'select(.event.hook_event_name=="Stop") | .event.usage.input_tokens' | jq -s 'add/length'
```

## Troubleshooting

**Q: File too large?**
A: Enable event filtering to record only specific events

**Q: Performance impact?**
A: Minimal with autoSave:false, saves at session end only

**Q: Disk space?**
A: Compress old recordings: `gzip .claude/events-*.jsonl`
