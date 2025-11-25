/**
 * Logger - Centralized logging utility for the SDK
 *
 * Provides consistent logging across all SDK components with debug mode support.
 * All log output goes to stderr to avoid interfering with hook stdout communication.
 */

/**
 * Log levels for the logger
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Enable debug logging */
  debug?: boolean;
  /** Prefix for all log messages */
  prefix?: string;
  /** Minimum log level to output */
  minLevel?: LogLevel;
}

/**
 * Log level priority (lower = more verbose)
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Default SDK prefix
 */
const DEFAULT_PREFIX = 'claude-hooks-sdk';

/**
 * Logger class for consistent logging across SDK components
 *
 * @example
 * ```typescript
 * const logger = new Logger({ debug: true, prefix: 'my-hook' });
 * logger.debug('Processing event', { eventType: 'PreToolUse' });
 * logger.error('Failed to process', new Error('Network timeout'));
 * ```
 */
export class Logger {
  private debug: boolean;
  private prefix: string;
  private minLevel: LogLevel;

  constructor(options: LoggerOptions = {}) {
    this.debug = options.debug ?? false;
    this.prefix = options.prefix ?? DEFAULT_PREFIX;
    this.minLevel = options.minLevel ?? 'debug';
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    if (!this.debug && level === 'debug') {
      return false;
    }
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  /**
   * Format a log message with prefix and optional data
   */
  private format(message: string): string {
    return `[${this.prefix}] ${message}`;
  }

  /**
   * Log a debug message (only when debug mode is enabled)
   */
  logDebug(message: string, data?: unknown): void {
    if (this.shouldLog('debug')) {
      if (data !== undefined) {
        console.error(this.format(message), data);
      } else {
        console.error(this.format(message));
      }
    }
  }

  /**
   * Log an info message
   */
  info(message: string, data?: unknown): void {
    if (this.shouldLog('info')) {
      if (data !== undefined) {
        console.error(this.format(message), data);
      } else {
        console.error(this.format(message));
      }
    }
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown): void {
    if (this.shouldLog('warn')) {
      if (data !== undefined) {
        console.error(this.format(message), data);
      } else {
        console.error(this.format(message));
      }
    }
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error | unknown): void {
    if (this.shouldLog('error')) {
      if (error !== undefined) {
        console.error(this.format(message), error);
      } else {
        console.error(this.format(message));
      }
    }
  }

  /**
   * Create a child logger with a sub-prefix
   */
  child(subPrefix: string): Logger {
    return new Logger({
      debug: this.debug,
      prefix: `${this.prefix}:${subPrefix}`,
      minLevel: this.minLevel,
    });
  }

  /**
   * Create a new logger with debug mode enabled/disabled
   */
  withDebug(debug: boolean): Logger {
    return new Logger({
      debug,
      prefix: this.prefix,
      minLevel: this.minLevel,
    });
  }
}

/**
 * Create a logger instance
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}

/**
 * Default logger instance (debug disabled)
 */
export const defaultLogger = new Logger();
