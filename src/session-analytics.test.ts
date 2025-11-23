import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { SessionAnalytics } from './session-analytics';
import type { PostToolUseInput, StopInput } from './types';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = '/tmp/claude-hooks-sdk-test';
const TEST_DB = path.join(TEST_DIR, 'analytics.db');

describe('SessionAnalytics', () => {
  beforeEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe('Basic tracking', () => {
    test('should record session start', async () => {
      const analytics = new SessionAnalytics({
        pricing: {},
        storagePath: TEST_DB,
      });

      analytics.recordSessionStart('session-1');
      const metrics = await analytics.getMetrics('session-1');

      expect(metrics).toBeTruthy();
      expect(metrics!.sessionId).toBe('session-1');
      expect(metrics!.turns).toBe(0);

      analytics.close();
    });

    test('should record tool usage', async () => {
      const analytics = new SessionAnalytics({
        pricing: {},
        storagePath: TEST_DB,
      });

      analytics.recordSessionStart('session-1');

      const toolUse: PostToolUseInput = {
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: { file_path: '/test.txt' },
        tool_response: { content: 'test' },
      };

      analytics.recordToolUse(toolUse);

      const metrics = await analytics.getMetrics('session-1');
      expect(metrics!.tools['Read']).toBe(1);

      analytics.close();
    });

    test('should record multiple tool uses', async () => {
      const analytics = new SessionAnalytics({
        pricing: {},
        storagePath: TEST_DB,
      });

      analytics.recordSessionStart('session-1');

      // Record multiple tools
      for (let i = 0; i < 5; i++) {
        analytics.recordToolUse({
          hook_event_name: 'PostToolUse',
          session_id: 'session-1',
          tool_name: 'Read',
          tool_input: {},
          tool_response: {},
        } as PostToolUseInput);
      }

      for (let i = 0; i < 3; i++) {
        analytics.recordToolUse({
          hook_event_name: 'PostToolUse',
          session_id: 'session-1',
          tool_name: 'Write',
          tool_input: {},
          tool_response: {},
        } as PostToolUseInput);
      }

      const metrics = await analytics.getMetrics('session-1');
      expect(metrics!.tools['Read']).toBe(5);
      expect(metrics!.tools['Write']).toBe(3);

      analytics.close();
    });

    test('should track errors', async () => {
      const analytics = new SessionAnalytics({
        pricing: {},
        storagePath: TEST_DB,
      });

      analytics.recordSessionStart('session-1');

      // Record successful tool use
      analytics.recordToolUse({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: { content: 'success' },
      } as PostToolUseInput);

      // Record error
      analytics.recordToolUse({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Write',
        tool_input: {},
        tool_response: { error: 'Permission denied' },
      } as PostToolUseInput);

      const metrics = await analytics.getMetrics('session-1');
      expect(metrics!.errors).toBe(1);
      expect(metrics!.errorRate).toBeCloseTo(0.5);

      analytics.close();
    });
  });

  describe('Token tracking and cost calculation', () => {
    test('should record token usage from Stop events', async () => {
      const analytics = new SessionAnalytics({
        pricing: {
          'claude-sonnet-4': { input: 3.0, output: 15.0 },
        },
        storagePath: TEST_DB,
      });

      analytics.recordSessionStart('session-1');

      const stop: StopInput = {
        hook_event_name: 'Stop',
        session_id: 'session-1',
      };

      const stopWithUsage = {
        ...stop,
        usage: {
          input_tokens: 1000,
          output_tokens: 500,
        },
        model: 'claude-sonnet-4',
      };

      analytics.recordStop(stopWithUsage as any);

      const metrics = await analytics.getMetrics('session-1');
      expect(metrics!.tokens.input).toBe(1000);
      expect(metrics!.tokens.output).toBe(500);
      expect(metrics!.tokens.total).toBe(1500);
      expect(metrics!.turns).toBe(1);

      analytics.close();
    });

    test('should calculate costs correctly', async () => {
      const analytics = new SessionAnalytics({
        pricing: {
          'claude-sonnet-4': { input: 3.0, output: 15.0 }, // per million tokens
        },
        storagePath: TEST_DB,
      });

      analytics.recordSessionStart('session-1');

      const stopWithUsage = {
        hook_event_name: 'Stop',
        session_id: 'session-1',
        usage: {
          input_tokens: 1_000_000, // 1M input tokens
          output_tokens: 500_000, // 500k output tokens
        },
        model: 'claude-sonnet-4',
      };

      analytics.recordStop(stopWithUsage as any);

      const metrics = await analytics.getMetrics('session-1');
      // 1M * $3/M = $3 input
      // 500k * $15/M = $7.5 output
      // Total = $10.5
      expect(metrics!.cost.input).toBeCloseTo(3.0);
      expect(metrics!.cost.output).toBeCloseTo(7.5);
      expect(metrics!.cost.total).toBeCloseTo(10.5);

      analytics.close();
    });

    test('should accumulate tokens across multiple turns', async () => {
      const analytics = new SessionAnalytics({
        pricing: {
          'claude-sonnet-4': { input: 3.0, output: 15.0 },
        },
        storagePath: TEST_DB,
      });

      analytics.recordSessionStart('session-1');

      // Turn 1
      analytics.recordStop({
        hook_event_name: 'Stop',
        session_id: 'session-1',
        usage: { input_tokens: 1000, output_tokens: 500 },
        model: 'claude-sonnet-4',
      } as any);

      // Turn 2
      analytics.recordStop({
        hook_event_name: 'Stop',
        session_id: 'session-1',
        usage: { input_tokens: 2000, output_tokens: 1000 },
        model: 'claude-sonnet-4',
      } as any);

      const metrics = await analytics.getMetrics('session-1');
      expect(metrics!.tokens.input).toBe(3000);
      expect(metrics!.tokens.output).toBe(1500);
      expect(metrics!.tokens.total).toBe(4500);
      expect(metrics!.turns).toBe(2);

      analytics.close();
    });

    test('should handle missing pricing gracefully', async () => {
      const analytics = new SessionAnalytics({
        pricing: {}, // No pricing configured
        storagePath: TEST_DB,
      });

      analytics.recordSessionStart('session-1');

      analytics.recordStop({
        hook_event_name: 'Stop',
        session_id: 'session-1',
        usage: { input_tokens: 1000, output_tokens: 500 },
        model: 'claude-sonnet-4',
      } as any);

      const metrics = await analytics.getMetrics('session-1');
      expect(metrics!.cost.total).toBe(0); // No cost without pricing
      expect(metrics!.tokens.total).toBe(1500); // But tokens are tracked

      analytics.close();
    });
  });

  describe('Session management', () => {
    test('should persist session to storage on end', async () => {
      const analytics = new SessionAnalytics({
        pricing: {},
        storagePath: TEST_DB,
      });

      analytics.recordSessionStart('session-1');
      analytics.recordToolUse({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      await analytics.recordSessionEnd('session-1');

      // Create new instance to verify persistence
      analytics.close();

      const analytics2 = new SessionAnalytics({
        pricing: {},
        storagePath: TEST_DB,
      });

      const metrics = await analytics2.getMetrics('session-1');
      expect(metrics).toBeTruthy();
      expect(metrics!.tools['Read']).toBe(1);

      analytics2.close();
    });

    test('should track multiple sessions independently', async () => {
      const analytics = new SessionAnalytics({
        pricing: {},
        storagePath: TEST_DB,
      });

      // Session 1
      analytics.recordSessionStart('session-1');
      analytics.recordToolUse({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      // Session 2
      analytics.recordSessionStart('session-2');
      analytics.recordToolUse({
        hook_event_name: 'PostToolUse',
        session_id: 'session-2',
        tool_name: 'Write',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      const metrics1 = await analytics.getMetrics('session-1');
      const metrics2 = await analytics.getMetrics('session-2');

      expect(metrics1!.tools['Read']).toBe(1);
      expect(metrics1!.tools['Write']).toBeUndefined();
      expect(metrics2!.tools['Write']).toBe(1);
      expect(metrics2!.tools['Read']).toBeUndefined();

      analytics.close();
    });

    test('should calculate duration correctly', async () => {
      const analytics = new SessionAnalytics({
        pricing: {},
        storagePath: TEST_DB,
      });

      const startTime = Date.now();
      analytics.recordSessionStart('session-1', startTime);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      const endTime = Date.now();
      await analytics.recordSessionEnd('session-1', endTime);

      const metrics = await analytics.getMetrics('session-1');
      expect(metrics!.duration.elapsedMs).toBeGreaterThan(50);
      expect(metrics!.duration.start).toEqual(new Date(startTime));
      expect(metrics!.duration.end).toEqual(new Date(endTime));

      analytics.close();
    });
  });

  describe('Aggregated metrics', () => {
    test('should calculate average cost', async () => {
      const analytics = new SessionAnalytics({
        pricing: {
          'claude-sonnet-4': { input: 3.0, output: 15.0 },
        },
        storagePath: TEST_DB,
      });

      // Session 1: $10.5
      analytics.recordSessionStart('session-1');
      analytics.recordStop({
        hook_event_name: 'Stop',
        session_id: 'session-1',
        usage: { input_tokens: 1_000_000, output_tokens: 500_000 },
        model: 'claude-sonnet-4',
      } as any);
      await analytics.recordSessionEnd('session-1');

      // Session 2: $21.0
      analytics.recordSessionStart('session-2');
      analytics.recordStop({
        hook_event_name: 'Stop',
        session_id: 'session-2',
        usage: { input_tokens: 2_000_000, output_tokens: 1_000_000 },
        model: 'claude-sonnet-4',
      } as any);
      await analytics.recordSessionEnd('session-2');

      const avgCost = await analytics.getAverageCost();
      expect(avgCost).toBeCloseTo(15.75); // (10.5 + 21.0) / 2

      analytics.close();
    });

    test('should aggregate metrics across sessions', async () => {
      const analytics = new SessionAnalytics({
        pricing: {
          'claude-sonnet-4': { input: 3.0, output: 15.0 },
        },
        storagePath: TEST_DB,
      });

      // Session 1
      analytics.recordSessionStart('session-1');
      analytics.recordToolUse({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);
      analytics.recordStop({
        hook_event_name: 'Stop',
        session_id: 'session-1',
        usage: { input_tokens: 1000, output_tokens: 500 },
        model: 'claude-sonnet-4',
      } as any);
      await analytics.recordSessionEnd('session-1');

      // Session 2
      analytics.recordSessionStart('session-2');
      analytics.recordToolUse({
        hook_event_name: 'PostToolUse',
        session_id: 'session-2',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);
      analytics.recordToolUse({
        hook_event_name: 'PostToolUse',
        session_id: 'session-2',
        tool_name: 'Write',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);
      analytics.recordStop({
        hook_event_name: 'Stop',
        session_id: 'session-2',
        usage: { input_tokens: 2000, output_tokens: 1000 },
        model: 'claude-sonnet-4',
      } as any);
      await analytics.recordSessionEnd('session-2');

      const agg = await analytics.getAggregatedMetrics();

      expect(agg.totalSessions).toBe(2);
      expect(agg.totalTokens).toBe(4500);
      expect(agg.totalTurns).toBe(2);
      expect(agg.averageTurns).toBe(1);
      expect(agg.mostUsedTools).toContainEqual({ tool: 'Read', count: 2 });
      expect(agg.mostUsedTools).toContainEqual({ tool: 'Write', count: 1 });

      analytics.close();
    });

    test('should handle empty sessions', async () => {
      const analytics = new SessionAnalytics({
        pricing: {},
        storagePath: TEST_DB,
      });

      const agg = await analytics.getAggregatedMetrics();

      expect(agg.totalSessions).toBe(0);
      expect(agg.totalCost).toBe(0);
      expect(agg.averageCost).toBe(0);
      expect(agg.mostUsedTools).toEqual([]);

      analytics.close();
    });
  });

  describe('Memory backend', () => {
    test('should work with memory storage', async () => {
      const analytics = new SessionAnalytics({
        pricing: {},
        // No storagePath = memory storage
      });

      analytics.recordSessionStart('session-1');
      analytics.recordToolUse({
        hook_event_name: 'PostToolUse',
        session_id: 'session-1',
        tool_name: 'Read',
        tool_input: {},
        tool_response: {},
      } as PostToolUseInput);

      const metrics = await analytics.getMetrics('session-1');
      expect(metrics).toBeTruthy();
      expect(metrics!.tools['Read']).toBe(1);

      analytics.close();
    });
  });
});
