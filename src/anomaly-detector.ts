/**
 * AnomalyDetector - Detect unusual patterns and alert
 *
 * @example
 * ```typescript
 * const detector = new AnomalyDetector({
 *   rules: {
 *     errorRate: { threshold: 0.1, window: '5m' },
 *     responseTime: { threshold: 30000, type: 'p95' },
 *     tokenSpike: { stdDev: 3 }
 *   },
 *   onAnomaly: (anomaly) => {
 *     console.error('Anomaly detected:', anomaly);
 *   }
 * });
 *
 * manager.onPostToolUse((input) => {
 *   detector.check(input);
 * });
 * ```
 */

import type { AnyHookInput, PostToolUseInput, StopInput } from './types';

export interface ErrorRateRule {
  threshold: number;
  window: string | number;
}

export interface ResponseTimeRule {
  threshold: number;
  type: 'p50' | 'p95' | 'p99' | 'max' | 'avg';
}

export interface ToolSequenceRule {
  unexpected: string[];
}

export interface TokenSpikeRule {
  stdDev: number;
}

export interface AnomalyRules {
  errorRate?: ErrorRateRule;
  responseTime?: ResponseTimeRule;
  toolSequence?: ToolSequenceRule;
  tokenSpike?: TokenSpikeRule;
}

export interface Anomaly {
  type: string;
  value: number;
  threshold: number;
  timestamp: Date;
  sessionId?: string;
  details?: any;
}

export interface AnomalyDetectorOptions {
  rules: AnomalyRules;
  onAnomaly?: (anomaly: Anomaly) => void | Promise<void>;
}

interface SessionStats {
  sessionId: string;
  errors: number;
  totalEvents: number;
  responseTimes: number[];
  toolSequence: string[];
  tokens: number[];
  startTime: number;
}

/**
 * AnomalyDetector detects unusual patterns in hook events
 */
export class AnomalyDetector {
  private rules: AnomalyRules;
  private onAnomalyHandler?: (anomaly: Anomaly) => void | Promise<void>;
  private sessions: Map<string, SessionStats> = new Map();
  private anomalies: Map<string, Anomaly[]> = new Map();

  constructor(options: AnomalyDetectorOptions) {
    this.rules = options.rules;
    this.onAnomalyHandler = options.onAnomaly;
  }

  /**
   * Check an event for anomalies
   */
  async check(input: AnyHookInput): Promise<void> {
    const sessionId = input.session_id;
    let stats = this.sessions.get(sessionId);

    if (!stats) {
      stats = {
        sessionId,
        errors: 0,
        totalEvents: 0,
        responseTimes: [],
        toolSequence: [],
        tokens: [],
        startTime: Date.now(),
      };
      this.sessions.set(sessionId, stats);
    }

    stats.totalEvents++;

    // Track errors
    if (input.hook_event_name === 'PostToolUse') {
      const postToolUse = input as PostToolUseInput;
      if (postToolUse.tool_response && typeof postToolUse.tool_response === 'object') {
        const response = postToolUse.tool_response as any;
        if (response.error || response.type === 'error') {
          stats.errors++;
        }
      }

      // Track tool sequence
      stats.toolSequence.push(postToolUse.tool_name);

      // Check error rate
      if (this.rules.errorRate) {
        await this.checkErrorRate(stats);
      }

      // Check tool sequence
      if (this.rules.toolSequence) {
        await this.checkToolSequence(stats);
      }
    }

    // Track response times and tokens from Stop events
    if (input.hook_event_name === 'Stop') {
      const stop = input as StopInput;
      const stopData = stop as any;

      if (stopData.usage) {
        const totalTokens = (stopData.usage.input_tokens || 0) + (stopData.usage.output_tokens || 0);
        stats.tokens.push(totalTokens);

        // Check token spike
        if (this.rules.tokenSpike) {
          await this.checkTokenSpike(stats);
        }
      }

      // Track response time
      const responseTime = Date.now() - stats.startTime;
      stats.responseTimes.push(responseTime);

      // Check response time
      if (this.rules.responseTime) {
        await this.checkResponseTime(stats);
      }
    }
  }

  /**
   * Check error rate anomaly
   */
  private async checkErrorRate(stats: SessionStats): Promise<void> {
    if (!this.rules.errorRate) return;

    const errorRate = stats.errors / stats.totalEvents;
    if (errorRate > this.rules.errorRate.threshold) {
      const anomaly: Anomaly = {
        type: 'error_rate',
        value: errorRate,
        threshold: this.rules.errorRate.threshold,
        timestamp: new Date(),
        sessionId: stats.sessionId,
        details: {
          errors: stats.errors,
          totalEvents: stats.totalEvents,
        },
      };

      await this.recordAnomaly(stats.sessionId, anomaly);
    }
  }

