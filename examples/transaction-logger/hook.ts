#!/usr/bin/env bun

/**
 * Transaction Logger Hook
 *
 * Comprehensive hook that tracks full conversation transactions:
 * - User prompts → tool calls → file changes → todos → assistant response
 * - Writes complete transaction summaries to JSONL
 * - Includes line numbers for fast transcript lookups
 *
 * Usage:
 * Add to .claude/settings.json:
 * {
 *   "hooks": {
 *     "UserPromptSubmit": [
 *       { "type": "command", "command": "bun /path/to/hook.ts" }
 *     ],
 *     "PostToolUse": [
 *       { "type": "command", "command": "bun /path/to/hook.ts" }
 *     ],
 *     "Stop": [
 *       { "type": "command", "command": "bun /path/to/hook.ts" }
 *     ]
 *   }
 * }
 */

import { HookManager, success } from 'claude-hooks-sdk';
import { TransactionLogger, formatTransactionSummary } from './transformer';
import path from 'path';
import fs from 'fs';

// Initialize transaction logger (singleton pattern)
const logger = new TransactionLogger();

// Log file path
const LOG_DIR = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.claude/logs');
const LOG_FILE = path.join(LOG_DIR, 'transactions.jsonl');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Create manager
const manager = new HookManager();

// Track user prompts
manager.onUserPromptSubmit(async (input) => {
  logger.recordUserPrompt(input);
  return success();
});

// Track all tool uses
manager.onPostToolUse(async (input) => {
  logger.recordToolUse(input);
  return success();
});

// Complete transaction and write to JSONL
manager.onStop(async (input, context) => {
  const transaction = await logger.completeTransaction(input, context);

  if (transaction) {
    // Write transaction to JSONL file
    const line = JSON.stringify(transaction);
    fs.appendFileSync(LOG_FILE, line + '\n', 'utf-8');

    // Optional: Print summary to stderr for debugging
    if (process.env.DEBUG_TRANSACTIONS === 'true') {
      console.error('\n=== Transaction Completed ===');
      console.error(formatTransactionSummary(transaction));
      console.error('============================\n');
    }
  }

  return success();
});

// Run the manager
manager.run();
