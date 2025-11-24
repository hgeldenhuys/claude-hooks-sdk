import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { EventRecorder } from '../src/event-recorder';
import type { PostToolUseInput, UserPromptSubmitInput, StopInput } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = '/tmp/claude-hooks-sdk-test';
const TEST_FILE = path.join(TEST_DIR, 'events.jsonl');

describe('EventRecorder', () => {
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

  describe('Basic recording', () => {
    test('should record events', () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      const event: PostToolUseInput = {
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: { file_path: '/test.txt' },
        tool_response: { content: 'test' },
      };

      recorder.record(event);

      expect(recorder.count()).toBe(1);
    });

    test('should record multiple events', () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      for (let i = 0; i < 10; i++) {
        recorder.record({
          hook_event_name: 'PostToolUse',
          session_id: 'session-1',
          tool_name: 'Read',
          tool_input: {},
          tool_response: {},
        } as PostToolUseInput);
      }

      expect(recorder.count()).toBe(10);
    });

    test('should get all events', () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      const event1: PostToolUseInput = {
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      };

      const event2: StopInput = {
        hook_event_name: 'Stop',
        session_id: 'session-1',
      };

      recorder.record(event1);
      recorder.record(event2);

      const events = recorder.getEvents();
      expect(events).toHaveLength(2);
      expect(events[0].event.hook_event_name).toBe('PostToolUse');
      expect(events[1].event.hook_event_name).toBe('Stop');
    });

    test('should clear events', () => {
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

      expect(recorder.count()).toBe(1);

      recorder.clear();

      expect(recorder.count()).toBe(0);
    });
  });

  describe('Event filtering', () => {
    test('should filter by event type', () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
        events: ['PostToolUse'],
      });

      // Should be recorded
      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      // Should be filtered out
      recorder.record({
        hook_event_name: 'Stop',
        session_id: 'session-1',
      } as StopInput);

      expect(recorder.count()).toBe(1);
      const events = recorder.getEvents();
      expect(events[0].event.hook_event_name).toBe('PostToolUse');
    });

    test('should record all events when no filter specified', () => {
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

      expect(recorder.count()).toBe(2);
    });

    test('should filter multiple event types', () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
        events: ['PostToolUse', 'Stop'],
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
        hook_event_name: 'UserPromptSubmit',
        session_id: 'session-1',
      } as UserPromptSubmitInput);

      expect(recorder.count()).toBe(2);
    });
  });

  describe('File operations', () => {
    test('should save to file', async () => {
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

      expect(fs.existsSync(TEST_FILE)).toBe(true);
      const content = fs.readFileSync(TEST_FILE, 'utf-8');
      const lines = content.trim().split('\n');
      expect(lines).toHaveLength(1);
    });

    test('should save in JSONL format', async () => {
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

      await recorder.save();

      const content = fs.readFileSync(TEST_FILE, 'utf-8');
      const lines = content.trim().split('\n');

      // Each line should be valid JSON
      for (const line of lines) {
        const parsed = JSON.parse(line);
        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('event');
        expect(parsed.event).toHaveProperty('hook_event_name');
      }
    });

    test('should auto-save when enabled', () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: true,
      });

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      // File should exist immediately
      expect(fs.existsSync(TEST_FILE)).toBe(true);
      const content = fs.readFileSync(TEST_FILE, 'utf-8');
      expect(content.trim()).toBeTruthy();
    });

    test('should create directory if it does not exist', async () => {
      const nestedPath = path.join(TEST_DIR, 'nested', 'dir', 'events.jsonl');

      const recorder = new EventRecorder({
        output: nestedPath,
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

      expect(fs.existsSync(nestedPath)).toBe(true);
    });
  });

  describe('Timestamps', () => {
    test('should include timestamp in recorded events', () => {
      const recorder = new EventRecorder({
        output: TEST_FILE,
        autoSave: false,
      });

      const beforeRecord = Date.now();

      recorder.record({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      const afterRecord = Date.now();

      const events = recorder.getEvents();
      expect(events[0].timestamp).toBeGreaterThanOrEqual(beforeRecord);
      expect(events[0].timestamp).toBeLessThanOrEqual(afterRecord);
    });

    test('should preserve event order by timestamp', () => {
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

      const events = recorder.getEvents();
      expect(events[0].timestamp).toBeLessThanOrEqual(events[1].timestamp);
    });
  });
});
