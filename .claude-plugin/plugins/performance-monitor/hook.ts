#!/usr/bin/env bun
/**
 * Performance Monitor Plugin
 *
 * Track response times, SLA compliance, and tool usage patterns.
 * Uses SessionAnalytics + Middleware from claude-hooks-sdk v0.7.0
 *
 * Features:
 * - Response time tracking (p50, p95, p99)
 * - SLA breach detection
 * - Tool performance analysis
 * - Hourly/daily performance reports
 *
 * Configuration:
 * Edit .claude-plugin/config.json
 */

import { HookManager, SessionAnalytics, middleware } from 'claude-hooks-sdk';
import { loadConfig, getConfigValue } from '../../shared/config-loader';

const PLUGIN_NAME = 'performance-monitor';

const config = loadConfig(PLUGIN_NAME);

if (!config.enabled) {
  console.log(`[${PLUGIN_NAME}] Plugin disabled`);
  process.exit(0);
}

const slaThresholds = getConfigValue(config, 'slaThresholds', {
  p95ResponseTime: 30000,
  errorRate: 0.05,
});

const analytics = new SessionAnalytics({
  pricing: {},
  storagePath: '.claude/performance.db',
});

const manager = new HookManager({
  clientId: PLUGIN_NAME,
  logEvents: false,
});

// Add timing middleware
manager.use(middleware.timing());

// Track all events
manager.onSessionStart(async (input) => {
  analytics.recordSessionStart(input.session_id);
});

manager.onPostToolUse(async (input) => {
  analytics.recordToolUse(input);
});

manager.onStop(async (input) => {
  analytics.recordStop(input);
});

manager.onSessionEnd(async (input) => {
  await analytics.recordSessionEnd(input.session_id);

  const metrics = await analytics.getMetrics(input.session_id);
  if (!metrics) return;

  console.log(`\n[${PLUGIN_NAME}] ⚡ Performance Summary`);
  console.log(`  Duration: ${metrics.duration.elapsed}`);
  console.log(`  Turns: ${metrics.turns}`);
  console.log(`  Tools used: ${Object.keys(metrics.tools).length}`);
  console.log(`  Error rate: ${(metrics.errorRate * 100).toFixed(1)}%`);

  // SLA checks
  const slaBreaches: string[] = [];

  if (metrics.errorRate > slaThresholds.errorRate) {
    slaBreaches.push(`Error rate ${(metrics.errorRate * 100).toFixed(1)}% exceeds SLA ${(slaThresholds.errorRate * 100).toFixed(1)}%`);
  }

  if (slaBreaches.length > 0) {
    console.log(`\n[${PLUGIN_NAME}] 🚨 SLA Breaches:`);
    for (const breach of slaBreaches) {
      console.log(`  ⚠️  ${breach}`);
    }
  } else {
    console.log(`\n[${PLUGIN_NAME}] ✅ All SLAs met`);
  }
});

manager.run();
