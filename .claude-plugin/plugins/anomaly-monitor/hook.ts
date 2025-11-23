#!/usr/bin/env bun
/**
 * Anomaly Monitor Plugin
 *
 * Real-time anomaly detection with configurable alerts.
 * Uses AnomalyDetector from claude-hooks-sdk v0.7.0
 *
 * Features:
 * - Error rate monitoring with configurable thresholds
 * - Response time anomaly detection (p95, p99)
 * - Token spike detection using statistical analysis
 * - Webhook alerts (Slack, Discord, custom)
 * - Email notifications (optional)
 *
 * Configuration:
 * Edit .claude-plugin/config.json or set environment variables:
 * - ANOMALY_MONITOR_ENABLED=true
 * - ANOMALY_MONITOR_WEBHOOK=https://hooks.slack.com/...
 */

import { HookManager, AnomalyDetector } from 'claude-hooks-sdk';
import { loadConfig, getConfigValue } from '../../shared/config-loader';

const PLUGIN_NAME = 'anomaly-monitor';

// Load configuration
const config = loadConfig(PLUGIN_NAME);

if (!config.enabled) {
  console.log(`[${PLUGIN_NAME}] Plugin disabled`);
  process.exit(0);
}

// Get config values
const thresholds = getConfigValue(config, 'thresholds', {
  errorRate: 0.1,
  responseTime: 30000,
  tokenSpike: 3,
});
const alerts = getConfigValue(config, 'alerts', {
  webhook: '',
  email: '',
});

// Initialize AnomalyDetector
const detector = new AnomalyDetector({
  rules: {
    errorRate: {
      threshold: thresholds.errorRate,
      window: '5m',
    },
    responseTime: {
      threshold: thresholds.responseTime,
      type: 'p95',
    },
    tokenSpike: {
      stdDev: thresholds.tokenSpike,
    },
  },
  onAnomaly: async (anomaly) => {
    // Log anomaly
    console.error(`\n[${PLUGIN_NAME}] 🚨 ANOMALY DETECTED!`);
    console.error(`  Type: ${anomaly.type}`);
    console.error(`  Value: ${anomaly.value.toFixed(2)}`);
    console.error(`  Threshold: ${anomaly.threshold.toFixed(2)}`);
    console.error(`  Time: ${anomaly.timestamp.toLocaleString()}`);
    if (anomaly.details) {
      console.error(`  Details: ${JSON.stringify(anomaly.details, null, 2)}`);
    }

    // Send webhook alert if configured
    if (alerts.webhook) {
      await sendWebhookAlert(alerts.webhook, anomaly);
    }

    // Send email alert if configured
    if (alerts.email) {
      console.log(`[${PLUGIN_NAME}] ⚠️  Email alerts not yet implemented`);
    }
  },
});

// Create HookManager
const manager = new HookManager({
  clientId: PLUGIN_NAME,
  logEvents: false,
});

// Check all events for anomalies
manager.onPostToolUse(async (input) => {
  await detector.check(input);
});

manager.onStop(async (input) => {
  await detector.check(input);
});

// Show statistics on session end
manager.onSessionEnd(async (input) => {
  const anomalies = detector.getAnomalies(input.session_id);
  const stats = detector.getStatistics(input.session_id);

  if (anomalies.length > 0) {
    console.log(`\n[${PLUGIN_NAME}] 📊 Session Anomaly Summary`);
    console.log(`  Total anomalies: ${anomalies.length}`);

    // Group by type
    const byType: Record<string, number> = {};
    for (const anomaly of anomalies) {
      byType[anomaly.type] = (byType[anomaly.type] || 0) + 1;
    }

    for (const [type, count] of Object.entries(byType)) {
      console.log(`  ${type}: ${count}`);
    }
  } else {
    console.log(`\n[${PLUGIN_NAME}] ✅ No anomalies detected in this session`);
  }

  if (stats) {
    console.log(`\n[${PLUGIN_NAME}] 📈 Session Statistics`);
    console.log(`  Mean response time: ${stats.mean.toFixed(0)}ms`);
    console.log(`  Median response time: ${stats.median.toFixed(0)}ms`);
    console.log(`  P95 response time: ${stats.p95.toFixed(0)}ms`);
    console.log(`  Std deviation: ${stats.stdDev.toFixed(0)}ms`);
  }
});

/**
 * Send anomaly alert to webhook
 */
async function sendWebhookAlert(webhookUrl: string, anomaly: any): Promise<void> {
  try {
    // Format message for Slack/Discord
    const message = {
      text: `🚨 Anomaly Detected: ${anomaly.type}`,
      attachments: [
        {
          color: 'danger',
          fields: [
            {
              title: 'Type',
              value: anomaly.type,
              short: true,
            },
            {
              title: 'Value',
              value: anomaly.value.toFixed(2),
              short: true,
            },
            {
              title: 'Threshold',
              value: anomaly.threshold.toFixed(2),
              short: true,
            },
            {
              title: 'Session',
              value: anomaly.sessionId || 'unknown',
              short: true,
            },
            {
              title: 'Time',
              value: anomaly.timestamp.toLocaleString(),
              short: false,
            },
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      console.error(`[${PLUGIN_NAME}] Webhook failed: ${response.statusText}`);
    } else {
      console.log(`[${PLUGIN_NAME}] ✅ Alert sent to webhook`);
    }
  } catch (error) {
    console.error(`[${PLUGIN_NAME}] Webhook error:`, error);
  }
}

// Run the hook
manager.run();
