/**
 * Utility Functions
 * Helper functions for working with hooks
 */

import type { AnyHookOutput, HookResult } from './types';
import {
  EXIT_CODE_SUCCESS,
  EXIT_CODE_ERROR,
  EXIT_CODE_BLOCK,
} from './constants';

/**
 * Create a success result
 *
 * @param stdout - Optional stdout message
 * @param output - Optional typed output object
 * @returns HookResult with exit code 0
 *
 * @example
 * ```typescript
 * return success(); // Simple success
 * return success('Operation completed'); // With message
 * return success(undefined, { systemMessage: 'Done' }); // With output
 * ```
 */
export function success<TOutput extends AnyHookOutput>(
  stdout?: string,
  output?: TOutput
): HookResult<TOutput> {
  return { exitCode: EXIT_CODE_SUCCESS, stdout, output };
}

/**
 * Create a blocking error result (exit code 2)
 * This will prevent Claude Code from continuing with the operation.
 *
 * @param stderr - Error message to display
 * @param output - Optional typed output object
 * @returns HookResult with exit code 2
 * @throws Error if stderr is empty
 *
 * @example
 * ```typescript
 * return block('Dangerous command detected!');
 * return block('Access denied', { decision: 'block', reason: 'Security policy' });
 * ```
 */
export function block<TOutput extends AnyHookOutput>(
  stderr: string,
  output?: TOutput
): HookResult<TOutput> {
  if (!stderr || stderr.trim() === '') {
    throw new Error('block() requires a non-empty error message');
  }
  return { exitCode: EXIT_CODE_BLOCK, stderr, output };
}

/**
 * Create a non-blocking error result
 * This logs an error but allows Claude Code to continue.
 *
 * @param stderr - Error message to log
 * @param exitCode - Exit code (default: 1)
 * @returns HookResult with specified exit code
 * @throws Error if stderr is empty
 *
 * @example
 * ```typescript
 * return error('Failed to log event'); // Default exit code 1
 * return error('Custom error', 3); // Custom exit code
 * ```
 */
export function error<TOutput extends AnyHookOutput>(
  stderr: string,
  exitCode: number = EXIT_CODE_ERROR
): HookResult<TOutput> {
  if (!stderr || stderr.trim() === '') {
    throw new Error('error() requires a non-empty error message');
  }
  return { exitCode, stderr };
}

/**
 * Helper to check if a tool name matches a pattern
 * Supports glob-like patterns with * wildcards.
 *
 * @param toolName - The tool name to check
 * @param pattern - The pattern to match against ('*' matches all, supports wildcards)
 * @returns true if the tool name matches the pattern
 * @throws Error if toolName is not a string
 *
 * @example
 * ```typescript
 * matchesTool('Bash', 'Bash'); // true
 * matchesTool('mcp__chrome__click', 'mcp__*'); // true
 * matchesTool('Read', '*'); // true
 * matchesTool('Write', 'Read|Write'); // true
 * ```
 */
export function matchesTool(toolName: string, pattern: string): boolean {
  if (typeof toolName !== 'string') {
    throw new Error('toolName must be a string');
  }
  if (typeof pattern !== 'string') {
    throw new Error('pattern must be a string');
  }

  if (pattern === '*' || pattern === '') {
    return true;
  }

  // Convert glob-like pattern to regex
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*/g, '.*')
    .replace(/\|/g, '|');

  return new RegExp(`^${regexPattern}$`).test(toolName);
}

/**
 * Helper to check if a tool is an MCP tool
 * MCP tools follow the naming convention: mcp__<server>__<tool>
 *
 * @param toolName - The tool name to check
 * @returns true if the tool is an MCP tool
 *
 * @example
 * ```typescript
 * isMCPTool('mcp__chrome__click'); // true
 * isMCPTool('Bash'); // false
 * ```
 */
export function isMCPTool(toolName: string): boolean {
  if (typeof toolName !== 'string') {
    return false;
  }
  return toolName.startsWith('mcp__');
}

/**
 * Parse MCP tool name into components
 *
 * @param toolName - The MCP tool name to parse
 * @returns Object with server and tool names, or null if not a valid MCP tool
 *
 * @example
 * ```typescript
 * parseMCPTool('mcp__chrome__click'); // { server: 'chrome', tool: 'click' }
 * parseMCPTool('mcp__ref__search_docs'); // { server: 'ref', tool: 'search_docs' }
 * parseMCPTool('Bash'); // null
 * ```
 */
export function parseMCPTool(toolName: string): { server: string; tool: string } | null {
  if (!isMCPTool(toolName)) {
    return null;
  }

  const parts = toolName.split('__');
  if (parts.length < 3) {
    return null;
  }

  return {
    server: parts[1]!,
    tool: parts.slice(2).join('__'),
  };
}
