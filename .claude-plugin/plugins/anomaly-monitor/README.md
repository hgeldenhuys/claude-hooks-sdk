# Anomaly Monitor Plugin

Real-time anomaly detection with configurable alerts for Claude Code sessions.

## Features

- 🚨 **Error Rate Monitoring** - Alert when error rates exceed thresholds
- ⏱️ **Response Time Analysis** - Detect slow responses using p95/p99 metrics
- 📈 **Token Spike Detection** - Statistical analysis to catch unusual token usage
- 🔔 **Webhook Alerts** - Send alerts to Slack, Discord, or custom webhooks
- 📊 **Session Statistics** - View performance stats at session end

## Installation

```bash
# Install from marketplace
/plugin install anomaly-monitor

# Or copy hook manually
chmod +x .claude-plugin/plugins/anomaly-monitor/hook.ts
```

## Configuration

Edit `.claude-plugin/config.json`:

```json
{
  "anomaly-monitor": {
    "enabled": true,
    "thresholds": {
      "errorRate": 0.1,      // Alert if >10% of tool calls fail
      "responseTime": 30000, // Alert if p95 >30 seconds
      "tokenSpike": 3        // Alert if tokens >3 std deviations from mean
    },
    "alerts": {
      "webhook": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      "email": "alerts@example.com"
    }
  }
}
```

### Slack Webhook Setup

1. Create a Slack webhook at https://api.slack.com/messaging/webhooks
2. Add the webhook URL to config.json
3. Anomalies will be posted to your Slack channel

## Usage

Once configured, the plugin automatically monitors all sessions and sends alerts when anomalies are detected.

## Sample Output

### Real-Time Alert

```
[anomaly-monitor] 🚨 ANOMALY DETECTED!
  Type: error_rate
  Value: 0.15
  Threshold: 0.10
  Time: 2025-01-22 14:32:15
  Details: {
    "errors": 12,
    "totalEvents": 80
  }
[anomaly-monitor] ✅ Alert sent to webhook
```

### Token Spike Alert

```
[anomaly-monitor] 🚨 ANOMALY DETECTED!
  Type: token_spike
  Value: 45000
  Threshold: 15000
  Time: 2025-01-22 14:35:42
  Details: {
    "zScore": 3.2,
    "mean": 12000,
    "stdDev": 4200
  }
```

### Session Summary

```
[anomaly-monitor] 📊 Session Anomaly Summary
  Total anomalies: 3
  error_rate: 1
  token_spike: 2

[anomaly-monitor] 📈 Session Statistics
  Mean response time: 5420ms
  Median response time: 4230ms
  P95 response time: 18500ms
  Std deviation: 6800ms
```

## Anomaly Types

### Error Rate
Triggers when tool call error rate exceeds threshold within a time window.

**When to adjust:**
- Lower threshold (0.05) for production systems
- Higher threshold (0.2) during development

### Response Time
Triggers when p95 response time exceeds threshold.

**When to adjust:**
- Lower threshold (15000ms) for interactive sessions
- Higher threshold (60000ms) for batch processing

### Token Spike
Triggers when token usage is >N standard deviations from the mean.

**When to adjust:**
- Lower stdDev (2) for consistent workloads
- Higher stdDev (5) for variable workloads

## Webhook Format

Alerts are sent as JSON with this structure:

```json
{
  "text": "🚨 Anomaly Detected: error_rate",
  "attachments": [{
    "color": "danger",
    "fields": [
      {"title": "Type", "value": "error_rate"},
      {"title": "Value", "value": "0.15"},
      {"title": "Threshold", "value": "0.10"},
      {"title": "Session", "value": "abc-123"},
      {"title": "Time", "value": "2025-01-22 14:32:15"}
    ]
  }]
}
```

Compatible with:
- ✅ Slack
- ✅ Discord
- ✅ Microsoft Teams
- ✅ Custom webhooks

## Troubleshooting

**Q: Too many alerts?**
A: Increase thresholds in config.json

**Q: Webhook not working?**
A: Check webhook URL is correct and test it manually with curl

**Q: Missing anomalies?**
A: Lower thresholds to be more sensitive
