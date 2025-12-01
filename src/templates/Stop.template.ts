#!/usr/bin/env bun
/**
 * Stop Hook Template
 *
 * Auto-generated hook for Stop events (fires after each AI response).
 * Uses HookDispatcher pattern for clean handler management.
 */

import { HookDispatcher, builtInHandlers } from 'claude-hooks-sdk';

const dispatcher = new HookDispatcher({
  logger: undefined,
  stopOnError: false,
  parallel: false,
});

// Register built-in SDK handlers
dispatcher.registerMultiple(builtInHandlers.Stop);

// Load and register user handlers from .claude/handlers/Stop/
const projectDir = process.cwd();
const userHandlers = await dispatcher.loadUserHandlers(projectDir, 'Stop');
dispatcher.registerMultiple(userHandlers);

// Run dispatcher
await dispatcher.run();
