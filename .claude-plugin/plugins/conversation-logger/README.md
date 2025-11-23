# Conversation Logger Plugin

Unified conversation logging across all Claude Code sessions with beautiful color-coded output.

## Features

- 📝 **Unified Log** - All sessions write to one file (`.claude/logs/conversation.jsonl`)
- 🎨 **Color-Coded Sessions** - Each session gets a unique, deterministic color (10 colors)
- 💭 **Thinking Blocks** - Shows Claude's internal reasoning when present
- 🔧 **Tool Tracking** - Displays tool uses with descriptions
- 📊 **Token Usage** - Shows input/output tokens and cache hits
- 🔄 **Multi-Session** - Perfect for watching multiple agents/sessions simultaneously

## Installation

### Step 1: Install the Plugin

```bash
/plugin install conversation-logger
```

### Step 2: Register Hooks (REQUIRED)

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
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/conversation-logger/hook.ts"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/conversation-logger/hook.ts"
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
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/conversation-logger/hook.ts"
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
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/conversation-logger/hook.ts"
          }
        ]
      }
    ]
  }
}
```

### Step 3: Install Dependencies

```bash
bun add chalk
```

### Step 4: Restart Claude Code

Hooks only load at startup.

## Usage

### Watch Live Conversations

In a separate terminal:

```bash
tail -f .claude/logs/conversation.jsonl | bun .claude/hooks/conversation-logger/scripts/viewer.ts
```

### Replay a Session

```bash
cat .claude/logs/conversation.jsonl | bun .claude/hooks/conversation-logger/scripts/viewer.ts
```

## Visual Output

Each session gets a unique color and border:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ 🤖 Agent Started                                                             ║
║   Session: ea702ba6                                                          ║
║   Source: startup                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

│ [12:45:30 AM] 👤 User:
│ How do I install the analytics-tracker?
│

│ [12:45:35 AM] 🤖 Assistant:
│ 💭 Thinking:
│ User wants to install analytics-tracker plugin...
│
│ Great question! To install analytics-tracker...
│
│ 🔧 Read
│    Check analytics-tracker installation
│ 📊 1,234 tokens (234 in / 1,000 out) [98,234 cached]
│
```

When a **second session** starts in another terminal, it gets a different color:

```
╔══════════════════════════════════════════════════════════════════════════════╗
║ 🤖 Agent Started                                                             ║
║   Session: f3b2c891                                                          ║
║   Source: startup                                                            ║
╚══════════════════════════════════════════════════════════════════════════════╝

│ [12:46:00 AM] 👤 User:
│ Debug the API error
│
```

## Color Palette

The plugin cycles through 10 colors:
1. Cyan
2. Green
3. Yellow
4. Blue
5. Magenta
6. Red
7. White
8. Gray
9. Bright Green
10. Bright Blue

**Note:** Colors are deterministically assigned based on session ID hash, so the same session always gets the same color, even across viewer restarts.

## Log Format (JSONL)

### `session_start`
```json
{
  "timestamp": "2025-11-23T05:41:05.484Z",
  "event": "session_start",
  "session_id": "af13b3cd-5185-42df-aa85-3bf6e52e1810",
  "source": "startup"
}
```

### `user_message`
```json
{
  "timestamp": "2025-11-23T05:41:38.390Z",
  "event": "user_message",
  "session_id": "af13b3cd-5185-42df-aa85-3bf6e52e1810",
  "content": "How do I install analytics-tracker?"
}
```

### `assistant_message`
```json
{
  "timestamp": "2025-11-23T05:42:11.770Z",
  "event": "assistant_message",
  "session_id": "af13b3cd-5185-42df-aa85-3bf6e52e1810",
  "text": "Great question! To install...",
  "thinking": "User wants to know about installation...",
  "tools": [
    {"name": "Read", "description": "Check installation"}
  ],
  "model": "claude-sonnet-4-5-20250929",
  "usage": {
    "input_tokens": 234,
    "output_tokens": 1000,
    "cache_read_input_tokens": 98234
  }
}
```

### `session_end`
```json
{
  "timestamp": "2025-11-23T05:50:00.000Z",
  "event": "session_end",
  "session_id": "af13b3cd-5185-42df-aa85-3bf6e52e1810",
  "reason": "logout"
}
```

## Use Cases

### Multi-Agent Development
Run multiple Claude Code instances working on different parts of your project, watch them all in one terminal:

```bash
# Terminal 1: Backend agent (cyan border)
# Terminal 2: Frontend agent (green border)
# Terminal 3: Combined conversation log
tail -f .claude/logs/conversation.jsonl | bun .claude/hooks/conversation-logger/scripts/viewer.ts
```

### Debugging Sessions
Replay a problematic session to see exactly what happened:

```bash
grep "problem-session-id" .claude/logs/conversation.jsonl | bun .claude/hooks/conversation-logger/scripts/viewer.ts
```

### Pair Programming
Share your `.claude/logs/conversation.jsonl` file with teammates to show your conversation with Claude.

## Combine with Analytics Tracker

Use both plugins together for full observability:

**Terminal 1:** Cost tracking
```bash
tail -f .claude/logs/analytics-tracker.jsonl | bun .claude/hooks/analytics-tracker/scripts/viewer.ts
```

**Terminal 2:** Conversation log
```bash
tail -f .claude/logs/conversation.jsonl | bun .claude/hooks/conversation-logger/scripts/viewer.ts
```

## Troubleshooting

**Q: No logs appearing?**
1. Check `.claude/settings.json` has all 4 hook registrations
2. Restart Claude Code
3. Verify log file exists: `ls -la .claude/logs/conversation.jsonl`

**Q: Colors changing between viewer restarts?**
A: This was fixed in v0.7.1 - colors are now deterministically assigned based on session ID hash.

**Q: Multiple sessions showing the same color?**
A: With 10 colors cycling, session 11 will reuse color 1. This is expected when running many concurrent sessions.

## License

MIT
