/**
 * Tests for UserPromptSubmit hook helper
 */

import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { createUserPromptSubmitHook } from '../src/userPromptSubmit';
import * as sessionNamer from '../src/session-namer';

describe('createUserPromptSubmitHook', () => {
  // Mock stdin
  const mockStdin = (data: string) => {
    spyOn(Bun.stdin, 'text').mockResolvedValue(data);
  };

  // Mock stdout
  let consoleOutput: string[] = [];
  const mockConsoleLog = () => {
    consoleOutput = [];
    spyOn(console, 'log').mockImplementation((msg: string) => {
      consoleOutput.push(msg);
    });
  };

  // Mock process.exit
  const mockExit = () => {
    spyOn(process, 'exit').mockImplementation((() => {}) as any);
  };

  beforeEach(() => {
    mockConsoleLog();
    mockExit();
    consoleOutput = [];
  });

  it('should inject session context by default', async () => {
    const input = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'test-session-id-1234',
      prompt: 'Hello',
      cwd: '/test',
      timestamp: '2024-01-01T00:00:00Z'
    };

    mockStdin(JSON.stringify(input));
    spyOn(sessionNamer, 'getSessionName').mockReturnValue('brave-elephant');

    await createUserPromptSubmitHook();

    expect(consoleOutput).toHaveLength(1);
    const output = JSON.parse(consoleOutput[0]);
    expect(output.hookSpecificOutput).toBeDefined();
    expect(output.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit');
    expect(output.hookSpecificOutput.additionalContext).toContain('brave-elephant');
    expect(output.hookSpecificOutput.additionalContext).toContain('test-ses'); // First 8 chars
  });

  it('should use custom format function', async () => {
    const input = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'abc123',
      prompt: 'Test',
      cwd: '/test',
      timestamp: '2024-01-01T00:00:00Z'
    };

    mockStdin(JSON.stringify(input));
    spyOn(sessionNamer, 'getSessionName').mockReturnValue('clever-dolphin');

    await createUserPromptSubmitHook({
      format: (name, id) => `🔵 Session: ${name} [${id.slice(0, 4)}]`
    });

    const output = JSON.parse(consoleOutput[0]);
    expect(output.hookSpecificOutput.additionalContext).toBe('🔵 Session: clever-dolphin [abc1]');
  });

  it('should skip session context when disabled', async () => {
    const input = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'test-id',
      prompt: 'Test',
      cwd: '/test',
      timestamp: '2024-01-01T00:00:00Z'
    };

    mockStdin(JSON.stringify(input));

    await createUserPromptSubmitHook({
      injectSessionContext: false
    });

    const output = JSON.parse(consoleOutput[0]);
    // Should output empty object when no context
    expect(output).toEqual({});
  });

  it('should include custom context', async () => {
    const input = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'test-id',
      prompt: 'Test',
      cwd: '/test',
      timestamp: '2024-01-01T00:00:00Z'
    };

    mockStdin(JSON.stringify(input));
    spyOn(sessionNamer, 'getSessionName').mockReturnValue('test-session');

    await createUserPromptSubmitHook({
      customContext: () => 'Custom info: xyz'
    });

    const output = JSON.parse(consoleOutput[0]);
    const context = output.hookSpecificOutput.additionalContext;
    expect(context).toContain('test-session');
    expect(context).toContain('Custom info: xyz');
  });

  it('should handle async custom context', async () => {
    const input = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'test-id',
      prompt: 'Test',
      cwd: '/test',
      timestamp: '2024-01-01T00:00:00Z'
    };

    mockStdin(JSON.stringify(input));
    spyOn(sessionNamer, 'getSessionName').mockReturnValue('test-session');

    await createUserPromptSubmitHook({
      customContext: async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'Async data';
      }
    });

    const output = JSON.parse(consoleOutput[0]);
    expect(output.hookSpecificOutput.additionalContext).toContain('Async data');
  });

  it('should handle invalid JSON gracefully', async () => {
    mockStdin('invalid json {{{');

    await createUserPromptSubmitHook();

    // Should output empty object (might have console.error calls too)
    const jsonOutput = consoleOutput.find(line => line.startsWith('{'));
    expect(jsonOutput).toBeDefined();
    const output = JSON.parse(jsonOutput!);
    expect(output).toEqual({}); // Should output empty object
  });

  it('should handle session name lookup failure', async () => {
    const input = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'unknown-id',
      prompt: 'Test',
      cwd: '/test',
      timestamp: '2024-01-01T00:00:00Z'
    };

    mockStdin(JSON.stringify(input));
    spyOn(sessionNamer, 'getSessionName').mockImplementation(() => {
      throw new Error('Session not found');
    });

    await createUserPromptSubmitHook();

    // Should not crash, just output empty object
    expect(consoleOutput).toHaveLength(1);
    const output = JSON.parse(consoleOutput[0]);
    expect(output).toEqual({});
  });

  it('should handle custom context errors with onError callback', async () => {
    const input = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'test-id',
      prompt: 'Test',
      cwd: '/test',
      timestamp: '2024-01-01T00:00:00Z'
    };

    mockStdin(JSON.stringify(input));
    spyOn(sessionNamer, 'getSessionName').mockReturnValue('test-session');

    const errorHandler = mock(() => {});

    await createUserPromptSubmitHook({
      customContext: () => {
        throw new Error('Custom context failed');
      },
      onError: errorHandler
    });

    expect(errorHandler).toHaveBeenCalledTimes(1);
    expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);

    // Should still output session context even if custom context fails
    const output = JSON.parse(consoleOutput[0]);
    expect(output.hookSpecificOutput.additionalContext).toContain('test-session');
  });

  it('should join multiple context parts with newlines', async () => {
    const input = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'test-id',
      prompt: 'Test',
      cwd: '/test',
      timestamp: '2024-01-01T00:00:00Z'
    };

    mockStdin(JSON.stringify(input));
    spyOn(sessionNamer, 'getSessionName').mockReturnValue('test-session');

    await createUserPromptSubmitHook({
      customContext: () => 'Line 2\nLine 3'
    });

    const output = JSON.parse(consoleOutput[0]);
    const context = output.hookSpecificOutput.additionalContext;
    const lines = context.split('\n');
    expect(lines.length).toBeGreaterThan(1);
  });

  it('should exit with code 0 on success', async () => {
    const input = {
      hook_event_name: 'UserPromptSubmit',
      session_id: 'test-id',
      prompt: 'Test',
      cwd: '/test',
      timestamp: '2024-01-01T00:00:00Z'
    };

    mockStdin(JSON.stringify(input));
    spyOn(sessionNamer, 'getSessionName').mockReturnValue('test-session');

    await createUserPromptSubmitHook();

    expect(process.exit).toHaveBeenCalledWith(0);
  });
});
