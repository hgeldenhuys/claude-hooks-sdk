/**
 * Built-in Hook Handlers
 *
 * Provides default handlers for common hook events.
 * These are optional - handlers are invoked by HookDispatcher only if registered.
 */

import { DispatcherHandler } from '../hook-dispatcher';
import { sessionStartNamerHandler } from './session-start-namer';

/**
 * Built-in handlers organized by hook event
 */
export const builtInHandlers = {
  SessionStart: [sessionStartNamerHandler],
  SessionEnd: [],
  UserPromptSubmit: [],
  PreToolUse: [],
  PostToolUse: [],
  Stop: [],
  SubagentStop: [],
  PreCompact: [],
  Notification: [],
} as Record<string, DispatcherHandler[]>;

export { sessionStartNamerHandler };
