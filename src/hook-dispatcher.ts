/**
 * Hook Dispatcher - Manages multiple event handlers for a single hook event
 *
 * Provides clean separation between Claude Code (which calls one hook)
 * and application logic (which can have many handlers for that hook).
 *
 * @example
 * ```typescript
 * #!/usr/bin/env bun
 * import { HookDispatcher, builtInHandlers } from 'claude-hooks-sdk';
 *
 * const dispatcher = new HookDispatcher();
 *
 * // Register built-in SDK handlers
 * builtInHandlers.SessionStart.forEach(h => dispatcher.register(h));
 *
 * // Register user handlers
 * const userHandlers = await dispatcher.loadUserHandlers(process.cwd(), 'SessionStart');
 * userHandlers.forEach(h => dispatcher.register(h));
 *
 * await dispatcher.run();
 * ```
 */

import { promises as fs } from 'fs';
import * as path from 'path';
import { Logger, defaultLogger } from './logger';

export interface DispatcherHandlerResult {
  message?: string;
  error?: string;
  continue?: boolean;
}

export interface DispatcherHandler {
  name: string;
  handle: (input: any) => Promise<DispatcherHandlerResult | void>;
}

export interface HookDispatcherOptions {
  logger?: Logger;
  stopOnError?: boolean;
  parallel?: boolean;
}

/**
 * HookDispatcher - Coordinates multiple handlers for a single hook event
 */
export class HookDispatcher {
  private handlers: DispatcherHandler[] = [];
  private logger: Logger;
  private stopOnError: boolean;
  private parallel: boolean;

  constructor(options: HookDispatcherOptions = {}) {
    this.logger = options.logger || defaultLogger;
    this.stopOnError = options.stopOnError ?? false;
    this.parallel = options.parallel ?? false;
  }

  /**
   * Register a handler
   */
  register(handler: DispatcherHandler): this {
    this.handlers.push(handler);
    return this;
  }

  /**
   * Register multiple handlers
   */
  registerMultiple(handlers: DispatcherHandler[]): this {
    this.handlers.push(...handlers);
    return this;
  }

  /**
   * Dispatch event to all registered handlers
   */
  async dispatch(input: any): Promise<string | undefined> {
    const messages: string[] = [];
    const errors: string[] = [];

    if (this.parallel) {
      // Run all handlers in parallel
      const results = await Promise.allSettled(
        this.handlers.map(({ name, handle }) => this.executeHandler(name, handle, input))
      );

      results.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          const { message, error } = result.value;
          if (message) messages.push(message);
          if (error) errors.push(`[${this.handlers[idx].name}] ${error}`);
        } else {
          errors.push(`[${this.handlers[idx].name}] Exception: ${result.reason}`);
        }
      });
    } else {
      // Run handlers sequentially
      for (const { name, handle } of this.handlers) {
        const { message, error } = await this.executeHandler(name, handle, input);

        if (message) messages.push(message);
        if (error) {
          errors.push(`[${name}] ${error}`);
          if (this.stopOnError) break;
        }
      }
    }

    // Log errors
    if (errors.length > 0) {
      errors.forEach(err => this.logger.error(err));
    }

    return messages.length > 0 ? messages.join('\n') : undefined;
  }

  /**
   * Execute a single handler with error handling
   */
  private async executeHandler(
    name: string,
    handler: (input: any) => Promise<DispatcherHandlerResult | void>,
    input: any
  ): Promise<DispatcherHandlerResult> {
    try {
      const result = await handler(input);
      return result || { message: undefined, error: undefined };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Load user handlers from directory convention
   *
   * Loads handlers from `.claude/handlers/{hookName}/` directory
   * Files are sorted numerically (00-*, 10-*, 20-*, etc.) and executed in order
   */
  async loadUserHandlers(projectDir: string, hookName: string): Promise<DispatcherHandler[]> {
    const handlersDir = path.join(projectDir, '.claude', 'handlers', hookName);

    try {
      const entries = await fs.readdir(handlersDir, { withFileTypes: true });

      // Filter and sort by numeric prefix
      const handlerFiles = entries
        .filter(e => e.isFile() && e.name.endsWith('.ts'))
        .sort((a, b) => {
          const aNum = parseInt(a.name) || 999;
          const bNum = parseInt(b.name) || 999;
          return aNum - bNum;
        });

      const handlers: DispatcherHandler[] = [];

      for (const file of handlerFiles) {
        try {
          const filePath = path.join(handlersDir, file.name);
          const module = await import(filePath);

          if (module.handle && typeof module.handle === 'function') {
            handlers.push({
              name: file.name.replace(/\.\w+$/, ''), // Remove extension
              handle: module.handle,
            });
          }
        } catch (error) {
          this.logger.warn(`Failed to load handler ${file.name}: ${error}`);
        }
      }

      return handlers;
    } catch (error) {
      // Directory doesn't exist or can't be read - that's okay
      return [];
    }
  }

  /**
   * Main entry point - reads from stdin and writes hook response
   */
  async run(): Promise<void> {
    try {
      // Read JSON from stdin
      const stdinText = await Bun.stdin.text();

      if (!stdinText.trim()) {
        console.log(JSON.stringify({ continue: true }));
        process.exit(0);
      }

      let input: any;
      try {
        input = JSON.parse(stdinText);
      } catch (error) {
        this.logger.error('Failed to parse hook input', error);
        console.log(JSON.stringify({ continue: true }));
        process.exit(0);
      }

      // Dispatch to all handlers
      const message = await this.dispatch(input);

      // Write response
      const response: any = { continue: true };
      if (message) {
        response.message = message;
      }

      console.log(JSON.stringify(response));
      process.exit(0);
    } catch (error) {
      this.logger.error('Hook dispatcher fatal error', error);
      console.log(JSON.stringify({ continue: true }));
      process.exit(1);
    }
  }
}

export default HookDispatcher;
