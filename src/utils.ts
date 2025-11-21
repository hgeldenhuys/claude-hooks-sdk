/**
 * Utility Functions
 * Helper functions for working with hooks
 */

import type { AnyHookOutput, HookResult } from './types';

/**
 * Create a success result
 */
export function success<TOutput extends AnyHookOutput>(
  stdout?: string,
  output?: TOutput
): HookResult<TOutput> {
  return { exitCode: 0, stdout, output };
}

/**
 * Create a blocking error result (exit code 2)
 */
export function block<TOutput extends AnyHookOutput>(
  stderr: string,
  output?: TOutput
): HookResult<TOutput> {
  return { exitCode: 2, stderr, output };
}

/**
 * Create a non-blocking error result
 */
export function error<TOutput extends AnyHookOutput>(
  stderr: string,
  exitCode: number = 1
): HookResult<TOutput> {
  return { exitCode, stderr };
}

/**
 * Helper to check if a tool name matches a pattern
 */
export function matchesTool(toolName: string, pattern: string): boolean {
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
 */
export function isMCPTool(toolName: string): boolean {
  return toolName.startsWith('mcp__');
}

/**
 * Parse MCP tool name into components
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
