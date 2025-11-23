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
 * - JSONL log output for tailing
 *
 * Configuration:
 * Edit .claude-plugin/config.json or set environment variables:
 * - ANALYTICS_TRACKER_ENABLED=true
 * - ANALYTICS_TRACKER_STORAGE_PATH=.claude/analytics.db
 * - ANALYTICS_TRACKER_LOG_PATH=.claude/logs/analytics-tracker.jsonl
 *
 * Usage:
 * tail -f .claude/logs/analytics-tracker.jsonl
 */

import { HookManager, SessionAnalytics } from 'claude-hooks-sdk';
import { loadConfig, getConfigValue } from '../../../.claude-plugin/shared/config-loader';
import * as fs from 'fs';
import * as path from 'path';

const PLUGIN_NAME = 'analytics-tracker';

// Debug: log startup
const debugLog = (msg: string) => {
  fs.appendFileSync('.claude/logs/analytics-debug.log', `${new Date().toISOString()} ${msg}\n`);
};

debugLog('analytics-tracker: Hook starting...');

// Load configuration
const config = loadConfig(PLUGIN_NAME);
debugLog(`analytics-tracker: Config loaded, enabled=${config.enabled}`);

if (!config.enabled) {
  debugLog('analytics-tracker: Disabled, exiting');
  process.exit(0);
}

// Get config values
const storagePath = getConfigValue(config, 'storagePath', '.claude/analytics.db');
const logPath = getConfigValue(config, 'logPath', '.claude/logs/analytics-tracker.jsonl');
const pricing = getConfigValue(config, 'pricing', {
  'claude-sonnet-4': { input: 3.0, output: 15.0 },
  'claude-opus-4': { input: 15.0, output: 75.0 },
  'claude-haiku-4': { input: 0.8, output: 4.0 },
});
const reportingInterval = getConfigValue(config, 'reportingInterval', 'session');

// Ensure log directory exists
const logDir = path.dirname(logPath);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Helper to write JSONL log entries
function log(event: string, data: any) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...data,
  };
  fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
}

// Initialize SessionAnalytics
const analytics = new SessionAnalytics({
  pricing,
  storagePath,
});

// Create HookManager
const manager = new HookManager({
  clientId: PLUGIN_NAME,
  logEvents: false,
});

// Track session start
manager.onSessionStart(async (input) => {
  debugLog(`analytics-tracker: SessionStart event received: ${input.session_id}`);
  analytics.recordSessionStart(input.session_id);
  log('session_start', {
    session_id: input.session_id,
  });
  debugLog('analytics-tracker: SessionStart logged');
});

// Track tool usage
manager.onPostToolUse(async (input) => {
  analytics.recordToolUse(input);
});

// Track Stop events (token usage)
manager.onStop(async (input) => {
  // HookManager automatically enriches input with usage/model from transcript
  // Normalize model name for pricing lookup (claude-sonnet-4-5-20250929 -> claude-sonnet-4)
  const enrichedInput = input as any;
  if (enrichedInput.model) {
    const originalModel = enrichedInput.model;
    // Remove date suffix (20250929, 20241115, etc)
    enrichedInput.model = enrichedInput.model.replace(/-20\d{6}$/, '');
    // Remove minor version if present (claude-sonnet-4-5 -> claude-sonnet-4)
    enrichedInput.model = enrichedInput.model.replace(/-\d+$/, '');
    debugLog(`analytics-tracker: Normalized model ${originalModel} -> ${enrichedInput.model}`);
  }

  if (enrichedInput.usage) {
    const totalTokens = enrichedInput.usage.input_tokens + enrichedInput.usage.output_tokens;
    debugLog(`analytics-tracker: Stop event - tokens=${totalTokens}, model=${enrichedInput.model}`);
  }

  analytics.recordStop(enrichedInput);

  // Get current session metrics
  const metrics = await analytics.getMetrics(input.session_id);
  debugLog(`analytics-tracker: Metrics - turns=${metrics?.turns}, tokens=${metrics?.tokens.total}, cost=${metrics?.cost.total}`);
  if (metrics) {
    log('turn_complete', {
      session_id: input.session_id,
      turn: metrics.turns,
      cost: {
        total: metrics.cost.total,
        input: metrics.cost.input,
        output: metrics.cost.output,
      },
      tokens: {
        total: metrics.tokens.total,
        input: metrics.tokens.input,
        output: metrics.tokens.output,
      },
    });
  }
});

// Track session end and generate report
manager.onSessionEnd(async (input) => {
  await analytics.recordSessionEnd(input.session_id);

  // Get final metrics
  const metrics = await analytics.getMetrics(input.session_id);
  if (metrics) {
    const topTools = Object.entries(metrics.tools)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([tool, count]) => ({ tool, count }));

    log('session_end', {
      session_id: input.session_id,
      duration: metrics.duration.elapsed,
      turns: metrics.turns,
      tokens: {
        total: metrics.tokens.total,
        input: metrics.tokens.input,
        output: metrics.tokens.output,
      },
      cost: {
        total: metrics.cost.total,
        input: metrics.cost.input,
        output: metrics.cost.output,
      },
      tools: {
        unique: Object.keys(metrics.tools).length,
        top: topTools,
      },
      errors: metrics.errors,
      errorRate: metrics.errorRate,
    });
  }

  // Show aggregated metrics if requested
  if (reportingInterval === 'session') {
    const agg = await analytics.getAggregatedMetrics();
    if (agg.totalSessions > 1) {
      log('all_time_stats', {
        totalSessions: agg.totalSessions,
        totalCost: agg.totalCost,
        averageCost: agg.averageCost,
        totalTokens: agg.totalTokens,
        averageTurns: agg.averageTurns,
      });
    }
  }
});

// Run the hook
debugLog('analytics-tracker: Calling manager.run()');
manager.run();
