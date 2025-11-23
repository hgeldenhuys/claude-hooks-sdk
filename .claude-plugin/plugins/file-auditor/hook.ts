#!/usr/bin/env bun
/**
 * File Auditor Plugin
 *
 * Comprehensive file change tracking with audit trails.
 * Uses FileChangeTracker from claude-hooks-sdk v0.6.0 (transforms)
 *
 * Features:
 * - Track all file Write/Edit/MultiEdit operations
 * - Generate audit logs
 * - Git integration (optional)
 * - File change summaries
 *
 * Configuration:
 * Edit .claude-plugin/config.json
 */

import { HookManager, FileChangeTracker } from 'claude-hooks-sdk';
import { loadConfig, getConfigValue } from '../../shared/config-loader';
import * as fs from 'fs';

const PLUGIN_NAME = 'file-auditor';

const config = loadConfig(PLUGIN_NAME);

if (!config.enabled) {
  console.log(`[${PLUGIN_NAME}] Plugin disabled`);
  process.exit(0);
}

const auditLogPath = getConfigValue(config, 'auditLogPath', '.claude/file-audit.log');
const gitIntegration = getConfigValue(config, 'gitIntegration', false);

const tracker = new FileChangeTracker();

const manager = new HookManager({
  clientId: PLUGIN_NAME,
  logEvents: false,
});

// Track file changes
manager.onPostToolUse(async (input) => {
  const change = tracker.recordChange(input);

  if (change) {
    // Log to audit file
    const logEntry = `${new Date().toISOString()} | ${change.operation.toUpperCase()} | ${change.file} | session:${change.session_id}\n`;
    fs.appendFileSync(auditLogPath, logEntry);

    console.log(`[${PLUGIN_NAME}] 📝 ${change.operation.toUpperCase()}: ${change.file}`);
  }
});

// Show summary on session end
manager.onSessionEnd(async (input) => {
  const batch = tracker.getBatch(input.session_id);

  if (batch.changes.length > 0) {
    console.log(`\n[${PLUGIN_NAME}] 📊 File Change Summary`);
    console.log(`  Total changes: ${batch.changes.length}`);
    console.log(`  Files modified: ${batch.files.length}`);
    console.log(`  Operations: ${Object.entries(batch.operations).map(([op, count]) => `${op}(${count})`).join(', ')}`);

    console.log(`\n  Files:`);
    for (const file of batch.files.slice(0, 10)) {
      console.log(`    - ${file}`);
    }
    if (batch.files.length > 10) {
      console.log(`    ... and ${batch.files.length - 10} more`);
    }
  } else {
    console.log(`\n[${PLUGIN_NAME}] No files modified this session`);
  }
});

manager.run();
