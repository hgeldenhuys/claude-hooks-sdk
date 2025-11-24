/**
 * UserPromptSubmit Hook Helper
 *
 * Provides a simple helper function to create UserPromptSubmit hooks that inject
 * session context into Claude's system prompt on every user message.
 *
 * This is THE MOST IMPORTANT hook pattern - it saves 50-100+ tokens per request
 * by eliminating tool calls to read session files.
 *
 * @example
 * ```typescript
 * #!/usr/bin/env bun
 * import { createUserPromptSubmitHook } from 'claude-hooks-sdk';
 *
 * // That's it! Session context automatically injected
 * createUserPromptSubmitHook();
 * ```
 *
 * @example With customization
 * ```typescript
 * createUserPromptSubmitHook({
 *   injectSessionContext: true,
 *   format: (name, id) => `Session: ${name} | ID: ${id.substring(0, 8)}`,
 *   onError: (err) => console.error('[Session Hook]', err)
 * });
 * ```
 */

import { getSessionName } from './session-namer';
import type { UserPromptSubmitInput } from './types';

/**
 * Options for createUserPromptSubmitHook
 */
export interface CreateUserPromptSubmitHookOptions {
  /**
   * Whether to inject session context into Claude's prompt.
   * @default true
   */
  injectSessionContext?: boolean;

  /**
   * Custom formatter for session context string.
   * @default (name, id) => `Current session: ${name} (${id.substring(0, 8)})`
   */
  format?: (sessionName: string, sessionId: string) => string;

  /**
   * Error handler for hook failures.
   * @default (err) => console.error('[UserPromptSubmit Hook] Error:', err.message)
   */
  onError?: (error: Error) => void;

  /**
   * Additional custom context to inject (optional).
   * Called after session context is added.
   */
  customContext?: (input: UserPromptSubmitInput) => string | Promise<string>;
}

/**
 * Create a UserPromptSubmit hook that automatically injects session context.
 *
 * This helper eliminates the need for Claude to use tools to find session info,
 * saving 50-100+ tokens per request and enabling session-aware workflows.
 *
 * @param options - Configuration options
 *
 * @example Basic usage
 * ```typescript
 * #!/usr/bin/env bun
 * import { createUserPromptSubmitHook } from 'claude-hooks-sdk';
 *
 * createUserPromptSubmitHook();
 * ```
 *
 * @example Custom format
 * ```typescript
 * createUserPromptSubmitHook({
 *   format: (name, id) => `🔵 Session: ${name} (${id.slice(0, 8)})`
 * });
 * ```
 *
 * @example With additional context
 * ```typescript
 * createUserPromptSubmitHook({
 *   customContext: (input) => {
 *     const branch = execSync('git branch --show-current').toString().trim();
 *     return `Git branch: ${branch}`;
 *   }
 * });
 * ```
 */
export async function createUserPromptSubmitHook(
  options: CreateUserPromptSubmitHookOptions = {}
): Promise<void> {
  const {
    injectSessionContext = true,
    format = (name, id) => `Current session: ${name} (${id.substring(0, 8)})`,
    onError = (err) => console.error('[UserPromptSubmit Hook] Error:', err.message),
    customContext,
  } = options;

  try {
    // Read input from stdin
    const stdinText = await Bun.stdin.text();
    let input: UserPromptSubmitInput;

    try {
      input = JSON.parse(stdinText);
    } catch (error) {
      // If parsing fails, exit with success to not block Claude
      console.log(JSON.stringify({}));
      process.exit(0);
    }

    // Build context parts
    const contextParts: string[] = [];

    // Add session context if enabled
    if (injectSessionContext) {
      try {
        const sessionName = getSessionName(input.session_id);
        if (sessionName) {
          contextParts.push(format(sessionName, input.session_id));
        }
      } catch (error) {
        // Session name not available, skip but don't fail
        if (process.env.DEBUG) {
          console.error('[UserPromptSubmit] Session name lookup failed:', error);
        }
      }
    }

    // Add custom context if provided
    if (customContext) {
      try {
        const custom = await customContext(input);
        if (custom && custom.length > 0) {
          contextParts.push(custom);
        }
      } catch (error) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // If we have any context to inject, do it
    if (contextParts.length > 0) {
      console.log(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: contextParts.join('\n')
        }
      }));
    } else {
      // No context, just pass through
      console.log(JSON.stringify({}));
    }

    process.exit(0);
  } catch (error) {
    // On error, continue without injecting context
    onError(error instanceof Error ? error : new Error(String(error)));
    console.log(JSON.stringify({}));
    process.exit(0);
  }
}
