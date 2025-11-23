/**
 * SessionAnalytics - Track costs, performance, and usage patterns
 *
 * Automatically tracks token usage, costs, tool usage, and session metrics.
 *
 * @example
 * ```typescript
 * const analytics = new SessionAnalytics({
 *   pricing: {
 *     'claude-sonnet-4': { input: 3.00, output: 15.00 }  // per million tokens
 *   }
 * });
 *
 * // Record events
 * manager.onPostToolUse((input) => {
 *   analytics.recordToolUse(input);
 * });
 *
 * manager.onStop((input) => {
 *   analytics.recordStop(input);
 * });
 *
 * // Get metrics
 * const metrics = analytics.getMetrics(sessionId);
 * const avgCost = analytics.getAverageCost();
 * ```
 */

import { PersistentState } from './persistent-state';
import type { PostToolUseInput, StopInput } from './types';

export interface ModelPricing {
  /** Input token price per million tokens */
  input: number;
  /** Output token price per million tokens */
  output: number;
}

export interface SessionAnalyticsOptions {
  /** Pricing configuration per model */
  pricing: Record<string, ModelPricing>;
  /** Optional persistent state for storing metrics */
  state?: PersistentState;
  /** Storage path for metrics (if state not provided) */
  storagePath?: string;
}

export interface TokenUsage {
  input: number;
  output: number;
  total: number;
}

export interface CostBreakdown {
  input: number;
  output: number;
  total: number;
}

export interface DurationInfo {
  start: Date | null;
  end: Date | null;
  elapsed: string;
  elapsedMs: number;
}

export interface SessionMetrics {
  sessionId: string;
  duration: DurationInfo;
  tools: Record<string, number>;
  tokens: TokenUsage;
  cost: CostBreakdown;
  turns: number;
  errors: number;
  errorRate: number;
  model?: string;
}

export interface AggregatedMetrics {
  totalSessions: number;
  totalCost: number;
  averageCost: number;
  totalTokens: number;
  totalTurns: number;
  averageTurns: number;
  totalErrors: number;
  averageErrorRate: number;
  mostUsedTools: Array<{ tool: string; count: number }>;
}

interface SessionData {
  sessionId: string;
  startTime: number | null;
  endTime: number | null;
  tools: Record<string, number>;
  inputTokens: number;
  outputTokens: number;
  turns: number;
  errors: number;
  model?: string;
}

/**
 * SessionAnalytics tracks costs, performance, and usage patterns
 */
export class SessionAnalytics {
  private pricing: Record<string, ModelPricing>;
  private state: PersistentState;
  private memory: Map<string, SessionData> = new Map();

  constructor(options: SessionAnalyticsOptions) {
    this.pricing = options.pricing;

    if (options.state) {
      this.state = options.state;
    } else {
      this.state = new PersistentState({
        storage: options.storagePath ? 'file' : 'memory',
        path: options.storagePath,
      });
    }
  }

  /**
   * Record a session start
   */
  recordSessionStart(sessionId: string, timestamp?: number): void {
    const now = timestamp || Date.now();

    const data: SessionData = {
      sessionId,
      startTime: now,
      endTime: null,
      tools: {},
      inputTokens: 0,
      outputTokens: 0,
      turns: 0,
      errors: 0,
    };

    this.memory.set(sessionId, data);
  }

  /**
   * Record a tool use event
   */
  recordToolUse(input: PostToolUseInput): void {
    const sessionId = input.session_id;
    let data = this.memory.get(sessionId);

    if (!data) {
      // Initialize if not exists
      this.recordSessionStart(sessionId);
      data = this.memory.get(sessionId)!;
    }

    // Track tool usage
    const toolName = input.tool_name;
    data.tools[toolName] = (data.tools[toolName] || 0) + 1;

    // Check for errors
    if (input.tool_response && typeof input.tool_response === 'object') {
      const response = input.tool_response as any;
      if (response.error || response.type === 'error') {
        data.errors++;
      }
    }
  }

  /**
   * Record a Stop event with token usage
   */
  recordStop(input: StopInput): void {
    const sessionId = input.session_id;
    let data = this.memory.get(sessionId);

    if (!data) {
      this.recordSessionStart(sessionId);
      data = this.memory.get(sessionId)!;
    }

    data.turns++;

    // Extract token usage from Stop event
    const stopData = input as any;
    if (stopData.usage) {
      data.inputTokens += stopData.usage.input_tokens || 0;
      data.outputTokens += stopData.usage.output_tokens || 0;
    }

    // Extract model
    if (stopData.model) {
      data.model = stopData.model;
    }
  }

