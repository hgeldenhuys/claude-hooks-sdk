#!/usr/bin/env bun
/**
 * Analytics Tracker Log Viewer
 *
 * Transforms JSONL output into human-readable format
 *
 * Usage:
 *   tail -f .claude/logs/analytics-tracker.jsonl | bun .claude/scripts/analytics-tracker-viewer.ts
 */

import chalk from 'chalk';

// Read from stdin line by line
for await (const line of console) {
  try {
    const entry = JSON.parse(line);
    const time = new Date(entry.timestamp).toLocaleTimeString();

    switch (entry.event) {
      case 'session_start':
        console.log(chalk.blue(`[${time}] 📊 Session started: ${entry.session_id}`));
        break;

      case 'turn_complete':
        const cost = chalk.green(`$${entry.cost.total.toFixed(4)}`);
        const tokens = chalk.cyan(entry.tokens.total.toLocaleString());
        console.log(chalk.blue(`[${time}]`) + ` 💰 Turn ${entry.turn}: ${cost} | ${tokens} tokens`);
        break;

      case 'session_end':
        console.log(chalk.blue(`\n[${time}] 📊 Session Summary`));
        console.log(chalk.gray(`  Duration: ${entry.duration}`));
        console.log(chalk.gray(`  Turns: ${entry.turns}`));
        console.log(chalk.gray(`  Tokens: ${entry.tokens.total.toLocaleString()} (${entry.tokens.input.toLocaleString()} in / ${entry.tokens.output.toLocaleString()} out)`));
        console.log(chalk.green(`  Cost: $${entry.cost.total.toFixed(4)} ($${entry.cost.input.toFixed(4)} in / $${entry.cost.output.toFixed(4)} out)`));
        console.log(chalk.gray(`  Tools: ${entry.tools.unique} different tools used`));
        console.log(chalk.gray(`  Errors: ${entry.errors} (${(entry.errorRate * 100).toFixed(1)}% error rate)`));

        if (entry.tools.top && entry.tools.top.length > 0) {
          const topToolsStr = entry.tools.top.map((t: any) => `${t.tool}(${t.count})`).join(', ');
          console.log(chalk.gray(`  Top tools: ${topToolsStr}`));
        }
        break;

      case 'all_time_stats':
        console.log(chalk.blue(`\n[${time}] 📈 All-Time Statistics`));
        console.log(chalk.gray(`  Total sessions: ${entry.totalSessions}`));
        console.log(chalk.green(`  Total cost: $${entry.totalCost.toFixed(2)}`));
        console.log(chalk.green(`  Average cost: $${entry.averageCost.toFixed(4)} per session`));
        console.log(chalk.gray(`  Total tokens: ${entry.totalTokens.toLocaleString()}`));
        console.log(chalk.gray(`  Average turns: ${entry.averageTurns.toFixed(1)} per session`));
        break;
    }
  } catch (err) {
    // Ignore parse errors
  }
}
