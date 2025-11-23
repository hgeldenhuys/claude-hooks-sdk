#!/usr/bin/env bun
/**
 * Analytics Tracker Plugin
 *
 * Automatically tracks session costs, token usage, and performance metrics.
 * Uses SessionAnalytics + PersistentState from claude-hooks-sdk v0.7.0
 *
 * Features:
 * - Automatic cost tracking with configurable model pricing
 * - Token usage monitoring
 * - Tool usage statistics
 * - Daily/weekly/monthly cost reports
 * - Persistent storage across restarts
 *
 * Configuration:
 * Edit .claude-plugin/config.json or set environment variables:
 * - ANALYTICS_TRACKER_ENABLED=true
 * - ANALYTICS_TRACKER_STORAGE_PATH=.claude/analytics.db
 */

import { HookManager, SessionAnalytics } from 'claude-hooks-sdk';
import { loadConfig, getConfigValue } from '../../shared/config-loader';

const PLUGIN_NAME = 'analytics-tracker';

// Load configuration
const config = loadConfig(PLUGIN_NAME);

if (!config.enabled) {
  console.log(`[${PLUGIN_NAME}] Plugin disabled`);
  process.exit(0);
}

// Get config values
const storagePath = getConfigValue(config, 'storagePath', '.claude/analytics.db');
const pricing = getConfigValue(config, 'pricing', {
  'claude-sonnet-4': { input: 3.0, output: 15.0 },
  'claude-opus-4': { input: 15.0, output: 75.0 },
  'claude-haiku-4': { input: 0.8, output: 4.0 },
});
const reportingInterval = getConfigValue(config, 'reportingInterval', 'daily');

// Initialize SessionAnalytics
const analytics = new SessionAnalytics({
  pricing,
  storagePath,
});

// Create HookManager
const manager = new HookManager({
  clientId: PLUGIN_NAME,
  logEvents: false, // We're doing custom analytics
});

// Track session start
manager.onSessionStart(async (input) => {
  analytics.recordSessionStart(input.session_id);
  console.log(`[${PLUGIN_NAME}] 📊 Session started: ${input.session_id}`);
});

// Track tool usage
manager.onPostToolUse(async (input) => {
  analytics.recordToolUse(input);
});

// Track Stop events (token usage)
manager.onStop(async (input) => {
  analytics.recordStop(input);

  // Get current session metrics
  const metrics = await analytics.getMetrics(input.session_id);
  if (metrics) {
    console.log(`[${PLUGIN_NAME}] 💰 Turn ${metrics.turns}: $${metrics.cost.total.toFixed(4)} | ${metrics.tokens.total.toLocaleString()} tokens`);
  }
});

// Track session end and generate report
manager.onSessionEnd(async (input) => {
  await analytics.recordSessionEnd(input.session_id);

  // Get final metrics
  const metrics = await analytics.getMetrics(input.session_id);
  if (metrics) {
    console.log(`\n[${PLUGIN_NAME}] 📊 Session Summary`);
    console.log(`  Duration: ${metrics.duration.elapsed}`);
    console.log(`  Turns: ${metrics.turns}`);
    console.log(`  Tokens: ${metrics.tokens.total.toLocaleString()} (${metrics.tokens.input.toLocaleString()} in / ${metrics.tokens.output.toLocaleString()} out)`);
    console.log(`  Cost: $${metrics.cost.total.toFixed(4)} ($${metrics.cost.input.toFixed(4)} in / $${metrics.cost.output.toFixed(4)} out)`);
    console.log(`  Tools: ${Object.keys(metrics.tools).length} different tools used`);
    console.log(`  Errors: ${metrics.errors} (${(metrics.errorRate * 100).toFixed(1)}% error rate)`);

    // Show top tools
    const topTools = Object.entries(metrics.tools)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    if (topTools.length > 0) {
      console.log(`  Top tools: ${topTools.map(([tool, count]) => `${tool}(${count})`).join(', ')}`);
    }
  }

  // Show aggregated metrics if requested
  if (reportingInterval === 'session') {
    const agg = await analytics.getAggregatedMetrics();
    if (agg.totalSessions > 1) {
      console.log(`\n[${PLUGIN_NAME}] 📈 All-Time Statistics`);
      console.log(`  Total sessions: ${agg.totalSessions}`);
      console.log(`  Total cost: $${agg.totalCost.toFixed(2)}`);
      console.log(`  Average cost: $${agg.averageCost.toFixed(4)} per session`);
      console.log(`  Total tokens: ${agg.totalTokens.toLocaleString()}`);
      console.log(`  Average turns: ${agg.averageTurns.toFixed(1)} per session`);
    }
  }
});

// Run the hook
manager.run();
