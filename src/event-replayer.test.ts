import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { EventRecorder } from './event-recorder';
import { EventReplayer } from './event-replayer';
import type { PostToolUseInput, StopInput } from './types';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = '/tmp/claude-hooks-sdk-test';
const TEST_FILE = path.join(TEST_DIR, 'replay.jsonl');

describe('EventReplayer', () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('Loading events', () => {
    test('should load events from file', async () => {
      // Create test data
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      await recorder.save();

      // Load with replayer
      const replayer = new EventReplayer(TEST_FILE);
      const events = await replayer.load();

      expect(events).toHaveLength(1);
      expect(events[0].event.hook_event_name).toBe('PostToolUse');
    });

    test('should load multiple events', async () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      for (let i = 0; i < 5; i++) {
        recorder.record({
          hook_event_name: 'PostToolUse',
          session_id: 'session-1',
          tool_name: 'Read',
          tool_input: {},
          tool_response: {},
        } as PostToolUseInput);
      }

      await recorder.save();

      const replayer = new EventReplayer(TEST_FILE);
      const events = await replayer.load();

      expect(events).toHaveLength(5);
    });

    test('should throw error if file does not exist', async () => {
      const replayer = new EventReplayer('/tmp/nonexistent.jsonl');

      await expect(replayer.load()).rejects.toThrow('Recording file not found');
    });

    test('should cache loaded events', async () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      await recorder.save();

      const replayer = new EventReplayer(TEST_FILE);

      // Load twice - should use cache second time
      const events1 = await replayer.load();
      const events2 = await replayer.load();

      expect(events1).toBe(events2); // Same reference
    });
  });

  describe('Event retrieval', () => {
    beforeEach(async () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      recorder.record({
        hook_event_name: 'Stop',
        session_id: 'session-1',
      } as StopInput);

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Write',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      await recorder.save();
    });

    test('should get event by index', async () => {
      const replayer = new EventReplayer(TEST_FILE);

      const event = await replayer.get(1);
      expect(event).toBeTruthy();
      expect(event!.event.hook_event_name).toBe('Stop');
    });

    test('should return null for invalid index', async () => {
      const replayer = new EventReplayer(TEST_FILE);

      const event = await replayer.get(999);
      expect(event).toBeNull();
    });

    test('should get all events', async () => {
      const replayer = new EventReplayer(TEST_FILE);

      const events = await replayer.getAll();
      expect(events).toHaveLength(3);
    });

    test('should filter events by type', async () => {
      const replayer = new EventReplayer(TEST_FILE);

      const toolEvents = await replayer.getByType('PostToolUse');
      expect(toolEvents).toHaveLength(2);
      expect(toolEvents[0].event.hook_event_name).toBe('PostToolUse');
    });

    test('should get event count', async () => {
      const replayer = new EventReplayer(TEST_FILE);

      const count = await replayer.count();
      expect(count).toBe(3);
    });
  });

  describe('Summary statistics', () => {
    test('should generate summary', async () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      const baseTime = Date.now();

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      recorder.record({
        hook_event_name: 'Stop',
        session_id: 'session-1',
      } as StopInput);

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Write',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      await recorder.save();

      const replayer = new EventReplayer(TEST_FILE);
      const summary = await replayer.getSummary();

      expect(summary.total).toBe(3);
      expect(summary.byType['PostToolUse']).toBe(2);
      expect(summary.byType['Stop']).toBe(1);
      expect(summary.duration).toBeGreaterThanOrEqual(0);
      expect(summary.startTime).toBeGreaterThanOrEqual(baseTime);
    });

    test('should handle empty file', async () => {
      // Create empty file
      fs.writeFileSync(TEST_FILE, '', 'utf-8');

      const replayer = new EventReplayer(TEST_FILE);
      const summary = await replayer.getSummary();

      expect(summary.total).toBe(0);
      expect(summary.byType).toEqual({});
      expect(summary.duration).toBe(0);
    });
  });

  describe('Event replay', () => {
    test('should replay events instantly', async () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      for (let i = 0; i < 5; i++) {
        recorder.record({
          hook_event_name: 'PostToolUse',
          session_id: 'session-1',
          tool_name: 'Read',
          tool_input: {},
          tool_response: {},
        } as PostToolUseInput);
      }

      await recorder.save();

      const replayer = new EventReplayer(TEST_FILE);
      const events: any[] = [];

      await replayer.replay(
        (event, index) => {
          events.push({ event, index });
        },
        { realtime: false }
      );

      expect(events).toHaveLength(5);
      expect(events[0].index).toBe(0);
      expect(events[4].index).toBe(4);
    });

    test('should filter events during replay', async () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      recorder.record({
        hook_event_name: 'Stop',
        session_id: 'session-1',
      } as StopInput);

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Write',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      await recorder.save();

      const replayer = new EventReplayer(TEST_FILE);
      const events: any[] = [];

      await replayer.replay(
        (event) => {
          events.push(event);
        },
        { events: ['PostToolUse'], realtime: false }
      );

      expect(events).toHaveLength(2);
      expect(events[0].hook_event_name).toBe('PostToolUse');
      expect(events[1].hook_event_name).toBe('PostToolUse');
    });

    test('should handle async handlers', async () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      await recorder.save();

      const replayer = new EventReplayer(TEST_FILE);
      let handlerCalled = false;

      await replayer.replay(
        async (event) => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          handlerCalled = true;
        },
        { realtime: false }
      );

      expect(handlerCalled).toBe(true);
    });

    test('should handle empty replay', async () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      await recorder.save(); // Empty file

      const replayer = new EventReplayer(TEST_FILE);
      let handlerCalled = false;

      await replayer.replay(
        () => {
          handlerCalled = true;
        },
        { realtime: false }
      );

      expect(handlerCalled).toBe(false);
    });

    test('should handle filtered replay with no matches', async () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      await recorder.save();

      const replayer = new EventReplayer(TEST_FILE);
      let handlerCalled = false;

      await replayer.replay(
        () => {
          handlerCalled = true;
        },
        { events: ['Stop'], realtime: false }
      );

      expect(handlerCalled).toBe(false);
    });
  });
});
