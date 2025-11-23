/**
 * Middleware - Composable middleware for hook processing
 *
 * @example
 * ```typescript
 * const manager = new HookManager()
 *   .use(middleware.rateLimit({ maxEvents: 100, window: '1m' }))
 *   .use(middleware.deduplicate({ window: 5000 }))
 *   .use(middleware.filterByTool(['Read', 'Write']))
 *   .use(async (input, next) => {
 *     console.log('Before:', input.hook_event_name);
 *     const result = await next(input);
 *     console.log('After:', result);
 *     return result;
 *   });
 * ```
 */

import type { AnyHookInput, AnyHookOutput } from './types';

export type MiddlewareNext = (input: AnyHookInput) => Promise<AnyHookOutput>;
export type MiddlewareFunction = (
  input: AnyHookInput,
  next: MiddlewareNext
) => Promise<AnyHookOutput>;

export interface RateLimitOptions {
  /** Maximum number of events allowed */
  maxEvents: number;
  /** Time window in milliseconds or string ('1m', '1h', '1d') */
  window: number | string;
  /** Type of window: 'sliding' or 'fixed' */
  type?: 'sliding' | 'fixed';
}

export interface DeduplicateOptions {
  /** Function to generate deduplication key */
  key?: (input: AnyHookInput) => string;
  /** Deduplication window in milliseconds */
  window: number;
}

export interface PIIRedactionOptions {
  /** Fields to redact */
  fields: string[];
  /** Patterns to match and redact */
  patterns?: RegExp[];
}

/**
 * Parse time window string to milliseconds
 */
function parseTimeWindow(window: number | string): number {
  if (typeof window === 'number') {
    return window;
  }

  const match = window.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    throw new Error(`Invalid time window format: ${window}`);
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 'ms':
      return value;
    case 's':
      return value * 1000;
    case 'm':
      return value * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${unit}`);
  }
}

/**
 * Built-in middleware functions
 */
export const middleware = {
  /**
   * Rate limiting middleware
   */
  rateLimit(options: RateLimitOptions): MiddlewareFunction {
    const windowMs = parseTimeWindow(options.window);
    const type = options.type || 'sliding';

    const events: number[] = [];
    let fixedWindowStart = Date.now();

    return async (input, next) => {
      const now = Date.now();

      if (type === 'sliding') {
        // Remove events outside the window
        const cutoff = now - windowMs;
        while (events.length > 0 && events[0] < cutoff) {
          events.shift();
        }

        if (events.length >= options.maxEvents) {
          throw new Error(
            `Rate limit exceeded: ${options.maxEvents} events per ${options.window}`
          );
        }

        events.push(now);
      } else {
        // Fixed window
        if (now - fixedWindowStart > windowMs) {
          events.length = 0;
          fixedWindowStart = now;
        }

        if (events.length >= options.maxEvents) {
          throw new Error(
            `Rate limit exceeded: ${options.maxEvents} events per ${options.window}`
          );
        }

        events.push(now);
      }

      return next(input);
    };
  },

  /**
   * Deduplication middleware
   */
  deduplicate(options: DeduplicateOptions): MiddlewareFunction {
    const seen = new Map<string, number>();
    const defaultKeyFn = (input: AnyHookInput) => JSON.stringify(input);
    const keyFn = options.key || defaultKeyFn;

    return async (input, next) => {
      const key = keyFn(input);
      const now = Date.now();

      // Clean up old entries
      for (const [k, timestamp] of seen.entries()) {
        if (now - timestamp > options.window) {
          seen.delete(k);
        }
      }

      // Check if we've seen this event recently
      if (seen.has(key)) {
        // Skip duplicate
        return { continue: true };
      }

      seen.set(key, now);
      return next(input);
    };
  },

  /**
   * Filter by tool name
   */
  filterByTool(tools: string[]): MiddlewareFunction {
    const toolSet = new Set(tools);

    return async (input, next) => {
      if ('tool_name' in input && input.tool_name) {
        if (!toolSet.has(input.tool_name)) {
          // Skip this event
          return { continue: true };
        }
      }

      return next(input);
    };
  },

  /**
   * Filter by event type
   */
  filterByEvent(events: string[]): MiddlewareFunction {
    const eventSet = new Set(events);

    return async (input, next) => {
      if (!eventSet.has(input.hook_event_name)) {
        // Skip this event
        return { continue: true };
      }

      return next(input);
    };
  },

  /**
   * PII redaction middleware
   */
  piiRedaction(options: PIIRedactionOptions): MiddlewareFunction {
    const patterns = options.patterns || [
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, // Email
      /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g, // Credit card
    ];

    function redactString(str: string): string {
      let result = str;
      for (const pattern of patterns) {
        result = result.replace(pattern, '[REDACTED]');
      }
      return result;
    }

    function redactObject(obj: any): any {
      if (typeof obj === 'string') {
        return redactString(obj);
      }

      if (Array.isArray(obj)) {
        return obj.map(redactObject);
      }

      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (options.fields.includes(key)) {
            result[key] = redactObject(value);
          } else {
            result[key] = value;
          }
        }
        return result;
      }

      return obj;
    }

    return async (input, next) => {
      const redactedInput = redactObject(input);
      return next(redactedInput);
    };
  },

  /**
   * Logging middleware
   */
  logger(prefix: string = ''): MiddlewareFunction {
    return async (input, next) => {
      console.log(`${prefix}[${input.hook_event_name}]`, input);
      const result = await next(input);
      console.log(`${prefix}[${input.hook_event_name}] →`, result);
      return result;
    };
  },

  /**
   * Timing middleware
   */
  timing(): MiddlewareFunction {
    return async (input, next) => {
      const start = Date.now();
      const result = await next(input);
      const duration = Date.now() - start;
      console.log(`[${input.hook_event_name}] took ${duration}ms`);
      return result;
    };
  },

  /**
   * Error handling middleware
   */
  errorHandler(handler: (error: Error, input: AnyHookInput) => void | Promise<void>): MiddlewareFunction {
    return async (input, next) => {
      try {
        return await next(input);
      } catch (error) {
        await handler(error as Error, input);
        throw error;
      }
    };
  },
};

/**
 * Compose multiple middleware functions
 */
export function compose(middlewares: MiddlewareFunction[]): MiddlewareFunction {
  return async (input, next) => {
    let index = -1;

    async function dispatch(i: number, currentInput: AnyHookInput): Promise<AnyHookOutput> {
      if (i <= index) {
        throw new Error('next() called multiple times');
      }

      index = i;

      if (i === middlewares.length) {
        return next(currentInput);
      }

      const middleware = middlewares[i];
      return middleware(currentInput, (newInput) => dispatch(i + 1, newInput));
    }

    return dispatch(0, input);
  };
}
