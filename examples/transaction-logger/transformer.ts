/**
 * Transaction Logger - Comprehensive conversation turn tracker
 *
 * Tracks the full context of each conversation transaction:
 * - User prompts
 * - All tool calls (Read, Write, Edit, Bash, etc.)
 * - Files changed (Write/Edit/MultiEdit with line counts)
 * - Todos created/updated
 * - Assistant response
 * - Transaction metadata (IDs, timestamps, line numbers)
 */

import type {
  UserPromptSubmitInput,
  PostToolUseInput,
  StopInput,
} from 'claude-hooks-sdk';

export interface FileChange {
  path: string;
  operation: 'write' | 'edit' | 'multiedit';
  lines_changed?: number;
  timestamp: string;
}

export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

export interface ToolCall {
  tool_name: string;
  timestamp: string;
  input?: any;
}

export interface Transaction {
  transaction_id: string;
  session_id: string;
  session_name?: string;
  timestamp_start: string;
  timestamp_end: string;
  duration_ms: number;

  user_prompts: string[];
  assistant_response: string | null;
  transcript_line_number?: number;

  files_changed: FileChange[];
  todos_created: TodoItem[];
  tools_used: ToolCall[];

  summary: {
    total_files_changed: number;
    total_todos_created: number;
    total_tools_used: number;
    unique_tools: string[];
  };
}

interface TransactionState {
  transaction_id: string;
  session_id: string;
  session_name?: string;
  timestamp_start: string;
  user_prompts: string[];
  files_changed: FileChange[];
  todos_created: TodoItem[];
  tools_used: ToolCall[];
}

export class TransactionLogger {
  private transactions = new Map<string, TransactionState>();

  /**
   * Record user prompt (call from UserPromptSubmit hook)
   */
  recordUserPrompt(input: UserPromptSubmitInput): void {
    const txId = input.transaction_id || 'unknown';

    // Get or create transaction state
    let tx = this.transactions.get(txId);
    if (!tx) {
      tx = {
        transaction_id: txId,
        session_id: input.session_id,
        session_name: (input as any).session_name,
        timestamp_start: new Date().toISOString(),
        user_prompts: [],
        files_changed: [],
        todos_created: [],
        tools_used: [],
      };
      this.transactions.set(txId, tx);
    }

    // Extract user prompt text
    const promptText = (input as any).prompt_text || (input as any).user_prompt || '';
    tx.user_prompts.push(promptText);
  }

  /**
   * Record tool use (call from PostToolUse hook)
   */
  recordToolUse(input: PostToolUseInput): void {
    const txId = input.transaction_id || 'unknown';
    const tx = this.transactions.get(txId);
    if (!tx) return; // Transaction not started yet

    const toolName = input.tool_name;
    const toolInput = input.tool_input as any;

    // Record tool call
    tx.tools_used.push({
      tool_name: toolName,
      timestamp: new Date().toISOString(),
      input: toolInput,
    });

    // Extract file changes
    if (toolName === 'Write') {
      const lines = toolInput.content?.split('\n').length || 0;
      tx.files_changed.push({
        path: toolInput.file_path,
        operation: 'write',
        lines_changed: lines,
        timestamp: new Date().toISOString(),
      });
    } else if (toolName === 'Edit') {
      const oldLines = toolInput.old_string?.split('\n').length || 0;
      const newLines = toolInput.new_string?.split('\n').length || 0;
      tx.files_changed.push({
        path: toolInput.file_path,
        operation: 'edit',
        lines_changed: Math.abs(newLines - oldLines),
        timestamp: new Date().toISOString(),
      });
    } else if (toolName === 'MultiEdit') {
      const totalEdits = toolInput.edits?.length || 0;
      tx.files_changed.push({
        path: toolInput.file_path,
        operation: 'multiedit',
        lines_changed: totalEdits,
        timestamp: new Date().toISOString(),
      });
    }

    // Extract todos
    if (toolName === 'TodoWrite') {
      const todos = toolInput.todos || [];
      for (const todo of todos) {
        // Only track newly created or modified todos
        const existing = tx.todos_created.find(t => t.content === todo.content);
        if (!existing) {
          tx.todos_created.push({
            content: todo.content,
            status: todo.status,
            activeForm: todo.activeForm,
          });
        }
      }
    }
  }

