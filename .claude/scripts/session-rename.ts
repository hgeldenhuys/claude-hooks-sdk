#!/usr/bin/env bun
/**
 * Session Rename CLI
 *
 * Rename a session manually. The new name will be marked as manual and won't be
 * auto-regenerated on future resumes.
 *
 * Usage:
 *   # Rename by current name
 *   bun .claude/scripts/session-rename.ts brave-elephant "refactor-sse"
 *
 *   # Rename by session ID
 *   bun .claude/scripts/session-rename.ts af13b3cd-5185-42df-aa85-3bf6e52e1810 "bugfix-viewer"
 *
 *   # Use quotes for names with special characters
 *   bun .claude/scripts/session-rename.ts brave-elephant "feature: implement dashboard"
 */

import { getSessionId, getSessionName, renameSession } from 'claude-hooks-sdk';
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

// Get arguments
const currentIdentifier = args[0];
const newName = args[1];

if (!currentIdentifier || !newName) {
  console.error('Usage: bun .claude/scripts/session-rename.ts <current-name-or-id> <new-name>');
  console.error('');
  console.error('Examples:');
  console.error('  bun .claude/scripts/session-rename.ts brave-elephant "refactor-sse"');
  console.error('  bun .claude/scripts/session-rename.ts af13b3cd "bugfix-viewer"');
  process.exit(1);
}

// Determine if currentIdentifier is a UUID or a name
const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentIdentifier);

let sessionId: string;
let oldName: string;

if (isUUID) {
  // currentIdentifier is a session ID
  sessionId = currentIdentifier;
  const name = getSessionName(sessionId);
  if (!name) {
    console.error(`Error: No session found with ID: ${sessionId}`);
    process.exit(1);
  }
  oldName = name;
} else {
  // currentIdentifier is a name
  oldName = currentIdentifier;
  const id = getSessionId(oldName);
  if (!id) {
    console.error(`Error: No session found with name: ${oldName}`);
    process.exit(1);
  }
  sessionId = id;
}

// Validate new name
if (newName.length === 0) {
  console.error('Error: New name cannot be empty');
  process.exit(1);
}

if (newName.length > 100) {
  console.error('Error: New name is too long (max 100 characters)');
  process.exit(1);
}

// Attempt rename
try {
  renameSession(sessionId, newName);
  console.log(`✅ Session renamed successfully!`);
  console.log(`   Old name: ${oldName}`);
  console.log(`   New name: ${newName}`);
  console.log(`   Session ID: ${sessionId.substring(0, 8)}...`);
  console.log('');
  console.log('The session is now marked as manually named and will not be auto-regenerated.');
} catch (error) {
  if (error instanceof Error) {
    console.error(`Error: ${error.message}`);
  } else {
    console.error('Error: Failed to rename session');
  }
  process.exit(1);
}
