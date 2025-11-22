#!/usr/bin/env bun
/**
 * Todo Logger Example
 *
 * This example demonstrates how to track todo items created and updated
 * via the TodoWrite tool, providing structured logging and statistics.
 *
 * Output format:
 * {
 *   "event_type": "todos_created",
 *   "todos": [
 *     { "content": "Implement feature X", "status": "in_progress", "activeForm": "Implementing feature X" },
 *     { "content": "Write tests", "status": "pending", "activeForm": "Writing tests" }
 *   ],
 *   "added": 2,
 *   "removed": 0,
 *   "completed": 0,
 *   "in_progress": 1,
 *   "pending": 1,
 *   "timestamp": "2025-11-21T23:00:00.000Z",
 *   "session_id": "abc123"
 * }
 *
 * Usage:
 *   bun packages/hooks-sdk/examples/transforms/todo-logger.ts
 */

import {
  HookManager,
  success,
  TodoTracker,
  formatTodos,
  type PostToolUseInput,
  type StopInput,
} from '../../src';

// Initialize todo tracker
const todoTracker = new TodoTracker();

// Create hook manager
const manager = new HookManager({
  debugHooks: false, // Disable default logging for cleaner output
});

// Track todos on PostToolUse
manager.onPostToolUse((input: PostToolUseInput) => {
  const event = todoTracker.recordTodoWrite(input);

  if (event) {
    // Log the todo event
    console.log('TODO_EVENT:', JSON.stringify(event, null, 2));

    // Log formatted todo list
    console.log('\nCurrent Todos:');
    console.log(formatTodos(event.todos));
    console.log('');

    // Log statistics
    const snapshot = todoTracker.getSnapshot(input.session_id);
    if (snapshot) {
      const completionPct = todoTracker.getCompletionPercentage(input.session_id);
      console.log(`Progress: ${completionPct}% complete (${snapshot.completed}/${snapshot.total})`);
      console.log(
        `Status breakdown: ${snapshot.in_progress} in progress, ${snapshot.pending} pending`
      );
      console.log('');
    }
  }

  return success();
});

// Log final todo status on Stop
manager.onStop((input: StopInput) => {
  const snapshot = todoTracker.getSnapshot(input.session_id);

  if (snapshot) {
    const completionPct = todoTracker.getCompletionPercentage(input.session_id);

    console.log('STOP_TODO_SUMMARY:', {
      total: snapshot.total,
      completed: snapshot.completed,
      in_progress: snapshot.in_progress,
      pending: snapshot.pending,
      completion_percentage: completionPct,
      timestamp: snapshot.timestamp,
    });

    // Get todos by status
    const inProgress = todoTracker.getTodosByStatus(input.session_id, 'in_progress');
    if (inProgress.length > 0) {
      console.log('\nCurrently Working On:');
      console.log(formatTodos(inProgress));
    }

    const pending = todoTracker.getTodosByStatus(input.session_id, 'pending');
    if (pending.length > 0) {
      console.log('\nUp Next:');
      console.log(formatTodos(pending));
    }
  }

  return success();
});

// Run the manager
manager.run();
