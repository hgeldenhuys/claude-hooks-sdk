# Analytics Tracker Plugin

Automatically track session costs, token usage, and performance metrics for Claude Code sessions.

## Features

- 💰 **Automatic Cost Tracking** - Monitor costs in real-time with configurable model pricing
- 📊 **Token Usage Monitoring** - Track input/output tokens for every turn
- 🔧 **Tool Usage Statistics** - See which tools are used most frequently
- 📈 **Session Summaries** - Get detailed reports at the end of each session
- 💾 **Persistent Storage** - Metrics survive restarts using SQLite

## Installation

```bash
# Install from marketplace
/plugin install analytics-tracker

# Or copy hook manually
chmod +x .claude-plugin/plugins/analytics-tracker/hook.ts
```

## Configuration

Edit `.claude-plugin/config.json`:

```json
{
  "analytics-tracker": {
    "enabled": true,
    "storagePath": ".claude/analytics.db",
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

Once installed, the plugin automatically tracks all Claude Code sessions:

```bash
# Start a Claude Code session - analytics are tracked automatically
claude

# At the end of the session, you'll see:
# [analytics-tracker] 📊 Session Summary
#   Duration: 5m 32s
#   Turns: 12
#   Tokens: 45,320 (25,180 in / 20,140 out)
#   Cost: $0.3521 ($0.0755 in / $0.2766 out)
#   Tools: 8 different tools used
#   Errors: 2 (4.2% error rate)
#   Top tools: Read(15), Write(8), Bash(5), Edit(3), Grep(2)
```

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

## Troubleshooting

**Q: No analytics showing?**
A: Check that `enabled: true` in config.json and the hook has execute permissions.

**Q: Wrong costs?**
A: Update pricing in config.json to match current Anthropic rates.

**Q: Storage errors?**
A: Ensure `.claude/` directory exists and has write permissions.