  /**
   * Record a session end
   */
  async recordSessionEnd(sessionId: string, timestamp?: number): Promise<void> {
    const data = this.memory.get(sessionId);
    if (data) {
      data.endTime = timestamp || Date.now();

      // Persist to storage
      await this.state.set(`session:${sessionId}`, data);
    }
  }

  /**
   * Calculate cost for a session
   */
  private calculateCost(data: SessionData): CostBreakdown {
    if (!data.model || !this.pricing[data.model]) {
      return { input: 0, output: 0, total: 0 };
    }

    const pricing = this.pricing[data.model];
    const inputCost = (data.inputTokens / 1_000_000) * pricing.input;
    const outputCost = (data.outputTokens / 1_000_000) * pricing.output;

    return {
      input: inputCost,
      output: outputCost,
      total: inputCost + outputCost,
    };
  }

  /**
   * Format duration as human-readable string
   */
  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get metrics for a specific session
   */
  async getMetrics(sessionId: string): Promise<SessionMetrics | null> {
    // Try memory first
    let data = this.memory.get(sessionId);

    // Fallback to storage
    if (!data) {
      const storedData = await this.state.get<SessionData>(`session:${sessionId}`);
      if (!storedData) return null;
      data = storedData;
    }

    const elapsedMs = data.endTime && data.startTime ? data.endTime - data.startTime : 0;
    const totalTools = Object.values(data.tools).reduce((sum, count) => sum + count, 0);

    return {
      sessionId: data.sessionId,
      duration: {
        start: data.startTime ? new Date(data.startTime) : null,
        end: data.endTime ? new Date(data.endTime) : null,
        elapsed: this.formatDuration(elapsedMs),
        elapsedMs,
      },
      tools: data.tools,
      tokens: {
        input: data.inputTokens,
        output: data.outputTokens,
        total: data.inputTokens + data.outputTokens,
      },
      cost: this.calculateCost(data),
      turns: data.turns,
      errors: data.errors,
      errorRate: totalTools > 0 ? data.errors / totalTools : 0,
      model: data.model,
    };
  }

  /**
   * Get all session IDs
   */
  async getAllSessionIds(): Promise<string[]> {
    const keys = await this.state.keys();
    return keys.filter((k) => k.startsWith('session:')).map((k) => k.replace('session:', ''));
  }

  /**
   * Get all sessions
   */
  async getAllSessions(): Promise<SessionMetrics[]> {
    const sessionIds = await this.getAllSessionIds();
    const sessions: SessionMetrics[] = [];

    for (const sessionId of sessionIds) {
      const metrics = await this.getMetrics(sessionId);
      if (metrics) {
        sessions.push(metrics);
      }
    }

    return sessions;
  }

  /**
   * Get average cost across all sessions
   */
  async getAverageCost(): Promise<number> {
    const sessions = await this.getAllSessions();
    if (sessions.length === 0) return 0;

    const totalCost = sessions.reduce((sum, s) => sum + s.cost.total, 0);
    return totalCost / sessions.length;
  }

  /**
   * Get aggregated metrics across all sessions
   */
  async getAggregatedMetrics(): Promise<AggregatedMetrics> {
    const sessions = await this.getAllSessions();

    if (sessions.length === 0) {
      return {
        totalSessions: 0,
        totalCost: 0,
        averageCost: 0,
        totalTokens: 0,
        totalTurns: 0,
        averageTurns: 0,
        totalErrors: 0,
        averageErrorRate: 0,
        mostUsedTools: [],
      };
    }

    const totalCost = sessions.reduce((sum, s) => sum + s.cost.total, 0);
    const totalTokens = sessions.reduce((sum, s) => sum + s.tokens.total, 0);
    const totalTurns = sessions.reduce((sum, s) => sum + s.turns, 0);
    const totalErrors = sessions.reduce((sum, s) => sum + s.errors, 0);
    const totalErrorRate = sessions.reduce((sum, s) => sum + s.errorRate, 0);

    // Aggregate tool usage
    const toolCounts: Record<string, number> = {};
    for (const session of sessions) {
      for (const [tool, count] of Object.entries(session.tools)) {
        toolCounts[tool] = (toolCounts[tool] || 0) + count;
      }
    }

    const mostUsedTools = Object.entries(toolCounts)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSessions: sessions.length,
      totalCost,
      averageCost: totalCost / sessions.length,
      totalTokens,
      totalTurns,
      averageTurns: totalTurns / sessions.length,
      totalErrors,
      averageErrorRate: totalErrorRate / sessions.length,
      mostUsedTools,
    };
  }

  /**
   * Clear all analytics data
   */
  async clear(): Promise<void> {
    this.memory.clear();
    await this.state.clear();
  }

  /**
   * Close the analytics (closes underlying state storage)
   */
  close(): void {
    this.state.close();
  }
}
