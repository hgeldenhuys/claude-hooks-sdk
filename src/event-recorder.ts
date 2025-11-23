/**
 * EventRecorder - Record hook events to JSONL files for testing and replay
 *
 * @example
 * ```typescript
 * const recorder = new EventRecorder({
 *   output: 'test-fixtures/session.jsonl',
 *   events: ['UserPromptSubmit', 'PostToolUse', 'Stop']
 * });
 *
 * manager.onPostToolUse((input) => {
 *   recorder.record(input);
 * });
 *
 * await recorder.save();
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AnyHookInput, HookEventName } from './types';

export interface EventRecorderOptions {
  /** Output file path (JSONL format) */
  output: string;
  /** Optional event types to filter (record only these events) */
  events?: HookEventName[];
  /** Auto-save after each record (default: false) */
  autoSave?: boolean;
}

export interface RecordedEvent {
  timestamp: number;
  event: AnyHookInput;
}

/**
 * EventRecorder records hook events to JSONL files
 */
export class EventRecorder {
  private output: string;
  private eventFilter?: Set<HookEventName>;
  private autoSave: boolean;
  private events: RecordedEvent[] = [];

  constructor(options: EventRecorderOptions) {
    this.output = options.output;
    this.eventFilter = options.events ? new Set(options.events) : undefined;
    this.autoSave = options.autoSave || false;

    // Ensure directory exists
    const dir = path.dirname(this.output);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Record a hook event
   */
  record(event: AnyHookInput): void {
    // Filter by event type if specified
    if (this.eventFilter && !this.eventFilter.has(event.hook_event_name)) {
      return;
    }

    const recordedEvent: RecordedEvent = {
      timestamp: Date.now(),
      event,
    };

    this.events.push(recordedEvent);

    if (this.autoSave) {
      this.appendToFile(recordedEvent);
    }
  }

  /**
   * Append a single event to the file
   */
  private appendToFile(event: RecordedEvent): void {
    const line = JSON.stringify(event) + '\n';
    fs.appendFileSync(this.output, line, 'utf-8');
  }

  /**
   * Save all recorded events to file
   */
  async save(): Promise<void> {
    const lines = this.events.map((e) => JSON.stringify(e)).join('\n');
    fs.writeFileSync(this.output, lines + '\n', 'utf-8');
  }

  /**
   * Get the number of recorded events
   */
  count(): number {
    return this.events.length;
  }

  /**
   * Clear all recorded events (does not delete the file)
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Get all recorded events
   */
  getEvents(): RecordedEvent[] {
    return [...this.events];
  }
}
