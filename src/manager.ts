/**
 * Hook Manager
 * Core manager for registering and executing Claude Code hook handlers
 */

import { createReadStream, existsSync, mkdirSync, appendFileSync, readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';
import { join } from 'path';
import { ContextTracker, type EventContext } from './context-tracker';
import type {
  AnyHookInput,
  AnyHookOutput,
  HookContext,
  HookEventName,
  HookHandler,
  HookResult,
  NotificationInput,
  NotificationOutput,
  PostToolUseInput,
  PostToolUseOutput,
  PreCompactInput,
  PreCompactOutput,
  PreToolUseInput,
  PreToolUseOutput,
  SessionEndInput,
  SessionEndOutput,
  SessionStartInput,
  SessionStartOutput,
  StopInput,
  StopOutput,
  SubagentStopInput,
  SubagentStopOutput,
  TranscriptLine,
  UserPromptSubmitInput,
  UserPromptSubmitOutput,
} from './types';

/**
 * Failed event entry in the error queue
 */
export interface FailedEvent {
  event: AnyHookInput;
  error: string;
  timestamp: string;
  retryCount: number;
}

/**
 * Plugin interface for extending HookManager functionality
 */
export interface HookPlugin {
  name: string;
  onBeforeExecute?: (input: AnyHookInput, context: HookContext) => Promise<void> | void;
  onAfterExecute?: (
    input: AnyHookInput,
    result: HookResult<AnyHookOutput>,
    context: HookContext,
    conversation?: any | null
  ) => Promise<void> | void;
}

export interface HookManagerOptions {
  /**
   * Enable debug logging to stdout
   */
  debug?: boolean;

  /**
   * Enable event logging to file
   * Logs will be saved to .claude-hooks/{clientId}/events.jsonl
   */
  logEvents?: boolean;

  /**
   * Client identifier for organizing logs
   * Default: 'default'
   */
  clientId?: string;

  /**
   * Custom log directory path
   * Default: .claude-hooks/{clientId}
   */
  logDir?: string;

  /**
   * Enable failure queue for sequential event processing
   * When enabled, failed events are stored and must be drained before new events are processed
   * Failed events are saved to .claude-hooks/{clientId}/error-queue.jsonl
   */
  enableFailureQueue?: boolean;

  /**
   * Callback to notify consumer when error queue has items
   * Called with the current queue size when a new event arrives but queue is not empty
   */
  onErrorQueueNotEmpty?: (queueSize: number, failedEvents: FailedEvent[]) => Promise<void> | void;

  /**
   * Make hook failures blocking (exit with error code)
   * When false (default), hook failures are logged but don't block Claude Code
   * When true, hook failures will block Claude Code execution
   * Default: false (non-blocking)
   */
  blockOnFailure?: boolean;

  /**
   * Maximum retry attempts for failed events
   * Default: 3
   */
  maxRetries?: number;

  /**
   * Enable context tracking (transaction IDs, prompt IDs, git metadata)
   * When enabled, all events are enriched with correlation context
   * Default: true
   */
  enableContextTracking?: boolean;

  /**
   * Track file edits between UserPromptSubmit and Stop events
   * When enabled, all Edit, Write, and MultiEdit tool file paths are collected and attached to Stop event
   * Default: false
   */
  trackEdits?: boolean;

  /**
   * Maximum number of queued events to drain per hook event
   * Prevents blocking when error queue has many items
   * Default: 10
   */
  maxQueueDrainPerEvent?: number;

  /**
   * Automatically drain error queue on every hook event
   * When false, queue draining must be done manually via drainQueue()
   * Default: true
   */
  autoDrainQueue?: boolean;

  /**
   * Timeout in milliseconds for handler execution
   * If a handler takes longer than this, it will be terminated
   * Default: 30000 (30 seconds)
   * Set to 0 to disable timeout
   */
  handlerTimeout?: number;
}

/**
 * Hook Manager Class
 * Provides a fluent API for registering and executing hook handlers
 */
export class HookManager {
  private handlers: Map<HookEventName, HookHandler<any, any>[]> = new Map();
  private plugins: HookPlugin[] = [];
  private options: HookManagerOptions;
  private logFilePath?: string;
  private errorQueuePath?: string;
  private maxRetries: number;
  private contextTracker?: ContextTracker;
  private editedFiles: Set<string> = new Set();  // Track edited files
  private trackingEdits: boolean = false;         // Active tracking flag

  constructor(options: HookManagerOptions = {}) {
    this.options = options;
    this.maxRetries = options.maxRetries ?? 3;

    const clientId = this.options.clientId || 'default';
    const baseDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const logDir = this.options.logDir || join(baseDir, '.claude', 'hooks', clientId);

    // Ensure log directory exists if logging, failure queue, or context tracking is enabled
    if (this.options.logEvents || this.options.enableFailureQueue || this.options.enableContextTracking !== false) {
      if (!existsSync(logDir)) {
        mkdirSync(logDir, { recursive: true });
      }
    }

    // Setup event logging if enabled
    if (this.options.logEvents) {
      const logsDir = join(logDir, 'logs');
      if (!existsSync(logsDir)) {
        mkdirSync(logsDir, { recursive: true });
      }
      this.logFilePath = join(logsDir, 'events.jsonl');
    }

    // Setup error queue if enabled
    if (this.options.enableFailureQueue) {
      this.errorQueuePath = join(logDir, 'error-queue.jsonl');
    }

    // Setup context tracking
    // Always enable if trackEdits is enabled (editedFiles needs context enrichment)
    // Otherwise respect enableContextTracking option (default: true)
    const shouldEnableContext = this.options.trackEdits || this.options.enableContextTracking !== false;
    if (shouldEnableContext) {
      this.contextTracker = new ContextTracker(clientId, logDir);
    }
  }

  /**
   * Register a plugin to extend functionality
   */
  use(plugin: HookPlugin): this {
    this.plugins.push(plugin);
    return this;
  }

  /**
   * Register a handler for PreToolUse events
   */
  onPreToolUse(handler: HookHandler<PreToolUseInput, PreToolUseOutput>): this {
    return this.on('PreToolUse', handler);
  }

  /**
   * Register a handler for PostToolUse events
   */
  onPostToolUse(handler: HookHandler<PostToolUseInput, PostToolUseOutput>): this {
    return this.on('PostToolUse', handler);
  }

  /**
   * Register a handler for Notification events
   */
  onNotification(handler: HookHandler<NotificationInput, NotificationOutput>): this {
    return this.on('Notification', handler);
  }

  /**
   * Register a handler for UserPromptSubmit events
   */
  onUserPromptSubmit(
    handler: HookHandler<UserPromptSubmitInput, UserPromptSubmitOutput>
  ): this {
    return this.on('UserPromptSubmit', handler);
  }

  /**
   * Register a handler for Stop events
   */
  onStop(handler: HookHandler<StopInput, StopOutput>): this {
    return this.on('Stop', handler);
  }

  /**
   * Register a handler for SubagentStop events
   */
  onSubagentStop(handler: HookHandler<SubagentStopInput, SubagentStopOutput>): this {
    return this.on('SubagentStop', handler);
  }

  /**
   * Register a handler for PreCompact events
   */
  onPreCompact(handler: HookHandler<PreCompactInput, PreCompactOutput>): this {
    return this.on('PreCompact', handler);
  }

  /**
   * Register a handler for SessionStart events
   */
  onSessionStart(handler: HookHandler<SessionStartInput, SessionStartOutput>): this {
    return this.on('SessionStart', handler);
  }

  /**
   * Register a handler for SessionEnd events
   */
  onSessionEnd(handler: HookHandler<SessionEndInput, SessionEndOutput>): this {
    return this.on('SessionEnd', handler);
  }

  /**
   * Register a generic hook handler
   */
  private on<TInput extends AnyHookInput, TOutput extends AnyHookOutput>(
    eventName: HookEventName,
    handler: HookHandler<TInput, TOutput>
  ): this {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
    return this;
  }

  /**
   * Execute all handlers for the given input
   * Returns the result from the last handler that produces output
   */
  async execute(input: AnyHookInput): Promise<HookResult<AnyHookOutput>> {
    // Wrap execution in timeout if configured
    const timeout = this.options.handlerTimeout ?? 30000; // Default 30 seconds

    if (timeout > 0) {
      return this.executeWithTimeout(input, timeout);
    }

    return this.executeHandlers(input);
  }

  /**
   * Execute with timeout support
   */
  private async executeWithTimeout(input: AnyHookInput, timeoutMs: number): Promise<HookResult<AnyHookOutput>> {
    return Promise.race([
      this.executeHandlers(input),
      new Promise<HookResult<AnyHookOutput>>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Handler execution timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  /**
   * Execute all handlers (internal implementation)
   */
  private async executeHandlers(input: AnyHookInput): Promise<HookResult<AnyHookOutput>> {
    // Track file edits if enabled
    if (this.options.trackEdits) {
      this.handleEditTracking(input);
    }

    // Enrich event with context if tracking is enabled
    if (this.contextTracker) {
      input = this.contextTracker.enrichEvent(input);
    }

    const handlers = this.handlers.get(input.hook_event_name) || [];

    if (handlers.length === 0) {
      return { exitCode: 0 };
    }

    const context = createHookContext(input.transcript_path);
    let finalResult: HookResult<AnyHookOutput> = { exitCode: 0 };

    // Get last conversation line for plugins
    let conversation = null;
    try {
      const fullTranscript = await context.getFullTranscript();
      if (fullTranscript.length > 0) {
        const lastLine = fullTranscript[fullTranscript.length - 1];
        conversation = lastLine.content;
      }
    } catch (error) {
      // Transcript not available - this is okay
      conversation = null;
    }

    // Call onBeforeExecute plugins
    for (const plugin of this.plugins) {
      try {
        await plugin.onBeforeExecute?.(input, context);
      } catch (error) {
        if (this.options.debug) {
          console.error(`[claude-hooks-sdk] Plugin "${plugin.name}" onBeforeExecute failed:`, error);
        }
        // Continue with other plugins - don't let one plugin crash the hook
      }
    }

    // Execute handlers in sequence
    for (const handler of handlers) {
      const result = await handler(input, context);

      // Merge results, with later handlers taking precedence
      finalResult = {
        exitCode: result.exitCode !== 0 ? result.exitCode : finalResult.exitCode,
        stdout: result.stdout || finalResult.stdout,
        stderr: result.stderr || finalResult.stderr,
        output: result.output || finalResult.output,
      };

      // If a handler returns exit code 2 or sets continue: false, stop the chain
      if (result.exitCode === 2 || result.output?.continue === false) {
        break;
      }
    }

    // Call onAfterExecute plugins with structured data
    for (const plugin of this.plugins) {
      try {
        await plugin.onAfterExecute?.(input, finalResult, context, conversation);
      } catch (error) {
        if (this.options.debug) {
          console.error(`[claude-hooks-sdk] Plugin "${plugin.name}" onAfterExecute failed:`, error);
        }
        // Continue with other plugins - don't let one plugin crash the hook
      }
    }

    // Log event if logging is enabled
    if (this.logFilePath) {
      this.logEvent(input, finalResult, conversation);
    }

    return finalResult;
  }

  /**
   * Read error queue from JSONL file
   */
  private readErrorQueue(): FailedEvent[] {
    if (!this.errorQueuePath || !existsSync(this.errorQueuePath)) {
      return [];
    }

    try {
      const content = readFileSync(this.errorQueuePath, 'utf-8');
      const lines = content.trim().split('\n').filter(line => line.length > 0);
      return lines.map(line => JSON.parse(line));
    } catch (error) {
      if (this.options.debug) {
        console.error('[claude-hooks-sdk] Failed to read error queue:', error);
      }
      return [];
    }
  }

  /**
   * Write error queue to JSONL file
   */
  private writeErrorQueue(queue: FailedEvent[]): void {
    if (!this.errorQueuePath) return;

    try {
      if (queue.length === 0) {
        // Delete the file if queue is empty
        if (existsSync(this.errorQueuePath)) {
          writeFileSync(this.errorQueuePath, '');
        }
        return;
      }

      const content = queue.map(item => JSON.stringify(item)).join('\n') + '\n';
      writeFileSync(this.errorQueuePath, content);
    } catch (error) {
      if (this.options.debug) {
        console.error('[claude-hooks-sdk] Failed to write error queue:', error);
      }
    }
  }

  /**
   * Add failed event to error queue
   */
  private addToErrorQueue(event: AnyHookInput, error: string, retryCount: number = 0): void {
    if (!this.options.enableFailureQueue) return;

    const queue = this.readErrorQueue();
    queue.push({
      event,
      error,
      timestamp: new Date().toISOString(),
      retryCount,
    });
    this.writeErrorQueue(queue);

    if (this.options.debug) {
      console.error(`[claude-hooks-sdk] Added event to error queue (size: ${queue.length})`);
    }
  }

  /**
   * Drain error queue by processing all failed events
   * Returns true if all events were successfully processed
   * @param limit - Maximum number of events to process (default: all)
   */
  private async drainErrorQueue(limit?: number): Promise<boolean> {
    if (!this.options.enableFailureQueue) return true;

    const queue = this.readErrorQueue();
    if (queue.length === 0) return true;

    // Apply limit if specified
    const eventsToProcess = limit ? queue.slice(0, limit) : queue;
    const eventsToKeep = limit ? queue.slice(limit) : [];

    if (this.options.debug) {
      console.error(`[claude-hooks-sdk] Draining error queue (${eventsToProcess.length} of ${queue.length} events)`);
    }

    const remainingQueue: FailedEvent[] = [...eventsToKeep];

    for (const failedEvent of eventsToProcess) {
      try {
        // Retry the failed event
        const result = await this.execute(failedEvent.event);

        if (result.exitCode !== 0) {
          // Still failing
          if (failedEvent.retryCount < this.maxRetries) {
            // Add back to queue with incremented retry count
            remainingQueue.push({
              ...failedEvent,
              retryCount: failedEvent.retryCount + 1,
              timestamp: new Date().toISOString(),
            });

            if (this.options.debug) {
              console.error(
                `[claude-hooks-sdk] Event still failing (retry ${failedEvent.retryCount + 1}/${this.maxRetries})`
              );
            }
          } else {
            // Max retries reached, drop the event
            if (this.options.debug) {
              console.error(
                `[claude-hooks-sdk] Event dropped after ${this.maxRetries} retries: ${failedEvent.error}`
              );
            }
          }
        } else {
          // Successfully processed
          if (this.options.debug) {
            console.error(`[claude-hooks-sdk] Successfully processed queued event`);
          }
        }
      } catch (error) {
        // Error during retry
        if (failedEvent.retryCount < this.maxRetries) {
          remainingQueue.push({
            ...failedEvent,
            retryCount: failedEvent.retryCount + 1,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    // Update queue with remaining failed events
    this.writeErrorQueue(remainingQueue);

    return remainingQueue.length === 0;
  }

  /**
   * Handle edit tracking across UserPromptSubmit -> Stop event lifecycle
   */
  private handleEditTracking(input: AnyHookInput): void {
    const eventName = input.hook_event_name;

    // Start tracking on UserPromptSubmit
    if (eventName === 'UserPromptSubmit') {
      this.trackingEdits = true;
      this.editedFiles.clear();
      if (this.options.debug) {
        console.error('[claude-hooks-sdk] Started tracking edits');
      }
    }

    // Track file-modifying tools in PostToolUse
    if (eventName === 'PostToolUse' && this.trackingEdits) {
      const toolInput = input as any;
      const toolName = toolInput.tool_name;

      // Track Edit, Write, and MultiEdit tools
      if (toolName === 'Edit' || toolName === 'Write') {
        const filePath = toolInput.tool_input?.file_path;
        if (filePath) {
          this.editedFiles.add(filePath);
          if (this.options.debug) {
            console.error(`[claude-hooks-sdk] Tracked ${toolName}: ${filePath}`);
          }
        }
      } else if (toolName === 'MultiEdit') {
        // MultiEdit has an array of edits
        const edits = toolInput.tool_input?.edits;
        if (Array.isArray(edits)) {
          for (const edit of edits) {
            if (edit.file_path) {
              this.editedFiles.add(edit.file_path);
              if (this.options.debug) {
                console.error(`[claude-hooks-sdk] Tracked MultiEdit: ${edit.file_path}`);
              }
            }
          }
        }
      }
    }

    // Attach edited files to Stop event and reset
    if (eventName === 'Stop' && this.trackingEdits) {
      // Add edited files to the input for context enrichment
      (input as any)._editedFiles = Array.from(this.editedFiles);

      if (this.options.debug) {
        console.error(`[claude-hooks-sdk] Stop event - tracked ${this.editedFiles.size} edited files`);
      }

      // Reset tracking
      this.trackingEdits = false;
      this.editedFiles.clear();
    }
  }

  /**
   * Log event to JSONL file
   */
  private logEvent(input: AnyHookInput, result: HookResult<AnyHookOutput>, conversation: any): void {
    if (!this.logFilePath) return;

    try {
      // Extract context from enriched event (if context tracking is enabled)
      const { context, ...hookWithoutContext } = input as any;

      const logEntry = {
        input: {
          hook: hookWithoutContext,
          conversation,
          context: context || null,
          timestamp: new Date().toISOString(),
        },
        output: {
          exitCode: result.exitCode,
          success: result.exitCode === 0,
          hasOutput: result.output !== undefined,
          hasStdout: result.stdout !== undefined,
          hasStderr: result.stderr !== undefined,
        },
      };

      appendFileSync(this.logFilePath, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      // Silently fail - logging should never break the hook
      if (this.options.debug) {
        console.error('[claude-hooks-sdk] Failed to log event:', error);
      }
    }
  }

  /**
   * Manually drain the error queue
   * Note: The queue is automatically drained on every hook event when enableFailureQueue is true.
   * This method is optional and useful for monitoring or manual intervention.
   * Returns the number of events that were successfully processed
   */
  async drainQueue(): Promise<{ processed: number; remaining: number; dropped: number }> {
    if (!this.options.enableFailureQueue) {
      return { processed: 0, remaining: 0, dropped: 0 };
    }

    const initialQueue = this.readErrorQueue();
    const initialSize = initialQueue.length;

    if (initialSize === 0) {
      return { processed: 0, remaining: 0, dropped: 0 };
    }

    await this.drainErrorQueue();

    const remainingQueue = this.readErrorQueue();
    const remainingSize = remainingQueue.length;

    // Count how many were dropped (reached max retries)
    const dropped = initialQueue.filter(e => e.retryCount >= this.maxRetries).length;

    return {
      processed: initialSize - remainingSize - dropped,
      remaining: remainingSize,
      dropped,
    };
  }

  /**
   * Get current error queue status
   */
  getQueueStatus(): { size: number; events: FailedEvent[] } {
    if (!this.options.enableFailureQueue) {
      return { size: 0, events: [] };
    }

    const queue = this.readErrorQueue();
    return { size: queue.length, events: queue };
  }

  /**
   * Execute handlers and output results in Claude Code format
   * Reads from stdin, executes handlers, and writes to stdout/stderr
   */
  async run(): Promise<void> {
    let input = await this.readStdin();

    // Note: Context enrichment happens in execute() method, not here
    // This prevents double enrichment bug

    if (this.options.debug) {
      console.error(`[claude-hooks-sdk] Event: ${input.hook_event_name}`);
    }

    // Check if failure queue is enabled
    if (this.options.enableFailureQueue) {
      // Auto-drain queue if enabled (default: true)
      const shouldAutoDrain = this.options.autoDrainQueue !== false;

      if (shouldAutoDrain) {
        // ALWAYS try to drain the queue first (FIFO order)
        const queueBefore = this.readErrorQueue();

        if (queueBefore.length > 0) {
          if (this.options.debug) {
            console.error(`[claude-hooks-sdk] Draining ${queueBefore.length} queued events before processing new event`);
          }

          // Notify consumer that we're draining the queue
          if (this.options.onErrorQueueNotEmpty) {
            await this.options.onErrorQueueNotEmpty(queueBefore.length, queueBefore);
          }

          // Drain the queue with limit to prevent blocking
          const drainLimit = this.options.maxQueueDrainPerEvent ?? 10;
          await this.drainErrorQueue(drainLimit);

          const queueAfter = this.readErrorQueue();

          // If queue still has items after draining, queue the current event
          if (queueAfter.length > 0) {
            if (this.options.debug) {
              console.error(`[claude-hooks-sdk] Queue still has ${queueAfter.length} events, queueing current event`);
            }

            this.addToErrorQueue(input, 'Queued due to existing error queue', 0);
            process.exit(0);
            return;
          }

          // Queue is now empty, continue to process current event
          if (this.options.debug) {
            console.error(`[claude-hooks-sdk] Queue drained successfully, processing current event`);
          }
        }
      }

      // Queue is empty (or was just drained), process the current event
      try {
        const result = await this.execute(input);

        // If execution failed, add to error queue
        if (result.exitCode !== 0) {
          const errorMessage = result.stderr || result.stdout || 'Handler returned non-zero exit code';
          this.addToErrorQueue(input, errorMessage, 0);

          // Only block Claude Code if blockOnFailure is true
          if (this.options.blockOnFailure) {
            if (result.stderr) {
              console.error(result.stderr);
            }
            process.exit(result.exitCode);
          }
        }

        // Output results
        if (result.output) {
          console.log(JSON.stringify(result.output));
        } else if (result.stdout) {
          console.log(result.stdout);
        }

        if (result.stderr && result.exitCode === 0) {
          console.error(result.stderr);
        }

        // Exit with success (non-blocking mode) or actual exit code (blocking mode)
        process.exit(this.options.blockOnFailure ? result.exitCode : 0);
      } catch (error) {
        // Execution threw an error, add to error queue
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.addToErrorQueue(input, errorMessage, 0);

        // Only block Claude Code if blockOnFailure is true
        if (this.options.blockOnFailure) {
          console.error(errorMessage);
          process.exit(1);
        } else {
          // Log error but exit successfully (non-blocking)
          if (this.options.debug) {
            console.error(`[claude-hooks-sdk] Error (non-blocking): ${errorMessage}`);
          }
          process.exit(0);
        }
      }
    } else {
      // No failure queue, execute normally
      try {
        const result = await this.execute(input);

        // Output results
        if (result.output) {
          console.log(JSON.stringify(result.output));
        } else if (result.stdout) {
          console.log(result.stdout);
        }

        if (result.stderr) {
          console.error(result.stderr);
        }

        // Exit with success (non-blocking mode) or actual exit code (blocking mode)
        process.exit(this.options.blockOnFailure ? result.exitCode : 0);
      } catch (error) {
        // Execution threw an error
        const errorMessage = error instanceof Error ? error.message : String(error);

        // Only block Claude Code if blockOnFailure is true
        if (this.options.blockOnFailure) {
          console.error(errorMessage);
          process.exit(1);
        } else {
          // Log error but exit successfully (non-blocking)
          if (this.options.debug) {
            console.error(`[claude-hooks-sdk] Error (non-blocking): ${errorMessage}`);
          }
          process.exit(0);
        }
      }
    }
  }

  /**
   * Read and parse JSON input from stdin
   */
  private async readStdin(): Promise<AnyHookInput> {
    return new Promise((resolve, reject) => {
      let data = '';

      process.stdin.on('data', (chunk) => {
        data += chunk;
      });

      process.stdin.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(new Error(`Invalid JSON input: ${error}`));
        }
      });

      process.stdin.on('error', reject);
    });
  }
}

// ============================================================================
// Transcript Utilities
// ============================================================================

/**
 * Create a hook context with transcript access utilities
 */
export function createHookContext(transcriptPath: string): HookContext {
  return {
    transcriptPath,
    getTranscriptLine: (lineNumber: number) => getTranscriptLine(transcriptPath, lineNumber),
    getFullTranscript: () => getFullTranscript(transcriptPath),
    searchTranscript: (predicate) => searchTranscript(transcriptPath, predicate),
  };
}

/**
 * Read a specific line from the transcript file
 */
export async function getTranscriptLine(
  transcriptPath: string,
  lineNumber: number
): Promise<TranscriptLine | null> {
  if (!existsSync(transcriptPath)) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const fileStream = createReadStream(transcriptPath);
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    let currentLine = 0;

    rl.on('line', (line) => {
      currentLine++;
      if (currentLine === lineNumber) {
        try {
          resolve({
            lineNumber,
            content: JSON.parse(line),
            raw: line,
          });
        } catch (error) {
          resolve({
            lineNumber,
            content: null,
            raw: line,
          });
        }
        rl.close();
      }
    });

    rl.on('close', () => {
      resolve(null);
    });

    rl.on('error', reject);
  });
}

/**
 * Read the entire transcript file
 */
export async function getFullTranscript(transcriptPath: string): Promise<TranscriptLine[]> {
  if (!existsSync(transcriptPath)) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const fileStream = createReadStream(transcriptPath);
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity });

    const lines: TranscriptLine[] = [];
    let lineNumber = 0;

    rl.on('line', (line) => {
      lineNumber++;
      try {
        lines.push({
          lineNumber,
          content: JSON.parse(line),
          raw: line,
        });
      } catch (error) {
        lines.push({
          lineNumber,
          content: null,
          raw: line,
        });
      }
    });

    rl.on('close', () => {
      resolve(lines);
    });

    rl.on('error', reject);
  });
}

/**
 * Search transcript lines matching a predicate
 */
export async function searchTranscript(
  transcriptPath: string,
  predicate: (line: TranscriptLine) => boolean
): Promise<TranscriptLine[]> {
  const allLines = await getFullTranscript(transcriptPath);
  return allLines.filter(predicate);
}
