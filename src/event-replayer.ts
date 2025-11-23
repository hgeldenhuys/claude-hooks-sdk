/**
 * EventReplayer - Replay recorded hook events for testing
 *
 * @example
 * ```typescript
 * const replayer = new EventReplayer('test-fixtures/session.jsonl');
 *
 * // Replay all events
 * await replayer.replay((event) => {
 *   myTransform.process(event);
 * });
 *
 * // Replay with filters
 * await replayer.replay((event) => {
 *   // Process event
 * }, {
 *   events: ['PostToolUse'],
 *   speed: 2.0,  // 2x speed
 *   realtime: false  // instant replay
 * });
 * ```
 */

import * as fs from 'fs';
import type { AnyHookInput, HookEventName } from './types';
import type { RecordedEvent } from './event-recorder';

export interface ReplayOptions {
  /** Filter by event types */
  events?: HookEventName[];
  /** Playback speed multiplier (1.0 = realtime, 2.0 = 2x speed, etc.) */
  speed?: number;
  /** If true, replay with original timing. If false, replay instantly */
  realtime?: boolean;
}

export type ReplayHandler = (event: AnyHookInput, index: number) => void | Promise<void>;

/**
 * EventReplayer replays recorded hook events
 */
export class EventReplayer {
  private filePath: string;
  private events: RecordedEvent[] | null = null;

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  /**
   * Load events from file
   */
  async load(): Promise<RecordedEvent[]> {
    if (this.events) {
      return this.events;
    }

    if (!fs.existsSync(this.filePath)) {
      throw new Error(`Recording file not found: ${this.filePath}`);
    }

    const content = fs.readFileSync(this.filePath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());

    this.events = lines.map((line) => JSON.parse(line) as RecordedEvent);
    return this.events;
  }

  /**
   * Replay events
   */
  async replay(handler: ReplayHandler, options: ReplayOptions = {}): Promise<void> {
    const events = await this.load();

    // Apply event filter
    let filteredEvents = events;
    if (options.events && options.events.length > 0) {
      const eventSet = new Set(options.events);
      filteredEvents = events.filter((e) => eventSet.has(e.event.hook_event_name));
    }

    if (filteredEvents.length === 0) {
      return;
    }

    const realtime = options.realtime !== false; // default true
    const speed = options.speed || 1.0;

    if (!realtime) {
      // Instant replay - call handler for each event without delays
      for (let i = 0; i < filteredEvents.length; i++) {
        await handler(filteredEvents[i].event, i);
      }
    } else {
      // Realtime replay - respect original timing
      const startTime = filteredEvents[0].timestamp;

      for (let i = 0; i < filteredEvents.length; i++) {
        const event = filteredEvents[i];
        const delay = (event.timestamp - startTime) / speed;

        // Wait for the appropriate time
        await this.sleep(delay);

        // Call handler
        await handler(event.event, i);

        // Update startTime for next iteration
        if (i < filteredEvents.length - 1) {
          const nextEvent = filteredEvents[i + 1];
          const waitTime = (nextEvent.timestamp - event.timestamp) / speed;
          await this.sleep(waitTime);
        }
      }
    }
  }

  /**
   * Get event at specific index
   */
  async get(index: number): Promise<RecordedEvent | null> {
    const events = await this.load();
    return events[index] || null;
  }

  /**
   * Get all events
   */
  async getAll(): Promise<RecordedEvent[]> {
    return this.load();
  }

  /**
   * Get events filtered by type
   */
  async getByType(eventType: HookEventName): Promise<RecordedEvent[]> {
    const events = await this.load();
    return events.filter((e) => e.event.hook_event_name === eventType);
  }

  /**
   * Get total count of events
   */
  async count(): Promise<number> {
    const events = await this.load();
    return events.length;
  }

  /**
   * Get summary statistics
   */
  async getSummary(): Promise<{
    total: number;
    byType: Record<string, number>;
    duration: number;
    startTime: number;
    endTime: number;
  }> {
    const events = await this.load();

    if (events.length === 0) {
      return {
        total: 0,
        byType: {},
        duration: 0,
        startTime: 0,
        endTime: 0,
      };
    }

    const byType: Record<string, number> = {};
    for (const event of events) {
      const type = event.event.hook_event_name;
      byType[type] = (byType[type] || 0) + 1;
    }

    const startTime = events[0].timestamp;
    const endTime = events[events.length - 1].timestamp;

    return {
      total: events.length,
      byType,
      duration: endTime - startTime,
      startTime,
      endTime,
    };
  }

  /**
   * Sleep for a given number of milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
