/**
 * File change tracking transform
 *
 * Tracks file modifications from Write, Edit, and MultiEdit tool uses.
 * Provides structured logging of file changes with operation types.
 */

import type { PostToolUseInput, PreToolUseInput } from '../types';

export interface FileChange {
  file: string;
  operation: 'created' | 'modified' | 'deleted';
  tool: string;
  timestamp: string;
  session_id: string;
  size_hint?: number; // Character count for content changes
}

export interface FileChangesBatch {
  changes: FileChange[];
  session_id: string;
  timestamp: string;
  total_files: number;
}

/**
 * File Change Tracker - Stateful tracker for file modifications
 *
 * Usage:
 * ```typescript
 * const fileTracker = new FileChangeTracker();
 *
 * manager
 *   .onPostToolUse((input) => {
 *     const change = fileTracker.recordChange(input);
 *     if (change) {
 *       console.log(JSON.stringify(change, null, 2));
 *     }
 *     return success();
 *   })
 *   .onStop((input) => {
 *     const batch = fileTracker.getBatch(input.session_id);
 *     if (batch.total_files > 0) {
 *       console.log(`Modified ${batch.total_files} files`);
 *     }
 *     return success();
 *   });
 * ```
 */
export class FileChangeTracker {
  private changes: Map<string, FileChange[]> = new Map();
  private readonly fileOperationTools = new Set(['Write', 'Edit', 'MultiEdit']);

  /**
   * Record a file change from PostToolUse hook
   * Returns the change object if a file was modified, null otherwise
   */
  recordChange(input: PostToolUseInput): FileChange | null {
    if (!this.fileOperationTools.has(input.tool_name)) {
      return null;
    }

    const filePath = this.extractFilePath(input);
    if (!filePath) {
      return null;
    }

    const change: FileChange = {
      file: filePath,
      operation: this.determineOperation(input.tool_name),
      tool: input.tool_name,
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
      size_hint: this.extractSizeHint(input),
    };

    // Store in batch for this session
    const sessionChanges = this.changes.get(input.session_id) || [];
    sessionChanges.push(change);
    this.changes.set(input.session_id, sessionChanges);

    return change;
  }

  /**
   * Get all changes for a session as a batch
   */
  getBatch(sessionId: string): FileChangesBatch {
    const changes = this.changes.get(sessionId) || [];

    return {
      changes,
      session_id: sessionId,
      timestamp: new Date().toISOString(),
      total_files: changes.length,
    };
  }

  /**
   * Get changes since last clear
   */
  getChangesSince(sessionId: string, since: Date): FileChange[] {
    const changes = this.changes.get(sessionId) || [];
    return changes.filter((change) => new Date(change.timestamp) > since);
  }

  /**
   * Clear changes for a session
   */
  clearSession(sessionId: string): void {
    this.changes.delete(sessionId);
  }

  /**
   * Clear all changes
   */
  clearAll(): void {
    this.changes.clear();
  }

  /**
   * Get unique files modified in session
   */
  getUniqueFiles(sessionId: string): string[] {
    const changes = this.changes.get(sessionId) || [];
    return Array.from(new Set(changes.map((c) => c.file)));
  }

  /**
   * Get file modification count
   */
  getFileModificationCount(sessionId: string, filePath: string): number {
    const changes = this.changes.get(sessionId) || [];
    return changes.filter((c) => c.file === filePath).length;
  }

  private extractFilePath(input: PostToolUseInput): string | null {
    // Try tool_input.file_path first
    if (input.tool_input?.file_path) {
      return input.tool_input.file_path as string;
    }

    // Try tool_response for MultiEdit
    if (input.tool_name === 'MultiEdit' && input.tool_response?.files) {
      // MultiEdit can affect multiple files - return first for now
      const files = input.tool_response.files as string[];
      return files[0] || null;
    }

    return null;
  }

  private determineOperation(toolName: string): 'created' | 'modified' | 'deleted' {
    switch (toolName) {
      case 'Write':
        return 'created'; // Write creates or overwrites
      case 'Edit':
      case 'MultiEdit':
        return 'modified';
      default:
        return 'modified';
    }
  }

  private extractSizeHint(input: PostToolUseInput): number | undefined {
    // Try to get content length from tool_input
    if (input.tool_input?.content && typeof input.tool_input.content === 'string') {
      return input.tool_input.content.length;
    }

    if (input.tool_input?.new_string && typeof input.tool_input.new_string === 'string') {
      return input.tool_input.new_string.length;
    }

    return undefined;
  }
}

/**
 * Simple function to extract file change from PostToolUse (stateless)
 *
 * Usage:
 * ```typescript
 * manager.onPostToolUse((input) => {
 *   const change = extractFileChange(input);
 *   if (change) {
 *     console.log(JSON.stringify(change, null, 2));
 *   }
 *   return success();
 * });
 * ```
 */
export function extractFileChange(input: PostToolUseInput): FileChange | null {
  const fileOperationTools = new Set(['Write', 'Edit', 'MultiEdit']);

  if (!fileOperationTools.has(input.tool_name)) {
    return null;
  }

  const filePath = input.tool_input?.file_path as string | undefined;
  if (!filePath) {
    return null;
  }

  return {
    file: filePath,
    operation: input.tool_name === 'Write' ? 'created' : 'modified',
    tool: input.tool_name,
    timestamp: new Date().toISOString(),
    session_id: input.session_id,
  };
}

/**
 * Check if tool use is a file operation
 */
export function isFileOperation(toolName: string): boolean {
  return ['Write', 'Edit', 'MultiEdit'].includes(toolName);
}
