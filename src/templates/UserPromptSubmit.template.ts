#!/usr/bin/env bun
/**
 * UserPromptSubmit Hook Template
 *
 * Auto-generated hook for UserPromptSubmit events.
 * Uses HookDispatcher pattern for clean handler management.
 */

import { HookDispatcher, builtInHandlers } from 'claude-hooks-sdk';

const dispatcher = new HookDispatcher({
  logger: undefined,
  stopOnError: false,
  parallel: false,
});

// Register built-in SDK handlers
dispatcher.registerMultiple(builtInHandlers.UserPromptSubmit);

// Load and register user handlers from .claude/handlers/UserPromptSubmit/
const projectDir = process.cwd();
const userHandlers = await dispatcher.loadUserHandlers(projectDir, 'UserPromptSubmit');
dispatcher.registerMultiple(userHandlers);

// Run dispatcher
await dispatcher.run();
