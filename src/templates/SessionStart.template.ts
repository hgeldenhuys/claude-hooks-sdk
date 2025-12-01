#!/usr/bin/env bun
/**
 * SessionStart Hook Template
 *
 * Auto-generated hook for SessionStart events.
 * Uses HookDispatcher pattern for clean handler management.
 *
 * Handlers run in order:
 * 1. Built-in SDK handlers (session naming, etc.)
 * 2. User handlers from .claude/handlers/SessionStart/ (numeric order)
 */

import { HookDispatcher, builtInHandlers } from 'claude-hooks-sdk';

const dispatcher = new HookDispatcher({
  logger: undefined, // Use default logger
  stopOnError: false, // Continue even if a handler fails
  parallel: false, // Run sequentially to preserve order
});

// Register built-in SDK handlers (always first)
dispatcher.registerMultiple(builtInHandlers.SessionStart);

// Load and register user handlers from .claude/handlers/SessionStart/
const projectDir = process.cwd();
const userHandlers = await dispatcher.loadUserHandlers(projectDir, 'SessionStart');
dispatcher.registerMultiple(userHandlers);

// Run dispatcher
await dispatcher.run();
