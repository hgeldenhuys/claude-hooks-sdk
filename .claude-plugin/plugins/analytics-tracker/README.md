# Analytics Tracker Plugin

Automatically track session costs, token usage, and performance metrics for Claude Code sessions.

## Features

- 💰 **Automatic Cost Tracking** - Monitor costs in real-time with configurable model pricing
- 📊 **Token Usage Monitoring** - Track input/output tokens for every turn
- 🔧 **Tool Usage Statistics** - See which tools are used most frequently
- 📈 **Session Summaries** - Get detailed reports at the end of each session
- 💾 **Persistent Storage** - Metrics survive restarts using SQLite

## Installation

### Step 1: Install the Plugin

```bash
/plugin install analytics-tracker
```

This copies files to `.claude/hooks/analytics-tracker/` and `.claude-plugin/`.

### Step 2: Register Hooks (REQUIRED)

**CRITICAL:** The plugin doesn't auto-register! You must manually add it to `.claude/settings.json`.

Add these hook registrations to your `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/analytics-tracker/hook.ts"
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
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/analytics-tracker/hook.ts"
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
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/analytics-tracker/hook.ts"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/analytics-tracker/hook.ts"
          }
        ]
      }
    ]
  }
}
```

**Note:** If you already have hooks registered, add these to your existing arrays (don't replace them).

### Step 3: Install Dependencies

```bash
bun add chalk  # For the viewer script
```

### Step 4: Restart Claude Code

Hooks only load at startup. Restart to activate analytics-tracker.

## Configuration

Create or edit `.claude-plugin/config.json`:

```json
{
  "analytics-tracker": {
    "enabled": true,
    "storagePath": ".claude/analytics.db",
    "logPath": ".claude/logs/analytics-tracker.jsonl",
    "pricing": {
      "claude-sonnet-4": {
        "input": 3.0,
        "output": 15.0
      },
      "claude-opus-4": {
        "input": 15.0,
        "output": 75.0
      },
      "claude-haiku-4": {
        "input": 0.8,
        "output": 4.0
      }
    },
    "reportingInterval": "session"
  }
}
```

### Environment Variables

Alternatively, use environment variables:

```bash
export ANALYTICS_TRACKER_ENABLED=true
export ANALYTICS_TRACKER_STORAGE_PATH=.claude/analytics.db
```

## Usage

### View Real-Time Analytics

In a separate terminal, tail the log with the viewer:

```bash
tail -f .claude/logs/analytics-tracker.jsonl | bun .claude/hooks/analytics-tracker/scripts/viewer.ts
```

Or view raw JSONL:

```bash
tail -f .claude/logs/analytics-tracker.jsonl
```

The plugin writes to `.claude/logs/analytics-tracker.jsonl` - all output is file-based for easy tailing and processing.

## Sample Output

### Per-Turn Tracking

```
[analytics-tracker] 💰 Turn 1: $0.0234 | 1,560 tokens
[analytics-tracker] 💰 Turn 2: $0.0456 | 3,040 tokens
[analytics-tracker] 💰 Turn 3: $0.0189 | 1,260 tokens
```

### Session Summary

```
[analytics-tracker] 📊 Session Summary
  Duration: 12m 45s
  Turns: 24
  Tokens: 156,892 (89,234 in / 67,658 out)
  Cost: $1.2834 ($0.2677 in / $1.0157 out)
  Tools: 12 different tools used
  Errors: 5 (3.2% error rate)
  Top tools: Read(45), Write(23), Edit(18), Grep(12), Bash(8)
```

### All-Time Statistics

```
[analytics-tracker] 📈 All-Time Statistics
  Total sessions: 156
  Total cost: $234.56
  Average cost: $1.5036 per session
  Total tokens: 12,456,890
  Average turns: 18.5 per session
```

## API

The plugin uses `SessionAnalytics` from claude-hooks-sdk v0.7.0. You can access analytics programmatically:

```typescript
import { SessionAnalytics } from 'claude-hooks-sdk';

const analytics = new SessionAnalytics({
  pricing: { /* ... */ },
  storagePath: '.claude/analytics.db'
});

// Get metrics for a session
const metrics = await analytics.getMetrics(sessionId);

// Get aggregated metrics
const agg = await analytics.getAggregatedMetrics();
```

## Pricing Updates

Update pricing in `config.json` to match current Anthropic pricing:

```json
{
  "pricing": {
    "claude-sonnet-4": {
      "input": 3.0,   // $ per million input tokens
      "output": 15.0  // $ per million output tokens
    }
  }
}
```

## Storage

Analytics are stored in SQLite at the configured `storagePath` (default: `.claude/analytics.db`). This file persists across sessions and can be queried directly:

```bash
sqlite3 .claude/analytics.db "SELECT * FROM state WHERE key LIKE 'session:%'"
```

## JSONL Log Format

The plugin writes structured JSONL events:

**session_start**
```json
{"timestamp":"2025-11-23T05:01:37.688Z","event":"session_start","session_id":"482abe2a..."}
```

**turn_complete**
```json
{"timestamp":"2025-11-23T05:02:15.123Z","event":"turn_complete","session_id":"482abe2a...","turn":1,"cost":{"total":0.0234,"input":0.0015,"output":0.0219},"tokens":{"total":1560,"input":500,"output":1060}}
```

**session_end**
```json
{"timestamp":"2025-11-23T05:15:30.456Z","event":"session_end","session_id":"482abe2a...","duration":"13m 53s","turns":12,"tokens":{...},"cost":{...},"tools":{...}}
```

## Troubleshooting

**Q: No logs appearing after install?**
1. Check hook registration in `.claude/settings.json`
2. Restart Claude Code (hooks only load at startup)
3. Check debug log: `cat .claude/logs/analytics-debug.log`
4. Verify hook permissions: `chmod +x .claude/hooks/analytics-tracker/hook.ts`

**Q: Wrong costs?**
A: Update pricing in config.json to match current Anthropic rates (https://anthropic.com/pricing).

**Q: Database locked errors?**
A: Only one hook instance should run per session. Check for duplicate registrations in settings.json.
