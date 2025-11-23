/**
 * Claude Code Hooks SDK - Type Definitions
 * Complete type-safe definitions for all Claude Code hook events
 */

// ============================================================================
// Core Types
// ============================================================================

export type HookEventName =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'Notification'
  | 'UserPromptSubmit'
  | 'Stop'
  | 'SubagentStop'
  | 'PreCompact'
  | 'SessionStart'
  | 'SessionEnd';

export type ToolName =
  | 'Task'
  | 'Bash'
  | 'Glob'
  | 'Grep'
  | 'Read'
  | 'Edit'
  | 'MultiEdit'
  | 'Write'
  | 'WebFetch'
  | 'WebSearch'
  | string; // Allow custom MCP tools

export type ExitCode = 0 | 2 | number;

// ============================================================================
// Common Hook Input
// ============================================================================

/**
 * Context added to events when context tracking is enabled
 */
export interface EnrichedContext {
  transactionId?: string;
  conversationId?: string;
  promptId?: string;
  parentSessionId?: string;
  agentId?: string;
  project_dir?: string;
  git?: {
    user?: string;
    email?: string;
    repo?: string;
    branch?: string;
    commit?: string;
    dirty?: boolean;
    repoInstanceId?: string;  // Unique ID for this checkout/clone
  };
  editedFiles?: string[];  // Only present on Stop/SubagentStop events when trackEdits enabled
}

export interface BaseHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: HookEventName;
}

/**
 * Base hook input with optional enriched context
 * Use this when you want type-safe access to context fields
 */
export interface EnrichedHookInput extends BaseHookInput {
  context?: EnrichedContext;
}

// ============================================================================
// PreToolUse Types
// ============================================================================

export interface PreToolUseInput extends BaseHookInput {
  hook_event_name: 'PreToolUse';
  tool_name: ToolName;
  tool_input: Record<string, any>;
}

export type PermissionDecision = 'allow' | 'deny' | 'ask';

export interface PreToolUseOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  hookSpecificOutput?: {
    hookEventName: 'PreToolUse';
    permissionDecision?: PermissionDecision;
    permissionDecisionReason?: string;
  };
}

// ============================================================================
// PostToolUse Types
// ============================================================================

export interface PostToolUseInput extends BaseHookInput {
  hook_event_name: 'PostToolUse';
  tool_name: ToolName;
  tool_input: Record<string, any>;
  tool_response: Record<string, any>;
}

export interface PostToolUseOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: 'block';
  reason?: string;
  hookSpecificOutput?: {
    hookEventName: 'PostToolUse';
    additionalContext?: string;
  };
}

// ============================================================================
// Notification Types
// ============================================================================

export interface NotificationInput extends BaseHookInput {
  hook_event_name: 'Notification';
  message: string;
}

export interface NotificationOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
}

// ============================================================================
// UserPromptSubmit Types
// ============================================================================

export interface UserPromptSubmitInput extends BaseHookInput {
  hook_event_name: 'UserPromptSubmit';
  prompt: string;
}

export interface UserPromptSubmitOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: 'block';
  reason?: string;
  hookSpecificOutput?: {
    hookEventName: 'UserPromptSubmit';
    additionalContext?: string;
  };
}

// ============================================================================
// Stop and SubagentStop Types
// ============================================================================

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface StopInput extends EnrichedHookInput {
  hook_event_name: 'Stop';
  stop_hook_active: boolean;
  /** Token usage extracted from conversation (enriched by HookManager) */
  usage?: TokenUsage;
  /** Model name extracted from conversation (enriched by HookManager) */
  model?: string;
}

export interface SubagentStopInput extends EnrichedHookInput {
  hook_event_name: 'SubagentStop';
  stop_hook_active: boolean;
  /** Token usage extracted from conversation (enriched by HookManager) */
  usage?: TokenUsage;
  /** Model name extracted from conversation (enriched by HookManager) */
  model?: string;
}

export interface StopOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  decision?: 'block';
  reason?: string;
}

export type SubagentStopOutput = StopOutput;

// ============================================================================
// PreCompact Types
// ============================================================================

export type CompactTrigger = 'manual' | 'auto';

export interface PreCompactInput extends BaseHookInput {
  hook_event_name: 'PreCompact';
  trigger: CompactTrigger;
  custom_instructions: string;
}

export interface PreCompactOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
}

// ============================================================================
// SessionStart Types
// ============================================================================

export type SessionStartSource = 'startup' | 'resume' | 'clear' | 'compact';

export interface SessionStartInput extends BaseHookInput {
  hook_event_name: 'SessionStart';
  source: SessionStartSource;
  /** Session name (enriched by HookManager) */
  session_name?: string;
}

