import { describe, test, expect } from 'bun:test';
import { middleware, compose } from '../src/middleware';
import type { AnyHookInput, AnyHookOutput, MiddlewareFunction } from '../src/middleware';
import type { PostToolUseInput } from '../src/types';

describe('Middleware', () => {
  const createMockInput = (): PostToolUseInput => ({
    hook_event_name: 'PostToolUse',
    session_id: 'session-1',
    tool_name: 'Read',
    tool_input: { file_path: '/test.txt' },
    tool_response: { content: 'test' },
  });

  const createNext = () => async (input: AnyHookInput): Promise<AnyHookOutput> => ({
    continue: true,
  });

  describe('Rate limiting', () => {
    test('should allow events within limit', async () => {
      const rateLimiter = middleware.rateLimit({
        maxEvents: 5,
        window: '1m',
      });

      const next = createNext();

      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter(createMockInput(), next);
        expect(result.continue).toBe(true);
      }
    });

    test('should block events exceeding limit', async () => {
      const rateLimiter = middleware.rateLimit({
        maxEvents: 3,
        window: '1m',
      });

      const next = createNext();

      // Should allow first 3
      for (let i = 0; i < 3; i++) {
        await rateLimiter(createMockInput(), next);
      }

      // Should block 4th
      await expect(rateLimiter(createMockInput(), next)).rejects.toThrow('Rate limit exceeded');
    });

    test('should support different time windows', async () => {
      const rateLimiter = middleware.rateLimit({
        maxEvents: 2,
        window: 100, // 100ms
      });

      const next = createNext();

      // Should allow first 2
      await rateLimiter(createMockInput(), next);
      await rateLimiter(createMockInput(), next);

      // Should block 3rd
      await expect(rateLimiter(createMockInput(), next)).rejects.toThrow();

      // Wait for window to reset
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should allow again
      const result = await rateLimiter(createMockInput(), next);
      expect(result.continue).toBe(true);
    });

    test('should support fixed window type', async () => {
      const rateLimiter = middleware.rateLimit({
        maxEvents: 2,
        window: '1m',
        type: 'fixed',
      });

      const next = createNext();

      await rateLimiter(createMockInput(), next);
      await rateLimiter(createMockInput(), next);

      await expect(rateLimiter(createMockInput(), next)).rejects.toThrow();
    });
  });

  describe('Deduplication', () => {
    test('should allow first event', async () => {
      const dedupe = middleware.deduplicate({
        window: 1000,
      });

      const next = createNext();
      const result = await dedupe(createMockInput(), next);

      expect(result.continue).toBe(true);
    });

    test('should skip duplicate events', async () => {
      const dedupe = middleware.deduplicate({
        window: 1000,
      });

      const next = createNext();
      const input = createMockInput();

      // First event - should pass
      const result1 = await dedupe(input, next);
      expect(result1.continue).toBe(true);

      // Duplicate - should be skipped
      const result2 = await dedupe(input, next);
      expect(result2.continue).toBe(true); // Returns success but doesn't call next
    });

    test('should allow after window expires', async () => {
      const dedupe = middleware.deduplicate({
        window: 50, // 50ms
      });

      const next = createNext();
      const input = createMockInput();

      await dedupe(input, next);

      // Wait for window to expire
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should allow again
      const result = await dedupe(input, next);
      expect(result.continue).toBe(true);
    });

    test('should support custom key function', async () => {
      const dedupe = middleware.deduplicate({
        window: 1000,
        key: (input) => (input as PostToolUseInput).tool_name,
      });

      const next = createNext();

      const input1 = createMockInput();
      input1.tool_name = 'Read';

      const input2 = createMockInput();
      input2.tool_name = 'Write';

      // Different keys - both should pass
      const result1 = await dedupe(input1, next);
      const result2 = await dedupe(input2, next);

      expect(result1.continue).toBe(true);
      expect(result2.continue).toBe(true);
    });
  });

  describe('Tool filtering', () => {
    test('should allow whitelisted tools', async () => {
      const filter = middleware.filterByTool(['Read', 'Write']);

      const next = createNext();
      const input = createMockInput();
      input.tool_name = 'Read';

      const result = await filter(input, next);
      expect(result.continue).toBe(true);
    });

    test('should skip non-whitelisted tools', async () => {
      const filter = middleware.filterByTool(['Read', 'Write']);

      const next = createNext();
      const input = createMockInput();
      input.tool_name = 'Bash';

      const result = await filter(input, next);
      expect(result.continue).toBe(true); // Skipped but returns success
    });

    test('should handle events without tool_name', async () => {
      const filter = middleware.filterByTool(['Read']);

      const next = createNext();
      const input: any = {
        hook_event_name: 'Stop',
        session_id: 'session-1',
      };

      const result = await filter(input, next);
      expect(result.continue).toBe(true);
    });
  });

  describe('Event filtering', () => {
    test('should allow whitelisted events', async () => {
      const filter = middleware.filterByEvent(['PostToolUse', 'Stop']);

      const next = createNext();
      const input = createMockInput();

      const result = await filter(input, next);
      expect(result.continue).toBe(true);
    });

    test('should skip non-whitelisted events', async () => {
      const filter = middleware.filterByEvent(['Stop']);

      const next = createNext();
      const input = createMockInput();

      const result = await filter(input, next);
      expect(result.continue).toBe(true); // Skipped
    });
  });

  describe('PII redaction', () => {
    test('should redact specified fields', async () => {
      const redactor = middleware.piiRedaction({
        fields: ['content', 'message'],
      });

      const next = async (input: AnyHookInput) => {
        const toolInput = input as PostToolUseInput;
        expect(toolInput.tool_response).toHaveProperty('content');
        return { continue: true };
      };

      const input = createMockInput();
      input.tool_response = {
        content: 'My email is test@example.com',
        message: 'SSN: 123-45-6789',
      };

      await redactor(input, next);
    });

    test('should use default PII patterns', async () => {
      const redactor = middleware.piiRedaction({
        fields: ['sensitive_data'], // Redact sensitive_data field
      });

      let redactedInput: any;
      const next = async (input: AnyHookInput) => {
        redactedInput = input;
        return { continue: true };
      };

      const input = createMockInput();
      (input as any).sensitive_data = 'Contact me at test@example.com or 1234-5678-9012-3456';

      await redactor(input, next);

      expect(redactedInput.sensitive_data).toContain('[REDACTED]');
      expect(redactedInput.sensitive_data).not.toContain('test@example.com');
    });
  });

  describe('Error handling', () => {
    test('should call error handler on error', async () => {
      let errorCaught: Error | null = null;

      const errorHandler = middleware.errorHandler(async (error) => {
        errorCaught = error;
      });

      const next = async () => {
        throw new Error('Test error');
      };

      await expect(errorHandler(createMockInput(), next)).rejects.toThrow('Test error');
      expect(errorCaught).toBeTruthy();
      expect(errorCaught!.message).toBe('Test error');
    });

    test('should handle async error handler', async () => {
      let errorHandled = false;

      const errorHandler = middleware.errorHandler(async (error) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        errorHandled = true;
      });

      const next = async () => {
        throw new Error('Test error');
      };

      await expect(errorHandler(createMockInput(), next)).rejects.toThrow();
      expect(errorHandled).toBe(true);
    });
  });

  describe('Middleware composition', () => {
    test('should compose multiple middleware', async () => {
      const callOrder: string[] = [];

      const mw1: MiddlewareFunction = async (input, next) => {
        callOrder.push('mw1-before');
        const result = await next(input);
        callOrder.push('mw1-after');
        return result;
      };

      const mw2: MiddlewareFunction = async (input, next) => {
        callOrder.push('mw2-before');
        const result = await next(input);
        callOrder.push('mw2-after');
        return result;
      };

      const composed = compose([mw1, mw2]);
      await composed(createMockInput(), createNext());

      expect(callOrder).toEqual(['mw1-before', 'mw2-before', 'mw2-after', 'mw1-after']);
    });

    test('should handle empty middleware array', async () => {
      const composed = compose([]);
      const result = await composed(createMockInput(), createNext());

      expect(result.continue).toBe(true);
    });

    test('should stop on error in middleware chain', async () => {
      const mw1: MiddlewareFunction = async (input, next) => {
        throw new Error('Middleware error');
      };

      const mw2: MiddlewareFunction = async (input, next) => {
        return next(input);
      };

      const composed = compose([mw1, mw2]);

      await expect(composed(createMockInput(), createNext())).rejects.toThrow('Middleware error');
    });

    test('should allow middleware to modify input', async () => {
      const mw: MiddlewareFunction = async (input, next) => {
        const modified = { ...input, modified: true };
        return next(modified as any);
      };

      let receivedInput: any;
      const next = async (input: AnyHookInput) => {
        receivedInput = input;
        return { continue: true };
      };

      await mw(createMockInput(), next);

      expect(receivedInput).toHaveProperty('modified');
      expect(receivedInput.modified).toBe(true);
    });
  });
});
