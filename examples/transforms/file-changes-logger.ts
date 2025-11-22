#!/usr/bin/env bun
/**
 * File Changes Logger Example
 *
 * This example demonstrates how to track file modifications from Write, Edit,
 * and MultiEdit tool uses, logging them in a structured format.
 *
 * Output format:
 * {
 *   "file": "src/components/Button.tsx",
 *   "operation": "modified",
 *   "tool": "Edit",
 *   "timestamp": "2025-11-21T23:00:00.000Z",
 *   "session_id": "abc123",
 *   "size_hint": 1234
 * }
 *
 * On Stop, also outputs a batch summary:
 * {
 *   "changes": [...],
 *   "session_id": "abc123",
 *   "timestamp": "2025-11-21T23:05:00.000Z",
 *   "total_files": 5
 * }
 *
 * Usage:
 *   bun packages/hooks-sdk/examples/transforms/file-changes-logger.ts
 */

import {
  HookManager,
  success,
  FileChangeTracker,
  type PostToolUseInput,
  type StopInput,
} from '../../src';

// Initialize file change tracker
const fileTracker = new FileChangeTracker();

// Create hook manager
const manager = new HookManager({
  debugHooks: false, // Disable default logging for cleaner output
});

// Track file changes on PostToolUse
manager.onPostToolUse((input: PostToolUseInput) => {
  const change = fileTracker.recordChange(input);

  if (change) {
    // Log individual file change
    console.log('FILE_CHANGE:', JSON.stringify(change, null, 2));
  }

  return success();
});

// Log batch summary on Stop
manager.onStop((input: StopInput) => {
  const batch = fileTracker.getBatch(input.session_id);

  if (batch.total_files > 0) {
    console.log('BATCH_SUMMARY:', JSON.stringify(batch, null, 2));

    // Log unique files modified
    const uniqueFiles = fileTracker.getUniqueFiles(input.session_id);
    console.log(`UNIQUE_FILES: ${uniqueFiles.length} files modified`);
    uniqueFiles.forEach((file) => {
      const count = fileTracker.getFileModificationCount(input.session_id, file);
      console.log(`  - ${file} (${count}x)`);
    });
  }

  return success();
});

// Run the manager
manager.run();
