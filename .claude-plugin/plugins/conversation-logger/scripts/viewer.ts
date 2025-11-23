#!/usr/bin/env bun
/**
 * Unified Conversation Viewer
 *
 * Shows all sessions in one stream with color-coded borders
 * Each unique session gets assigned a color (cycling through 10 colors)
 * Displays user-friendly session names when available
 *
 * Usage:
 *   tail -f .claude/logs/conversation.jsonl | bun .claude/scripts/conversation-viewer.ts
 */

import chalk from 'chalk';
import { getSessionName } from 'claude-hooks-sdk';

// Terminal colors for sessions (max 10)
const SESSION_COLORS = [
  chalk.cyan,
  chalk.green,
  chalk.yellow,
  chalk.blue,
  chalk.magenta,
  chalk.red,
  chalk.white,
  chalk.gray,
  chalk.greenBright,
  chalk.blueBright,
];

// Simple hash function for deterministic color assignment
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function getSessionColor(sessionId: string) {
  // Use hash of session_id to deterministically assign color
  const colorIndex = hashString(sessionId) % SESSION_COLORS.length;
  return SESSION_COLORS[colorIndex];
}

function formatBorder(sessionId: string, text: string) {
  const color = getSessionColor(sessionId);
  const lines = text.split('\n');
  return lines.map(line => color('│ ') + line).join('\n');
}

function formatSessionDivider(sessionId: string, source: string) {
  const color = getSessionColor(sessionId);
  const shortId = sessionId.substring(0, 8);
  const sessionName = getSessionName(sessionId);

  console.log('');
  console.log(color('╔' + '═'.repeat(78) + '╗'));

  const line1 = ` 🤖 Agent Started`;
  console.log(color('║') + chalk.bold(line1) + ' '.repeat(78 - line1.length) + color('║'));

  // Show: "Session: brave-elephant (af13b3cd)" or just "Session: af13b3cd" if no name
  const line2 = sessionName
    ? `   Session: ${sessionName} (${shortId})`
    : `   Session: ${shortId}`;
  console.log(color('║') + line2 + ' '.repeat(78 - line2.length) + color('║'));

  const line3 = `   Source: ${source}`;
  console.log(color('║') + line3 + ' '.repeat(78 - line3.length) + color('║'));

  console.log(color('╚' + '═'.repeat(78) + '╝'));
  console.log('');
}

function formatSessionEnd(sessionId: string, reason: string) {
  const color = getSessionColor(sessionId);

  console.log('');
  console.log(color('╚' + '═'.repeat(78) + '╝'));
  console.log(color(`  Session ended: ${reason}`));
  console.log('');
}

// Read from stdin line by line
for await (const line of console) {
  try {
    const entry = JSON.parse(line);
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const sessionId = entry.session_id;
    const color = getSessionColor(sessionId);

    switch (entry.event) {
      case 'session_start':
        formatSessionDivider(sessionId, entry.source);
        break;

      case 'user_message':
        console.log(formatBorder(sessionId, chalk.blue(`[${time}] 👤 User:`)));
        console.log(formatBorder(sessionId, chalk.white(entry.content)));
        console.log(formatBorder(sessionId, ''));
        break;

      case 'assistant_message':
        console.log(formatBorder(sessionId, chalk.green(`[${time}] 🤖 Assistant:`)));

        if (entry.thinking) {
          console.log(formatBorder(sessionId, chalk.yellow('💭 Thinking:')));
          console.log(formatBorder(sessionId, chalk.italic.gray(entry.thinking)));
          console.log(formatBorder(sessionId, ''));
        }

        if (entry.text) {
          console.log(formatBorder(sessionId, chalk.white(entry.text)));
        }

        if (entry.tools && entry.tools.length > 0) {
          for (const tool of entry.tools) {
            console.log(formatBorder(sessionId, chalk.cyan(`🔧 ${tool.name}`)));
            if (tool.description) {
              console.log(formatBorder(sessionId, chalk.gray(`   ${tool.description}`)));
            }
          }
        }

        if (entry.usage) {
          const total = entry.usage.input_tokens + entry.usage.output_tokens;
          const cacheInfo = entry.usage.cache_read_input_tokens
            ? chalk.magenta(` [${entry.usage.cache_read_input_tokens.toLocaleString()} cached]`)
            : '';
          console.log(formatBorder(sessionId, chalk.gray(`📊 ${total.toLocaleString()} tokens (${entry.usage.input_tokens.toLocaleString()} in / ${entry.usage.output_tokens.toLocaleString()} out)${cacheInfo}`)));
        }

        console.log(formatBorder(sessionId, ''));
        break;

      case 'session_end':
        formatSessionEnd(sessionId, entry.reason);
        break;
    }

  } catch (err) {
    // Ignore parse errors
  }
}
