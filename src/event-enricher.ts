/**
 * Event Enricher - Convenience utilities for enriching hook events
 *
 * Provides helpers to automatically enrich hook events with:
 * - Full conversation/transcript data
 * - Git context (branch, commit, repo info)
 * - Structured event payload format
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import type { AnyHookInput, TranscriptLine } from './types';

/**
 * Git context information extracted from the repository
 */
export interface GitContext {
  /** Current git branch name */
  branch?: string;
  /** Current commit SHA (short) */
  commit?: string;
  /** Full commit SHA */
  commitFull?: string;
  /** Repository remote URL */
  remote?: string;
  /** Git user name */
  userName?: string;
  /** Git user email */
  userEmail?: string;
  /** Whether there are uncommitted changes */
  isDirty?: boolean;
  /** Root directory of the git repository */
  rootDir?: string;
}

/**
 * Enriched event payload with full context
 */
export interface EnrichedEventPayload<T extends AnyHookInput = AnyHookInput> {
  /** The original hook event data */
  event: T;
  /** ISO timestamp when this payload was created */
  timestamp: string;
  /** Last message from the transcript (if available) */
  conversation?: TranscriptLine | null;
  /** Git context information (if available) */
  git?: GitContext | null;
}

/**
 * Options for enriching events
 */
export interface EnrichEventOptions {
  /** Whether to include conversation/transcript data (default: true) */
  includeConversation?: boolean;
  /** Whether to include git context (default: true) */
  includeGit?: boolean;
  /** Number of most recent transcript lines to include (default: 1 for last message only) */
  conversationLines?: number;
}

/**
 * Get git context information from the current working directory
 *
 * @param cwd - Working directory to extract git info from
 * @returns Git context object or null if not a git repository
 */
export function getGitContext(cwd: string): GitContext | null {
  try {
    const execOptions = { cwd, encoding: 'utf-8' as const, stdio: 'pipe' as const };

    // Check if it's a git repo
    try {
      execSync('git rev-parse --git-dir', execOptions);
    } catch {
      return null; // Not a git repo
    }

    const context: GitContext = {};

    // Get branch
    try {
      context.branch = execSync('git rev-parse --abbrev-ref HEAD', execOptions)
        .toString()
        .trim();
    } catch {
      // Branch might not exist yet (new repo)
    }

    // Get commit SHA
    try {
      context.commit = execSync('git rev-parse --short HEAD', execOptions)
        .toString()
        .trim();
      context.commitFull = execSync('git rev-parse HEAD', execOptions)
        .toString()
        .trim();
    } catch {
      // No commits yet
    }

    // Get remote URL
    try {
      context.remote = execSync('git config --get remote.origin.url', execOptions)
        .toString()
        .trim();
    } catch {
      // No remote configured
    }

    // Get user info
    try {
      context.userName = execSync('git config user.name', execOptions)
        .toString()
        .trim();
      context.userEmail = execSync('git config user.email', execOptions)
        .toString()
        .trim();
    } catch {
      // Git user not configured
    }

    // Check if dirty (uncommitted changes)
    try {
      const status = execSync('git status --porcelain', execOptions).toString();
      context.isDirty = status.length > 0;
    } catch {
      // Can't determine status
    }

    // Get repo root
    try {
      context.rootDir = execSync('git rev-parse --show-toplevel', execOptions)
        .toString()
        .trim();
    } catch {
      // Can't determine root
    }

    return context;
  } catch (error) {
    // Any unexpected error, return null
    return null;
  }
}

/**
 * Read the last N lines from a transcript file
 *
 * @param transcriptPath - Path to the Claude Code transcript JSONL file
 * @param lineCount - Number of lines to read from the end (default: 1)
 * @returns Array of parsed transcript lines, or null if file can't be read
 */
export async function readTranscript(
  transcriptPath: string,
  lineCount: number = 1
): Promise<TranscriptLine[] | null> {
  if (!transcriptPath || !existsSync(transcriptPath)) {
    return null;
  }

  try {
    const content = await Bun.file(transcriptPath).text();
    const lines = content.trim().split('\n').filter(l => l.length > 0);

    if (lines.length === 0) {
      return null;
    }

    // Get last N lines
    const startIndex = Math.max(0, lines.length - lineCount);
    const targetLines = lines.slice(startIndex);

    return targetLines.map(line => JSON.parse(line));
  } catch (error) {
    // File might be locked, corrupted, or not valid JSON
    return null;
  }
}

/**
 * Enrich a hook event with conversation and git context
 *
 * This is a convenience function that:
 * 1. Reads the last message(s) from the transcript file
 * 2. Extracts git context from the working directory
 * 3. Returns a standardized payload structure
 *
 * @param hookInput - The hook input event from Claude Code
 * @param options - Options to control what gets included
 * @returns Enriched event payload with conversation and git context
 *
 * @example
 * ```typescript
 * const input = JSON.parse(await Bun.stdin.text());
 * const enriched = await enrichEvent(input);
 *
 * console.log(JSON.stringify({
 *   event: enriched.event,
 *   timestamp: enriched.timestamp,
 *   conversation: enriched.conversation,
 *   git: enriched.git
 * }));
 * ```
 *
 * @example With options
 * ```typescript
 * const enriched = await enrichEvent(input, {
 *   includeConversation: true,
 *   includeGit: true,
 *   conversationLines: 5  // Get last 5 messages
 * });
 * ```
 */
export async function enrichEvent<T extends AnyHookInput = AnyHookInput>(
  hookInput: T,
  options: EnrichEventOptions = {}
): Promise<EnrichedEventPayload<T>> {
  const {
    includeConversation = true,
    includeGit = true,
    conversationLines = 1,
  } = options;

  const payload: EnrichedEventPayload<T> = {
    event: hookInput,
    timestamp: new Date().toISOString(),
  };

  // Add conversation context
  if (includeConversation && hookInput.transcript_path) {
    const transcriptLines = await readTranscript(
      hookInput.transcript_path,
      conversationLines
    );

    // If only one line requested, return single object instead of array
    if (transcriptLines && conversationLines === 1) {
      payload.conversation = transcriptLines[0] || null;
    } else {
      payload.conversation = transcriptLines as any;
    }
  }

  // Add git context
  if (includeGit && hookInput.cwd) {
    payload.git = getGitContext(hookInput.cwd);
  }

  return payload;
}

/**
 * Convenience function to get just the last conversation message
 *
 * @param transcriptPath - Path to transcript file
 * @returns Last message or null
 */
export async function getLastMessage(
  transcriptPath: string
): Promise<TranscriptLine | null> {
  const lines = await readTranscript(transcriptPath, 1);
  return lines?.[0] || null;
}

/**
 * Convenience function to get the last N conversation messages
 *
 * @param transcriptPath - Path to transcript file
 * @param count - Number of messages to retrieve
 * @returns Array of messages or null
 */
export async function getLastMessages(
  transcriptPath: string,
  count: number
): Promise<TranscriptLine[] | null> {
  return await readTranscript(transcriptPath, count);
}
