#!/usr/bin/env bun

/**
 * Transaction Viewer CLI
 *
 * Beautiful terminal viewer for transaction logs
 *
 * Usage:
 *   bun viewer.ts                    # View all transactions
 *   bun viewer.ts --latest 10        # View latest 10 transactions
 *   bun viewer.ts --session <id>     # Filter by session
 *   bun viewer.ts --watch            # Watch mode (tail -f style)
 */

import fs from 'fs';
import path from 'path';
import type { Transaction } from './transformer';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',

  // Colors
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

function color(text: string, ...colorCodes: string[]): string {
  return colorCodes.join('') + text + colors.reset;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

function printDivider(char = '─', length = 80): void {
  console.log(color(char.repeat(length), colors.gray));
}

function printHeader(): void {
  console.log();
  console.log(color('╔════════════════════════════════════════════════════════════════════════════╗', colors.cyan, colors.bright));
  console.log(color('║', colors.cyan, colors.bright) + color('                      TRANSACTION LOG VIEWER                                ', colors.cyan) + color('║', colors.cyan, colors.bright));
  console.log(color('╚════════════════════════════════════════════════════════════════════════════╝', colors.cyan, colors.bright));
  console.log();
}

function printTransaction(tx: Transaction, index?: number): void {
  const txId = tx.transaction_id.substring(0, 8);
  const sessionName = tx.session_name || tx.session_id.substring(0, 8);
  const duration = formatDuration(tx.duration_ms);
  const timestamp = formatTimestamp(tx.timestamp_start);

  // Header
  if (index !== undefined) {
    console.log(color(`#${index + 1}`, colors.gray, colors.bright) + ' ' + color(txId, colors.cyan, colors.bright));
  } else {
    console.log(color(txId, colors.cyan, colors.bright));
  }

  console.log(color(`  Session: `, colors.gray) + color(sessionName, colors.blue));
  console.log(color(`  Time: `, colors.gray) + timestamp + color(` (${duration})`, colors.dim));

  // User prompts
  if (tx.user_prompts.length > 0) {
    console.log();
    console.log(color('  💬 User Prompts:', colors.magenta, colors.bright));
    for (const prompt of tx.user_prompts) {
      const preview = truncate(prompt, 70);
      console.log(color('    → ', colors.gray) + preview);
    }
  }

  // Assistant response
  if (tx.assistant_response) {
    console.log();
    console.log(color('  🤖 Assistant:', colors.green, colors.bright));
    const preview = truncate(tx.assistant_response, 70);
    console.log(color('    ', colors.gray) + preview);

    if (tx.transcript_line_number) {
      console.log(color(`    (Line ${tx.transcript_line_number})`, colors.gray, colors.dim));
    }
  }

  // Files changed
  if (tx.files_changed.length > 0) {
    console.log();
    console.log(color(`  📝 Files Changed (${tx.files_changed.length}):`, colors.yellow, colors.bright));
    for (const file of tx.files_changed.slice(0, 5)) {
      const op = file.operation.toUpperCase();
      const fileName = path.basename(file.path);
      const lines = file.lines_changed ? ` (${file.lines_changed} lines)` : '';
      console.log(color('    ', colors.gray) + color(op, colors.yellow) + color(`: ${fileName}${lines}`, colors.dim));
    }
    if (tx.files_changed.length > 5) {
      console.log(color(`    ... and ${tx.files_changed.length - 5} more`, colors.gray, colors.dim));
    }
  }

  // Todos
  if (tx.todos_created.length > 0) {
    console.log();
    console.log(color(`  ✅ Todos (${tx.todos_created.length}):`, colors.cyan, colors.bright));
    for (const todo of tx.todos_created.slice(0, 3)) {
      const statusIcon = todo.status === 'completed' ? '✓' : todo.status === 'in_progress' ? '▶' : '○';
      const statusColor = todo.status === 'completed' ? colors.green : todo.status === 'in_progress' ? colors.yellow : colors.gray;
      const content = truncate(todo.content, 60);
      console.log(color(`    ${statusIcon} `, statusColor) + content);
    }
    if (tx.todos_created.length > 3) {
      console.log(color(`    ... and ${tx.todos_created.length - 3} more`, colors.gray, colors.dim));
    }
  }

  // Summary
  console.log();
  console.log(color('  📊 Summary:', colors.bright));
  console.log(color('    ', colors.gray) + `Tools: ${tx.summary.unique_tools.join(', ')}`);
  console.log(color('    ', colors.gray) + `${tx.summary.total_files_changed} files • ${tx.summary.total_todos_created} todos • ${tx.summary.total_tools_used} tool calls`);

  printDivider();
  console.log();
}

function printSummaryStats(transactions: Transaction[]): void {
  const totalFiles = transactions.reduce((sum, tx) => sum + tx.summary.total_files_changed, 0);
  const totalTodos = transactions.reduce((sum, tx) => sum + tx.summary.total_todos_created, 0);
  const totalTools = transactions.reduce((sum, tx) => sum + tx.summary.total_tools_used, 0);
  const totalDuration = transactions.reduce((sum, tx) => sum + tx.duration_ms, 0);

  const allTools = new Set<string>();
  for (const tx of transactions) {
    for (const tool of tx.summary.unique_tools) {
      allTools.add(tool);
    }
  }

  console.log(color('📈 Overall Statistics', colors.bright));
  console.log();
  console.log(color('  Transactions: ', colors.gray) + color(transactions.length.toString(), colors.cyan, colors.bright));
  console.log(color('  Files Changed: ', colors.gray) + color(totalFiles.toString(), colors.yellow, colors.bright));
  console.log(color('  Todos Created: ', colors.gray) + color(totalTodos.toString(), colors.green, colors.bright));
  console.log(color('  Total Tool Calls: ', colors.gray) + color(totalTools.toString(), colors.blue, colors.bright));
  console.log(color('  Total Duration: ', colors.gray) + formatDuration(totalDuration));
  console.log(color('  Unique Tools: ', colors.gray) + Array.from(allTools).join(', '));
  console.log();
  printDivider('═');
  console.log();
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  latest: args.includes('--latest') ? parseInt(args[args.indexOf('--latest') + 1] || '10') : undefined,
  session: args.includes('--session') ? args[args.indexOf('--session') + 1] : undefined,
  watch: args.includes('--watch'),
  stats: args.includes('--stats'),
};

// Read log file
const LOG_DIR = path.join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.claude/logs');
const LOG_FILE = path.join(LOG_DIR, 'transactions.jsonl');

if (!fs.existsSync(LOG_FILE)) {
  console.error(color('❌ No transaction log found at:', colors.red) + ` ${LOG_FILE}`);
  console.error(color('   Make sure the transaction-logger hook is configured.', colors.gray));
  process.exit(1);
}

// Read and parse transactions
function readTransactions(): Transaction[] {
  const content = fs.readFileSync(LOG_FILE, 'utf-8');
  const lines = content.trim().split('\n').filter(line => line.length > 0);

  const transactions: Transaction[] = [];
  for (const line of lines) {
    try {
      transactions.push(JSON.parse(line));
    } catch (error) {
      console.error(color('⚠️  Failed to parse line:', colors.yellow), line.substring(0, 100));
    }
  }

  return transactions;
}

function displayTransactions(): void {
  let transactions = readTransactions();

  // Filter by session
  if (options.session) {
    transactions = transactions.filter(tx =>
      tx.session_id.startsWith(options.session!) ||
      tx.session_name?.includes(options.session!)
    );
  }

  // Limit to latest N
  if (options.latest) {
    transactions = transactions.slice(-options.latest);
  }

  // Display
  printHeader();

  if (options.stats) {
    printSummaryStats(transactions);
  }

  for (let i = 0; i < transactions.length; i++) {
    printTransaction(transactions[i], i);
  }

  console.log(color(`Showing ${transactions.length} transaction(s)`, colors.gray, colors.bright));
  console.log();
}

// Watch mode
if (options.watch) {
  console.log(color('👀 Watching for new transactions... (Ctrl+C to exit)', colors.cyan, colors.bright));
  console.log();

  let lastSize = fs.statSync(LOG_FILE).size;

  setInterval(() => {
    const currentSize = fs.statSync(LOG_FILE).size;
    if (currentSize > lastSize) {
      lastSize = currentSize;

      // Read only new transactions
      const allTransactions = readTransactions();
      const newTx = allTransactions[allTransactions.length - 1];

      if (newTx) {
        printTransaction(newTx);
      }
    }
  }, 500);
} else {
  displayTransactions();
}
