/**
 * claude-hooks-sdk
 * Type-safe TypeScript SDK for building Claude Code hook extensions
 *
 * @example
 * ```typescript
 * import { HookManager, success, block } from 'claude-hooks-sdk';
 *
 * const manager = new HookManager();
 *
 * manager.onPreToolUse(async (input, context) => {
 *   if (input.tool_name === 'Bash' && input.tool_input.command.includes('rm -rf')) {
 *     return block('Dangerous command detected!');
 *   }
 *   return success();
 * });
 *
 * manager.run();
 * ```
 */

// Export all types
export type {
  // Core types
  HookEventName,
  ToolName,
  ExitCode,
  PermissionDecision,
  CompactTrigger,
  SessionStartSource,
  SessionEndReason,

  // Input types
  BaseHookInput,
  PreToolUseInput,
  PostToolUseInput,
  NotificationInput,
  UserPromptSubmitInput,
  StopInput,
  SubagentStopInput,
  PreCompactInput,
  SessionStartInput,
  SessionEndInput,
  AnyHookInput,

  // Output types
  PreToolUseOutput,
  PostToolUseOutput,
  NotificationOutput,
  UserPromptSubmitOutput,
  StopOutput,
  SubagentStopOutput,
  PreCompactOutput,
  SessionStartOutput,
  SessionEndOutput,
  AnyHookOutput,

  // Handler types
  HookHandler,
  HookResult,
  HookContext,
  TranscriptLine,
} from './types';

// Export type guards
export {
  isPreToolUse,
  isPostToolUse,
  isNotification,
  isUserPromptSubmit,
  isStop,
  isSubagentStop,
  isPreCompact,
  isSessionStart,
  isSessionEnd,
} from './types';

// Export Hook Manager
export {
  HookManager,
  createHookContext,
  getTranscriptLine,
  getFullTranscript,
  searchTranscript,
  type HookManagerOptions,
  type HookPlugin,
  type FailedEvent,
} from './manager';

// Export Context Tracker
export {
  ContextTracker,
  type EventContext,
  type GitMetadata,
} from './context-tracker';

// Export utilities
export { success, block, error, matchesTool, isMCPTool, parseMCPTool } from './utils';

// Export transcript utilities
export type { ConversationLine } from './transcript';
export { getLastTranscriptLine, parseTranscript } from './transcript';

// Export transform utilities
export {
  // Conversation logging
  ConversationLogger,
  createConversationTurn,
  type ConversationTurn,
  // File tracking
  FileChangeTracker,
  extractFileChange,
  isFileOperation,
  type FileChange,
  type FileChangesBatch,
  // Todo tracking
  TodoTracker,
  extractTodoEvent,
  isTodoWrite,
  formatTodos,
  type Todo,
  type TodoEvent,
  type TodoSnapshot,
  // AI summarization
  AISummarizer,
  summarizeWithClaude,
  type SummaryEvent,
  type ClaudeMessage,
  type ClaudeAPIResponse,
} from './transforms';

// Export persistent state
export {
  PersistentState,
  type StorageBackend,
  type PersistentStateOptions,
  type StateValue,
} from './persistent-state';

// Export session analytics
export {
  SessionAnalytics,
  type SessionAnalyticsOptions,
  type ModelPricing,
  type TokenUsage,
  type CostBreakdown,
  type DurationInfo,
  type SessionMetrics,
  type AggregatedMetrics,
} from './session-analytics';

// Export event recording and replay
export {
  EventRecorder,
  type EventRecorderOptions,
  type RecordedEvent,
} from './event-recorder';

export {
  EventReplayer,
  type ReplayOptions,
  type ReplayHandler,
} from './event-replayer';

// Export event streaming
export {
  EventStreamer,
  EventClient,
  type EventStreamerOptions,
  type StreamEvent,
} from './event-streamer';

// Export middleware
export {
  middleware,
  compose,
  type MiddlewareFunction,
  type MiddlewareNext,
  type RateLimitOptions,
  type DeduplicateOptions,
  type PIIRedactionOptions,
} from './middleware';

// Export anomaly detection
export {
  AnomalyDetector,
  type AnomalyDetectorOptions,
  type Anomaly,
  type AnomalyRules,
  type ErrorRateRule,
  type ResponseTimeRule,
  type ToolSequenceRule,
  type TokenSpikeRule,
} from './anomaly-detector';

// Export session naming
export {
  SessionNamer,
  initSessionNamer,
  getSessionName,
  getSessionId,
  renameSession,
  listSessions,
  type SessionInfo,
  type SessionsDatabase,
} from './session-namer';