  /**
   * Check response time anomaly
   */
  private async checkResponseTime(stats: SessionStats): Promise<void> {
    if (!this.rules.responseTime || stats.responseTimes.length === 0) return;

    const rule = this.rules.responseTime;
    let value: number;

    switch (rule.type) {
      case 'max':
        value = Math.max(...stats.responseTimes);
        break;
      case 'avg':
        value = stats.responseTimes.reduce((sum, t) => sum + t, 0) / stats.responseTimes.length;
        break;
      case 'p50':
        value = this.percentile(stats.responseTimes, 0.5);
        break;
      case 'p95':
        value = this.percentile(stats.responseTimes, 0.95);
        break;
      case 'p99':
        value = this.percentile(stats.responseTimes, 0.99);
        break;
      default:
        return;
    }

    if (value > rule.threshold) {
      const anomaly: Anomaly = {
        type: 'response_time',
        value,
        threshold: rule.threshold,
        timestamp: new Date(),
        sessionId: stats.sessionId,
        details: {
          metric: rule.type,
          responseTimes: stats.responseTimes,
        },
      };

      await this.recordAnomaly(stats.sessionId, anomaly);
    }
  }

  /**
   * Check tool sequence anomaly
   */
  private async checkToolSequence(stats: SessionStats): Promise<void> {
    if (!this.rules.toolSequence) return;

    const unexpected = this.rules.toolSequence.unexpected;
    const sequence = stats.toolSequence.slice(-unexpected.length);

    // Check if the sequence matches the unexpected pattern
    if (sequence.length === unexpected.length) {
      const matches = sequence.every((tool, i) => tool === unexpected[i]);

      if (matches) {
        const anomaly: Anomaly = {
          type: 'tool_sequence',
          value: 1,
          threshold: 1,
          timestamp: new Date(),
          sessionId: stats.sessionId,
          details: {
            sequence,
            fullSequence: stats.toolSequence,
          },
        };

        await this.recordAnomaly(stats.sessionId, anomaly);
      }
    }
  }

  /**
   * Check token spike anomaly
   */
  private async checkTokenSpike(stats: SessionStats): Promise<void> {
    if (!this.rules.tokenSpike || stats.tokens.length < 3) return;

    const mean = stats.tokens.reduce((sum, t) => sum + t, 0) / stats.tokens.length;
    const variance =
      stats.tokens.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / stats.tokens.length;
    const stdDev = Math.sqrt(variance);

    const latest = stats.tokens[stats.tokens.length - 1];
    const zScore = (latest - mean) / stdDev;

    if (Math.abs(zScore) > this.rules.tokenSpike.stdDev) {
      const anomaly: Anomaly = {
        type: 'token_spike',
        value: latest,
        threshold: mean + this.rules.tokenSpike.stdDev * stdDev,
        timestamp: new Date(),
        sessionId: stats.sessionId,
        details: {
          zScore,
          mean,
          stdDev,
          tokens: stats.tokens,
        },
      };

      await this.recordAnomaly(stats.sessionId, anomaly);
    }
  }

  /**
   * Record an anomaly
   */
  private async recordAnomaly(sessionId: string, anomaly: Anomaly): Promise<void> {
    if (!this.anomalies.has(sessionId)) {
      this.anomalies.set(sessionId, []);
    }

    this.anomalies.get(sessionId)!.push(anomaly);

    if (this.onAnomalyHandler) {
      await this.onAnomalyHandler(anomaly);
    }
  }

  /**
   * Get anomalies for a session
   */
  getAnomalies(sessionId: string): Anomaly[] {
    return this.anomalies.get(sessionId) || [];
  }

  /**
   * Get all anomalies
   */
  getAllAnomalies(): Map<string, Anomaly[]> {
    return new Map(this.anomalies);
  }

  /**
   * Get statistics for a session
   */
  getStatistics(sessionId: string): {
    mean: number;
    median: number;
    p95: number;
    stdDev: number;
  } | null {
    const stats = this.sessions.get(sessionId);
    if (!stats || stats.responseTimes.length === 0) {
      return null;
    }

    const times = [...stats.responseTimes].sort((a, b) => a - b);
    const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
    const median = this.percentile(times, 0.5);
    const p95 = this.percentile(times, 0.95);

    const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
    const stdDev = Math.sqrt(variance);

    return { mean, median, p95, stdDev };
  }

  /**
   * Calculate percentile
   */
  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index] || 0;
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.sessions.clear();
    this.anomalies.clear();
  }
}
