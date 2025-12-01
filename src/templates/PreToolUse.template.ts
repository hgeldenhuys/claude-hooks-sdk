#!/usr/bin/env bun
/**
 * PreToolUse Hook Template
 *
 * Auto-generated hook for PreToolUse events (fires before tool execution).
 * Uses HookDispatcher pattern for clean handler management.
 */

import { HookDispatcher, builtInHandlers } from 'claude-hooks-sdk';

const dispatcher = new HookDispatcher({
  logger: undefined,
  stopOnError: false,
  parallel: false,
});

dispatcher.registerMultiple(builtInHandlers.PreToolUse);

const projectDir = process.cwd();
const userHandlers = await dispatcher.loadUserHandlers(projectDir, 'PreToolUse');
dispatcher.registerMultiple(userHandlers);

await dispatcher.run();
