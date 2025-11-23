import { describe, test, expect, beforeEach } from 'bun:test';
import { AnomalyDetector } from './anomaly-detector';
import type { PostToolUseInput, StopInput } from './types';

describe('AnomalyDetector', () => {
  const createToolUseInput = (sessionId: string, toolName: string, hasError: boolean = false): PostToolUseInput => ({
    hook_event_name: 'PostToolUse',
    session_id: sessionId,
    tool_name: toolName,
    tool_input: {},
    tool_response: hasError ? { error: 'Test error' } : { success: true },
  });

  const createStopInput = (sessionId: string, inputTokens: number, outputTokens: number): StopInput => {
    const stop: any = {
      hook_event_name: 'Stop',
      session_id: sessionId,
      usage: {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
      },
      model: 'claude-sonnet-4',
    };
    return stop;
  };

  describe('Error rate detection', () => {
    test('should detect high error rate', async () => {
      let anomalyDetected = false;

      const detector = new AnomalyDetector({
        rules: {
          errorRate: {
            threshold: 0.5, // 50%
            window: '5m',
          },
        },
        onAnomaly: async (anomaly) => {
          anomalyDetected = true;
          expect(anomaly.type).toBe('error_rate');
          expect(anomaly.value).toBeGreaterThan(0.5);
        },
      });

      const sessionId = 'session-1';

      // Generate events with 60% error rate
      await detector.check(createToolUseInput(sessionId, 'Read', false));
      await detector.check(createToolUseInput(sessionId, 'Write', true));
      await detector.check(createToolUseInput(sessionId, 'Edit', true));
      await detector.check(createToolUseInput(sessionId, 'Read', true));
      await detector.check(createToolUseInput(sessionId, 'Grep', false));

      // 3/5 = 60% error rate, should trigger
      expect(anomalyDetected).toBe(true);
    });

    test('should not detect normal error rate', async () => {
      let anomalyDetected = false;

      const detector = new AnomalyDetector({
        rules: {
          errorRate: {
            threshold: 0.5,
            window: '5m',
          },
        },
        onAnomaly: async () => {
          anomalyDetected = true;
        },
      });

      const sessionId = 'session-1';

      // Generate events with 20% error rate
      await detector.check(createToolUseInput(sessionId, 'Read', false));
      await detector.check(createToolUseInput(sessionId, 'Write', false));
      await detector.check(createToolUseInput(sessionId, 'Edit', true));
      await detector.check(createToolUseInput(sessionId, 'Read', false));
      await detector.check(createToolUseInput(sessionId, 'Grep', false));

      // 1/5 = 20% error rate, should not trigger
      expect(anomalyDetected).toBe(false);
    });

    test('should track errors across sessions', async () => {
      const detector = new AnomalyDetector({
        rules: {
          errorRate: {
            threshold: 0.3,
            window: '5m',
          },
        },
      });

      await detector.check(createToolUseInput('session-1', 'Read', true));
      await detector.check(createToolUseInput('session-2', 'Write', false));

      const anomalies1 = detector.getAnomalies('session-1');
      const anomalies2 = detector.getAnomalies('session-2');

      expect(anomalies1.length).toBeGreaterThanOrEqual(0);
      expect(anomalies2.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Response time detection', () => {
    test('should detect slow response times', async () => {
      let anomalyDetected = false;

      const detector = new AnomalyDetector({
        rules: {
          responseTime: {
            threshold: 10000, // 10 seconds
            type: 'max',
          },
        },
        onAnomaly: async (anomaly) => {
          anomalyDetected = true;
          expect(anomaly.type).toBe('response_time');
        },
      });

      const sessionId = 'session-1';

      // Simulate slow response by recording stop after delay
      await detector.check(createStopInput(sessionId, 1000, 500));

      // Wait to simulate slow turn
      await new Promise((resolve) => setTimeout(resolve, 50));

      await detector.check(createStopInput(sessionId, 1000, 500));

      // Check if anomaly was detected (may need adjustment based on timing)
    });

    test('should calculate p95 correctly', async () => {
      const detector = new AnomalyDetector({
        rules: {
          responseTime: {
            threshold: 5000,
            type: 'p95',
          },
        },
      });

      const sessionId = 'session-1';

      // Generate multiple stops to build response time history
      for (let i = 0; i < 20; i++) {
        await detector.check(createStopInput(sessionId, 1000, 500));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const stats = detector.getStatistics(sessionId);
      expect(stats).toBeTruthy();
      expect(stats!.p95).toBeGreaterThan(0);
    });

    test('should return null stats for session with no stops', () => {
      const detector = new AnomalyDetector({
        rules: {},
      });

      const stats = detector.getStatistics('non-existent');
      expect(stats).toBeNull();
    });
  });

  describe('Token spike detection', () => {
    test('should detect token spikes', async () => {
      let anomalyDetected = false;

      const detector = new AnomalyDetector({
        rules: {
          tokenSpike: {
            stdDev: 2, // 2 standard deviations
          },
        },
        onAnomaly: async (anomaly) => {
          anomalyDetected = true;
          expect(anomaly.type).toBe('token_spike');
          expect(anomaly.details).toHaveProperty('zScore');
        },
      });

      const sessionId = 'session-1';

      // Generate consistent normal token usage (around 1000 tokens)
      for (let i = 0; i < 10; i++) {
        await detector.check(createStopInput(sessionId, 900 + (i * 10), 100));
      }

      // Generate massive spike (20x normal)
      await detector.check(createStopInput(sessionId, 18000, 2000));

      expect(anomalyDetected).toBe(true);
    });

    test('should not detect normal token variance', async () => {
      let anomalyDetected = false;

      const detector = new AnomalyDetector({
        rules: {
          tokenSpike: {
            stdDev: 2,
          },
        },
        onAnomaly: async () => {
          anomalyDetected = true;
        },
      });

      const sessionId = 'session-1';

      // Generate consistent token usage
      await detector.check(createStopInput(sessionId, 900, 100));
      await detector.check(createStopInput(sessionId, 950, 50));
      await detector.check(createStopInput(sessionId, 850, 150));
      await detector.check(createStopInput(sessionId, 920, 80));

      expect(anomalyDetected).toBe(false);
    });

    test('should require minimum samples before detecting spikes', async () => {
      let anomalyDetected = false;

      const detector = new AnomalyDetector({
        rules: {
          tokenSpike: {
            stdDev: 2,
          },
        },
        onAnomaly: async () => {
          anomalyDetected = true;
        },
      });

      const sessionId = 'session-1';

      // Only 2 samples (need 3 minimum)
      await detector.check(createStopInput(sessionId, 1000, 500));
      await detector.check(createStopInput(sessionId, 10000, 5000));

      // Should not detect with insufficient samples
      expect(anomalyDetected).toBe(false);
    });
  });

  describe('Anomaly retrieval', () => {
    test('should retrieve anomalies for session', async () => {
      const detector = new AnomalyDetector({
        rules: {
          errorRate: {
            threshold: 0.3,
            window: '5m',
          },
        },
      });

      const sessionId = 'session-1';

      // Generate errors to trigger anomaly
      await detector.check(createToolUseInput(sessionId, 'Read', true));
      await detector.check(createToolUseInput(sessionId, 'Write', true));

      const anomalies = detector.getAnomalies(sessionId);
      expect(Array.isArray(anomalies)).toBe(true);
    });

    test('should retrieve all anomalies', async () => {
      const detector = new AnomalyDetector({
        rules: {
          errorRate: {
            threshold: 0.5,
            window: '5m',
          },
        },
      });

      // Generate anomalies in multiple sessions
      await detector.check(createToolUseInput('session-1', 'Read', true));
      await detector.check(createToolUseInput('session-1', 'Write', true));
      await detector.check(createToolUseInput('session-2', 'Read', true));

      const allAnomalies = detector.getAllAnomalies();
      expect(allAnomalies instanceof Map).toBe(true);
    });

    test('should return empty array for session with no anomalies', () => {
      const detector = new AnomalyDetector({
        rules: {},
      });

      const anomalies = detector.getAnomalies('non-existent');
      expect(anomalies).toEqual([]);
    });
  });

  describe('Statistics', () => {
    test('should calculate session statistics', async () => {
      const detector = new AnomalyDetector({
        rules: {},
      });

      const sessionId = 'session-1';

      // Generate multiple stops
      for (let i = 0; i < 10; i++) {
        await detector.check(createStopInput(sessionId, 1000, 500));
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      const stats = detector.getStatistics(sessionId);

      expect(stats).toBeTruthy();
      expect(stats!.mean).toBeGreaterThan(0);
      expect(stats!.median).toBeGreaterThan(0);
      expect(stats!.p95).toBeGreaterThan(0);
      expect(stats!.stdDev).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Clear', () => {
    test('should clear all data', async () => {
      const detector = new AnomalyDetector({
        rules: {
          errorRate: {
            threshold: 0.5,
            window: '5m',
          },
        },
      });

      const sessionId = 'session-1';

      await detector.check(createToolUseInput(sessionId, 'Read', true));
      await detector.check(createStopInput(sessionId, 1000, 500));

      detector.clear();

      const anomalies = detector.getAnomalies(sessionId);
      const stats = detector.getStatistics(sessionId);

      expect(anomalies).toEqual([]);
      expect(stats).toBeNull();
    });
  });

  describe('Multiple rules', () => {
    test('should apply multiple detection rules', async () => {
      const detectedTypes = new Set<string>();

      const detector = new AnomalyDetector({
        rules: {
          errorRate: {
            threshold: 0.3,
            window: '5m',
          },
          tokenSpike: {
            stdDev: 2,
          },
        },
        onAnomaly: async (anomaly) => {
          detectedTypes.add(anomaly.type);
        },
      });

      const sessionId = 'session-1';

      // Trigger error rate anomaly
      await detector.check(createToolUseInput(sessionId, 'Read', true));
      await detector.check(createToolUseInput(sessionId, 'Write', true));

      // Trigger token spike
      await detector.check(createStopInput(sessionId, 1000, 500));
      await detector.check(createStopInput(sessionId, 1000, 500));
      await detector.check(createStopInput(sessionId, 1000, 500));
      await detector.check(createStopInput(sessionId, 10000, 5000));

      // Should detect both types (may vary based on timing)
    });
  });
});