  /**
   * Complete transaction and return summary (call from Stop hook)
   */
  async completeTransaction(
    input: StopInput,
    context: { getLastTranscriptLine?: () => Promise<any> }
  ): Promise<Transaction | null> {
    const txId = input.transaction_id || 'unknown';
    const tx = this.transactions.get(txId);

    if (!tx) {
      return null; // No transaction found
    }

    // Get assistant response from transcript
    let assistantResponse: string | null = null;
    let transcriptLineNumber: number | undefined = undefined;

    if (context.getLastTranscriptLine) {
      try {
        const lastLine = await context.getLastTranscriptLine();
        transcriptLineNumber = lastLine?.lineNumber;

        // Extract text content from assistant message
        if (lastLine?.message?.content) {
          const content = lastLine.message.content;
          if (Array.isArray(content)) {
            assistantResponse = content
              .filter((block: any) => block.type === 'text')
              .map((block: any) => block.text)
              .join('\n');
          } else if (typeof content === 'string') {
            assistantResponse = content;
          }
        }
      } catch (error) {
        // Transcript not available
      }
    }

    // Calculate duration
    const timestampEnd = new Date().toISOString();
    const startMs = new Date(tx.timestamp_start).getTime();
    const endMs = new Date(timestampEnd).getTime();
    const durationMs = endMs - startMs;

    // Get unique tools
    const uniqueTools = Array.from(new Set(tx.tools_used.map(t => t.tool_name)));

    // Build final transaction
    const transaction: Transaction = {
      transaction_id: tx.transaction_id,
      session_id: tx.session_id,
      session_name: tx.session_name,
      timestamp_start: tx.timestamp_start,
      timestamp_end: timestampEnd,
      duration_ms: durationMs,

      user_prompts: tx.user_prompts,
      assistant_response: assistantResponse,
      transcript_line_number: transcriptLineNumber,

      files_changed: tx.files_changed,
      todos_created: tx.todos_created,
      tools_used: tx.tools_used,

      summary: {
        total_files_changed: tx.files_changed.length,
        total_todos_created: tx.todos_created.length,
        total_tools_used: tx.tools_used.length,
        unique_tools: uniqueTools,
      },
    };

    // Clean up completed transaction
    this.transactions.delete(txId);

    return transaction;
  }

  /**
   * Get current active transactions
   */
  getActiveTransactions(): string[] {
    return Array.from(this.transactions.keys());
  }

  /**
   * Clear all state (useful for testing)
   */
  reset(): void {
    this.transactions.clear();
  }
}

/**
 * Helper to format transaction as human-readable summary
 */
export function formatTransactionSummary(tx: Transaction): string {
  const lines: string[] = [];

  lines.push(`Transaction: ${tx.transaction_id.substring(0, 8)}`);
  lines.push(`Session: ${tx.session_name || tx.session_id.substring(0, 8)}`);
  lines.push(`Duration: ${tx.duration_ms}ms`);
  lines.push('');

  if (tx.user_prompts.length > 0) {
    lines.push(`User Prompts (${tx.user_prompts.length}):`);
    for (const prompt of tx.user_prompts) {
      const preview = prompt.substring(0, 80);
      lines.push(`  - ${preview}${prompt.length > 80 ? '...' : ''}`);
    }
    lines.push('');
  }

  if (tx.assistant_response) {
    const preview = tx.assistant_response.substring(0, 100);
    lines.push(`Assistant Response:`);
    lines.push(`  ${preview}${tx.assistant_response.length > 100 ? '...' : ''}`);
    lines.push('');
  }

  if (tx.files_changed.length > 0) {
    lines.push(`Files Changed (${tx.files_changed.length}):`);
    for (const file of tx.files_changed) {
      lines.push(`  - ${file.operation.toUpperCase()}: ${file.path} (${file.lines_changed} lines)`);
    }
    lines.push('');
  }

  if (tx.todos_created.length > 0) {
    lines.push(`Todos Created (${tx.todos_created.length}):`);
    for (const todo of tx.todos_created) {
      lines.push(`  - [${todo.status}] ${todo.content}`);
    }
    lines.push('');
  }

  lines.push(`Tools Used: ${tx.summary.unique_tools.join(', ')}`);

  return lines.join('\n');
}
