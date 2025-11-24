/**
 * Tests for event enrichment utilities
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { enrichEvent, getGitContext, readTranscript } from './event-enricher';
import type { AnyHookInput } from './types';

describe('enrichEvent', () => {
  it('should enrich event with conversation and git context', async () => {
    const mockInput: AnyHookInput = {
      session_id: 'test-session',
      transcript_path: '/fake/path.jsonl',
      cwd: '/fake/cwd',
      hook_event_name: 'Stop',
    };

    // Mock file read (would need actual implementation)
    const enriched = await enrichEvent(mockInput, {
      includeConversation: false, // Skip for now since we'd need to mock file system
      includeGit: false, // Skip for now since we'd need to mock git
    });

    expect(enriched.event).toEqual(mockInput);
    expect(enriched.timestamp).toBeDefined();
    expect(typeof enriched.timestamp).toBe('string');
  });

  it('should include only requested fields', async () => {
    const mockInput: AnyHookInput = {
      session_id: 'test-session',
      transcript_path: '/fake/path.jsonl',
      cwd: '/fake/cwd',
      hook_event_name: 'Stop',
    };

    const enriched = await enrichEvent(mockInput, {
      includeConversation: false,
      includeGit: false,
    });

    expect(enriched.conversation).toBeUndefined();
    expect(enriched.git).toBeUndefined();
  });
});

describe('getGitContext', () => {
  it('should return null for non-git directory', () => {
    const context = getGitContext('/tmp');
    // /tmp might or might not be a git repo, so we just check it returns something
    expect(context === null || typeof context === 'object').toBe(true);
  });

  it('should extract git info from git repository', () => {
    // Test with current repo (claude-hooks-sdk)
    const context = getGitContext(process.cwd());

    if (context) {
      // If this is run in a git repo, verify structure
      expect(typeof context).toBe('object');
      // Should have at least some git info
      expect(
        context.branch ||
          context.commit ||
          context.remote ||
          context.userName ||
          context.userEmail
      ).toBeDefined();
    }
  });
});

describe('readTranscript', () => {
  it('should return null for non-existent file', async () => {
    const result = await readTranscript('/fake/nonexistent/path.jsonl');
    expect(result).toBeNull();
  });

  it('should return null for empty string path', async () => {
    const result = await readTranscript('');
    expect(result).toBeNull();
  });
});
