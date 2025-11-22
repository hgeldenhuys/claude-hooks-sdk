/**
 * Todo tracking transform
 *
 * Extracts and tracks todo items from TodoWrite tool uses.
 * Provides structured logging of todo creation, updates, and completion.
 */

import type { PostToolUseInput } from '../types';

export interface Todo {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

export interface TodoEvent {
  event_type: 'todos_created' | 'todos_updated' | 'todos_completed';
  todos: Todo[];
  old_todos?: Todo[];
  new_todos?: Todo[];
  added: number;
  removed: number;
  completed: number;
  in_progress: number;
  pending: number;
  timestamp: string;
  session_id: string;
}

export interface TodoSnapshot {
  todos: Todo[];
  total: number;
  completed: number;
  in_progress: number;
  pending: number;
  timestamp: string;
  session_id: string;
}

/**
 * Todo Tracker - Stateful tracker for todo items
 *
 * Usage:
 * ```typescript
 * const todoTracker = new TodoTracker();
 *
 * manager.onPostToolUse((input) => {
 *   const event = todoTracker.recordTodoWrite(input);
 *   if (event) {
 *     console.log(JSON.stringify(event, null, 2));
 *   }
 *   return success();
 * });
 * ```
 */
export class TodoTracker {
  private snapshots: Map<string, TodoSnapshot> = new Map();

  /**
   * Record a TodoWrite tool use
   * Returns the todo event if todos were modified, null otherwise
   */
  recordTodoWrite(input: PostToolUseInput): TodoEvent | null {
    if (input.tool_name !== 'TodoWrite') {
      return null;
    }

    const toolInput = input.tool_input as any;
    const toolResponse = input.tool_response as any;

    const oldTodos = toolResponse?.oldTodos || [];
    const newTodos = toolInput?.todos || toolResponse?.newTodos || [];

    const event: TodoEvent = {
      event_type: this.determineEventType(oldTodos, newTodos),
      todos: newTodos,
      old_todos: oldTodos.length > 0 ? oldTodos : undefined,
      new_todos: newTodos,
      added: this.countAdded(oldTodos, newTodos),
      removed: this.countRemoved(oldTodos, newTodos),
      completed: newTodos.filter((t: Todo) => t.status === 'completed').length,
      in_progress: newTodos.filter((t: Todo) => t.status === 'in_progress').length,
      pending: newTodos.filter((t: Todo) => t.status === 'pending').length,
      timestamp: new Date().toISOString(),
      session_id: input.session_id,
    };

    // Store snapshot
    this.snapshots.set(input.session_id, {
      todos: newTodos,
      total: newTodos.length,
      completed: event.completed,
      in_progress: event.in_progress,
      pending: event.pending,
      timestamp: event.timestamp,
      session_id: input.session_id,
    });

    return event;
  }

  /**
   * Get current todo snapshot for session
   */
  getSnapshot(sessionId: string): TodoSnapshot | null {
    return this.snapshots.get(sessionId) || null;
  }

  /**
   * Get todos with specific status
   */
  getTodosByStatus(
    sessionId: string,
    status: 'pending' | 'in_progress' | 'completed'
  ): Todo[] {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot) {
      return [];
    }

    return snapshot.todos.filter((t) => t.status === status);
  }

  /**
   * Get completion percentage
   */
  getCompletionPercentage(sessionId: string): number {
    const snapshot = this.snapshots.get(sessionId);
    if (!snapshot || snapshot.total === 0) {
      return 0;
    }

    return Math.round((snapshot.completed / snapshot.total) * 100);
  }

  /**
   * Clear session todos
   */
  clearSession(sessionId: string): void {
    this.snapshots.delete(sessionId);
  }

  /**
   * Clear all todos
   */
  clearAll(): void {
    this.snapshots.clear();
  }

  private determineEventType(
    oldTodos: Todo[],
    newTodos: Todo[]
  ): 'todos_created' | 'todos_updated' | 'todos_completed' {
    if (oldTodos.length === 0 && newTodos.length > 0) {
      return 'todos_created';
    }

    const oldCompleted = oldTodos.filter((t) => t.status === 'completed').length;
    const newCompleted = newTodos.filter((t) => t.status === 'completed').length;

    if (newCompleted > oldCompleted) {
      return 'todos_completed';
    }

    return 'todos_updated';
  }

  private countAdded(oldTodos: Todo[], newTodos: Todo[]): number {
    return Math.max(0, newTodos.length - oldTodos.length);
  }

  private countRemoved(oldTodos: Todo[], newTodos: Todo[]): number {
    return Math.max(0, oldTodos.length - newTodos.length);
  }
}

/**
 * Simple function to extract todo event from PostToolUse (stateless)
 *
 * Usage:
 * ```typescript
 * manager.onPostToolUse((input) => {
 *   const event = extractTodoEvent(input);
 *   if (event) {
 *     console.log(JSON.stringify(event, null, 2));
 *   }
 *   return success();
 * });
 * ```
 */
export function extractTodoEvent(input: PostToolUseInput): TodoEvent | null {
  if (input.tool_name !== 'TodoWrite') {
    return null;
  }

  const toolInput = input.tool_input as any;
  const toolResponse = input.tool_response as any;

  const oldTodos = toolResponse?.oldTodos || [];
  const newTodos = toolInput?.todos || toolResponse?.newTodos || [];

  return {
    event_type: oldTodos.length === 0 ? 'todos_created' : 'todos_updated',
    todos: newTodos,
    old_todos: oldTodos.length > 0 ? oldTodos : undefined,
    new_todos: newTodos,
    added: Math.max(0, newTodos.length - oldTodos.length),
    removed: Math.max(0, oldTodos.length - newTodos.length),
    completed: newTodos.filter((t: Todo) => t.status === 'completed').length,
    in_progress: newTodos.filter((t: Todo) => t.status === 'in_progress').length,
    pending: newTodos.filter((t: Todo) => t.status === 'pending').length,
    timestamp: new Date().toISOString(),
    session_id: input.session_id,
  };
}

/**
 * Check if tool use is a TodoWrite
 */
export function isTodoWrite(toolName: string): boolean {
  return toolName === 'TodoWrite';
}

/**
 * Format todo list for display
 */
export function formatTodos(todos: Todo[]): string {
  return todos
    .map((todo, index) => {
      const statusIcon =
        todo.status === 'completed' ? '✅' : todo.status === 'in_progress' ? '🔄' : '⏳';
      return `${index + 1}. ${statusIcon} ${todo.content}`;
    })
    .join('\n');
}
