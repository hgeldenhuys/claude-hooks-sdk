/**
 * Constants - Centralized constants for the SDK
 *
 * All magic numbers and default values are defined here for easy maintenance.
 */

/**
 * Default timeout for handler execution in milliseconds
 */
export const DEFAULT_HANDLER_TIMEOUT_MS = 30000;

/**
 * Default maximum number of events to drain from the error queue per hook event
 */
export const DEFAULT_MAX_QUEUE_DRAIN_PER_EVENT = 10;

/**
 * Default maximum retry attempts for failed events
 */
export const DEFAULT_MAX_RETRIES = 3;

/**
 * Default client ID for organizing logs
 */
export const DEFAULT_CLIENT_ID = 'default';

/**
 * Log file name for event logging
 */
export const EVENTS_LOG_FILENAME = 'events.jsonl';

/**
 * Error queue file name
 */
export const ERROR_QUEUE_FILENAME = 'error-queue.jsonl';

/**
 * Context file name for context tracking
 */
export const CONTEXT_FILENAME = 'context.json';

/**
 * Sessions database file name
 */
export const SESSIONS_FILENAME = 'sessions.json';

/**
 * Directory names
 */
export const HOOKS_DIR = 'hooks';
export const LOGS_DIR = 'logs';
export const CLAUDE_DIR = '.claude';

/**
 * Exit codes
 */
export const EXIT_CODE_SUCCESS = 0;
export const EXIT_CODE_ERROR = 1;
export const EXIT_CODE_BLOCK = 2;

/**
 * Time constants (in milliseconds)
 */
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = 60 * MS_PER_SECOND;
export const MS_PER_HOUR = 60 * MS_PER_MINUTE;
export const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Environment variable names
 */
export const ENV_CLAUDE_PROJECT_DIR = 'CLAUDE_PROJECT_DIR';

/**
 * Transaction ID prefix
 */
export const TRANSACTION_ID_PREFIX = 'tx_';

/**
 * Prompt ID prefix
 */
export const PROMPT_ID_PREFIX = 'prompt_';

/**
 * Repo instance ID prefix
 */
export const REPO_INSTANCE_ID_PREFIX = 'repo_';
