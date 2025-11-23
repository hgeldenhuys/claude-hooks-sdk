# Performance Monitor Plugin

Track response times, SLA compliance, and tool performance. Monitor p95/p99 metrics and get alerted when SLAs are breached.

## Features

- ⏱️ **Response Time Tracking** - Monitor p50, p95, p99 response times
- 🎯 **SLA Compliance** - Set thresholds and detect breaches
- 🔧 **Tool Performance** - Track which tools are slowest
- 📊 **Session Metrics** - Comprehensive performance summary at session end
- ⚠️ **Real-time Alerts** - Get notified when performance degrades

## Installation

### Step 1: Install the Plugin

```bash
/plugin install performance-monitor
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
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/performance-monitor/hook.ts"
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
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/performance-monitor/hook.ts"
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
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/performance-monitor/hook.ts"
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
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/performance-monitor/hook.ts"
          }
        ]
      }
    ]
  }
}
```

### Step 3: Configure (Optional)

Create or edit `.claude-plugin/config.json`:

```json
{
  "performance-monitor": {
    "enabled": true,
    "slaThresholds": {
      "p95ResponseTime": 30000,
      "errorRate": 0.05
    }
  }
}
```

### Step 4: Restart Claude Code

Hooks only load at startup.

## Usage

Once enabled, performance metrics are automatically tracked. At session end, you'll see:

```
[performance-monitor] ⚡ Performance Summary
  Duration: 8m 45s
  Turns: 12
  Tools used: 5
  Error rate: 2.3%

[performance-monitor] ✅ All SLAs met
```

### SLA Breach Example

If performance degrades, you'll be alerted:

```
[performance-monitor] ⚡ Performance Summary
  Duration: 15m 32s
  Turns: 8
  Tools used: 6
  Error rate: 8.4%

[performance-monitor] 🚨 SLA Breaches:
  ⚠️  Error rate 8.4% exceeds SLA 5.0%
```

## Configuration Options

### `enabled`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable/disable the plugin

### `slaThresholds.p95ResponseTime`
- **Type**: `number` (milliseconds)
- **Default**: `30000` (30 seconds)
- **Description**: Maximum acceptable p95 response time

**Recommended values:**
- Interactive sessions: `15000` (15s)
- Standard sessions: `30000` (30s)
- Batch processing: `60000` (60s)

### `slaThresholds.errorRate`
- **Type**: `number` (0.0 - 1.0)
- **Default**: `0.05` (5%)
- **Description**: Maximum acceptable error rate

**Recommended values:**
- Production: `0.01` (1%)
- Development: `0.05` (5%)
- Experimental: `0.20` (20%)

## Metrics Collected

### Session-Level Metrics

- **Duration**: Total session time (start to end)
- **Turns**: Number of user prompts / assistant responses
- **Tools used**: Unique tools invoked during session
- **Error rate**: Percentage of tool calls that failed

### Tool-Level Metrics

- **Invocation count**: How many times each tool was used
- **Success rate**: Percentage of successful tool calls
- **Average response time**: Mean time for tool execution

### Performance Percentiles

- **p50 (median)**: 50% of responses were faster than this
- **p95**: 95% of responses were faster than this
- **p99**: 99% of responses were faster than this

**Why p95 matters**: p95 represents the "worst normal case" - the slowest 5% of requests are often outliers or errors, so p95 gives a realistic view of typical performance.

## Use Cases

### Production Monitoring

Monitor Claude Code sessions in production environments:

```json
{
  "performance-monitor": {
    "enabled": true,
    "slaThresholds": {
      "p95ResponseTime": 15000,
      "errorRate": 0.01
    }
  }
}
```

Set strict thresholds and investigate any SLA breaches.

### Development Optimization

Track performance during development:

```json
{
  "performance-monitor": {
    "enabled": true,
    "slaThresholds": {
      "p95ResponseTime": 30000,
      "errorRate": 0.10
    }
  }
}
```

More lenient thresholds allow experimentation while still catching major issues.

### Performance Regression Detection

Run performance monitor on every commit to catch regressions:

```bash
# In CI/CD pipeline
claude --headless "run test suite" 2>&1 | tee claude-output.log

# Check for SLA breaches
if grep "SLA Breaches" claude-output.log; then
  echo "Performance regression detected!"
  exit 1
fi
```

## Advanced Usage

### Historical Tracking

Performance data is stored in `.claude/performance.db` (SQLite):

```bash
# View all session metrics
sqlite3 .claude/performance.db "SELECT * FROM sessions"

# Calculate average error rate over last 10 sessions
sqlite3 .claude/performance.db "
  SELECT AVG(error_rate) FROM sessions
  ORDER BY created_at DESC
  LIMIT 10
"

# Find slowest sessions
sqlite3 .claude/performance.db "
  SELECT session_id, duration, turns
  FROM sessions
  ORDER BY duration DESC
  LIMIT 5
"
```

### Combining with Other Plugins

Use with `analytics-tracker` for cost + performance insights:

```
[analytics-tracker] 💰 Turn 1: $0.0154 | 1,041 tokens
[performance-monitor] ⚡ Performance Summary
  Duration: 8m 45s
  Error rate: 0.0%
```

Use with `anomaly-monitor` for real-time alerting:

```
[anomaly-monitor] 🚨 ANOMALY DETECTED!
  Type: response_time
  Value: 45000ms
  Threshold: 30000ms
```

## Troubleshooting

**Q: No performance summary showing?**

1. Check `.claude/settings.json` has all 4 hook registrations
2. Restart Claude Code
3. Complete a full session (SessionStart → SessionEnd)

**Q: SLA thresholds too strict?**

Adjust thresholds in `.claude-plugin/config.json` based on your use case. Development sessions typically need more lenient thresholds than production.

**Q: Database file too large?**

Clean up old sessions:

```bash
# Delete sessions older than 30 days
sqlite3 .claude/performance.db "
  DELETE FROM sessions
  WHERE created_at < datetime('now', '-30 days')
"

# Vacuum to reclaim space
sqlite3 .claude/performance.db "VACUUM"
```

## Performance Impact

The plugin itself has minimal overhead:
- **Per event**: <2ms processing time
- **Memory**: ~5MB for session tracking
- **Disk**: SQLite database grows ~1KB per session

## License

MIT