export interface SessionStartOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  hookSpecificOutput?: {
    hookEventName: 'SessionStart';
    additionalContext?: string;
  };
}

// ============================================================================
// SessionEnd Types
// ============================================================================

export type SessionEndReason = 'clear' | 'logout' | 'prompt_input_exit' | 'other';

export interface SessionEndInput extends BaseHookInput {
  hook_event_name: 'SessionEnd';
  reason: SessionEndReason;
}

export interface SessionEndOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
}

// ============================================================================
// Union Types
// ============================================================================

export type AnyHookInput =
  | PreToolUseInput
  | PostToolUseInput
  | NotificationInput
  | UserPromptSubmitInput
  | StopInput
  | SubagentStopInput
  | PreCompactInput
  | SessionStartInput
  | SessionEndInput;

export type AnyHookOutput =
  | PreToolUseOutput
  | PostToolUseOutput
  | NotificationOutput
  | UserPromptSubmitOutput
  | StopOutput
  | SubagentStopOutput
  | PreCompactOutput
  | SessionStartOutput
  | SessionEndOutput;

// ============================================================================
// Hook Handler Types
// ============================================================================

export type HookHandler<TInput extends AnyHookInput, TOutput extends AnyHookOutput> = (
  input: TInput,
  context: HookContext
) => Promise<HookResult<TOutput>> | HookResult<TOutput>;

export interface HookResult<TOutput extends AnyHookOutput> {
  exitCode: ExitCode;
  stdout?: string;
  stderr?: string;
  output?: TOutput;
}

export interface HookContext {
  transcriptPath: string;
  getTranscriptLine: (lineNumber: number) => Promise<TranscriptLine | null>;
  getFullTranscript: () => Promise<TranscriptLine[]>;
  searchTranscript: (predicate: (line: TranscriptLine) => boolean) => Promise<TranscriptLine[]>;
}

// ============================================================================
// Transcript Types
// ============================================================================

export interface TranscriptLine {
  lineNumber: number;
  content: any;
  raw: string;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isPreToolUse(input: AnyHookInput): input is PreToolUseInput {
  return input.hook_event_name === 'PreToolUse';
}

export function isPostToolUse(input: AnyHookInput): input is PostToolUseInput {
  return input.hook_event_name === 'PostToolUse';
}

export function isNotification(input: AnyHookInput): input is NotificationInput {
  return input.hook_event_name === 'Notification';
}

export function isUserPromptSubmit(input: AnyHookInput): input is UserPromptSubmitInput {
  return input.hook_event_name === 'UserPromptSubmit';
}

export function isStop(input: AnyHookInput): input is StopInput {
  return input.hook_event_name === 'Stop';
}

export function isSubagentStop(input: AnyHookInput): input is SubagentStopInput {
  return input.hook_event_name === 'SubagentStop';
}

export function isPreCompact(input: AnyHookInput): input is PreCompactInput {
  return input.hook_event_name === 'PreCompact';
}

export function isSessionStart(input: AnyHookInput): input is SessionStartInput {
  return input.hook_event_name === 'SessionStart';
}

export function isSessionEnd(input: AnyHookInput): input is SessionEndInput {
  return input.hook_event_name === 'SessionEnd';
}

// ============================================================================
// API Payload Types (Phase 2)
// ============================================================================

/**
 * Hook Event API Payload Structure
 *
 * When hooks send events to the API (Phase 2), the payload will contain:
 * - event: The complete hook event data
 * - conversation: The last line from the transcript
 * - timestamp: When the event occurred
 *
 * This payload is stored in the hook_events.payload JSONB column.
 */
export interface HookEventPayload {
  /** The complete hook event data from Claude Code */
  event: AnyHookInput;

  /** The last line from the transcript for context */
  conversation: TranscriptLine | null;

  /** ISO 8601 timestamp of when the event occurred */
  timestamp: string;
}

/**
 * Hook Event Database Record
 *
 * This represents the full record stored in the database.
 */
export interface HookEventRecord {
  id: string;
  workspaceId: string;
  sessionId: string;
  eventName: HookEventName;
  toolName?: string;
  payload: HookEventPayload;
  processed: boolean;  // Default: false, set to true by background job
  createdAt: string;
  processedAt: string | null;
}

/**
 * Hook Event Error Queue Entry (Phase 3)
 *
 * When API calls fail, events are queued locally in filesystem.
 * FIFO queue retries when server recovers.
 */
export interface HookEventQueueEntry {
  id: string;
  payload: HookEventPayload;
  workspaceId: string;
  sessionId: string;
  eventName: HookEventName;
  toolName?: string;
  attempts: number;
  lastAttempt: string;
  createdAt: string;
}
