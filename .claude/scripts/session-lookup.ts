#!/usr/bin/env bun
/**
 * Session Lookup CLI
 *
 * Bidirectional lookup between session names and session IDs.
 * Use with `claude --resume` for user-friendly session resumption.
 *
 * Usage:
 *   # Name → ID
 *   bun .claude/scripts/session-lookup.ts brave-elephant
 *   # Output: af13b3cd-5185-42df-aa85-3bf6e52e1810
 *
 *   # ID → Name
 *   bun .claude/scripts/session-lookup.ts af13b3cd-5185-42df-aa85-3bf6e52e1810
 *   # Output: brave-elephant
 *
 *   # List all sessions
 *   bun .claude/scripts/session-lookup.ts --list
 *
 *   # Resume by name
 *   claude --resume $(bun .claude/scripts/session-lookup.ts brave-elephant)
 */

import { getSessionName, getSessionId, listSessions } from 'claude-hooks-sdk';
import * as fs from 'fs';
import * as path from 'path';

const SESSIONS_FILE = '.claude/sessions.json';

// Check if sessions file exists
const sessionsPath = path.join(process.cwd(), SESSIONS_FILE);
if (!fs.existsSync(sessionsPath)) {
  console.error('Error: No sessions file found (.claude/sessions.json)');
  console.error('Sessions will be created when you run Claude Code with session naming enabled.');
  process.exit(1);
}

const args = process.argv.slice(2);

// Handle --list flag
if (args.includes('--list') || args.includes('-l')) {
  const sessions = listSessions();

  if (sessions.length === 0) {
    console.log('No sessions found.');
    process.exit(0);
  }

  console.log('\n📝 Sessions:\n');
  for (const { sessionId, info } of sessions) {
    const shortId = sessionId.substring(0, 8);
    const created = new Date(info.created).toLocaleString();
    const manualTag = info.manual ? ' [manual]' : '';
    console.log(`  ${info.name}${manualTag}`);
    console.log(`    ID: ${shortId}...`);
    console.log(`    Created: ${created}`);
    console.log(`    Source: ${info.source}`);
    console.log('');
  }

  process.exit(0);
}

// Get query argument
const query = args[0];

if (!query) {
  console.error('Usage: bun .claude/scripts/session-lookup.ts <name-or-id>');
  console.error('       bun .claude/scripts/session-lookup.ts --list');
  console.error('');
  console.error('Examples:');
  console.error('  bun .claude/scripts/session-lookup.ts brave-elephant');
  console.error('  bun .claude/scripts/session-lookup.ts af13b3cd-5185-42df-aa85-3bf6e52e1810');
  console.error('  bun .claude/scripts/session-lookup.ts --list');
  process.exit(1);
}

// Check if query is a UUID (session ID) or a name
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);

if (isUUID) {
  // Query is a session ID, return the name
  const name = getSessionName(query);
  if (!name) {
    console.error(`Error: No session found with ID: ${query}`);
    process.exit(1);
  }
  console.log(name);
} else {
  // Query is a name, return the session ID
  const sessionId = getSessionId(query);
  if (!sessionId) {
    console.error(`Error: No session found with name: ${query}`);
    process.exit(1);
  }
  console.log(sessionId);
}
