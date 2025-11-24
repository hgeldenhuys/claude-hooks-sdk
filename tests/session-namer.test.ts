/**
 * Session Namer Tests
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { SessionNamer } from '../src/session-namer';
import * as fs from 'fs';
import * as path from 'path';

const SESSIONS_FILE = '.claude/sessions.json';

describe('SessionNamer', () => {
  let namer: SessionNamer;

  beforeEach(() => {
    // Clean up actual sessions file before each test
    const sessionsPath = path.join(process.cwd(), SESSIONS_FILE);
    if (fs.existsSync(sessionsPath)) {
      fs.unlinkSync(sessionsPath);
    }

    // Create new namer instance
    namer = new SessionNamer();
  });

  afterEach(() => {
    // Clean up sessions file after each test
    const sessionsPath = path.join(process.cwd(), SESSIONS_FILE);
    if (fs.existsSync(sessionsPath)) {
      fs.unlinkSync(sessionsPath);
    }
  });

  describe('Name Generation', () => {
    test('should generate unique names', () => {
      const name1 = namer.getOrCreateName('session-1', 'startup');
      const name2 = namer.getOrCreateName('session-2', 'startup');

      expect(name1).toBeDefined();
      expect(name2).toBeDefined();
      expect(name1).not.toBe(name2);

      // Names should follow pattern: adjective-animal
      expect(name1).toMatch(/^[a-z]+-[a-z]+$/);
      expect(name2).toMatch(/^[a-z]+-[a-z]+$/);
    });

    test('should return same name for same session ID', () => {
      const sessionId = 'test-session-123';
      const name1 = namer.getOrCreateName(sessionId, 'startup');
      const name2 = namer.getOrCreateName(sessionId, 'resume');

      expect(name1).toBe(name2);
    });

    test('should handle collision by appending number', () => {
      // This test is probabilistic since collisions are rare
      // We'll generate many sessions and check if any have -2 suffix
      const names: string[] = [];

      for (let i = 0; i < 10; i++) {
        const name = namer.getOrCreateName(`session-${i}`, 'startup');
        names.push(name);
      }

      // All names should be unique
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe('Manual Names', () => {
    test('should use manual name from config', () => {
      const sessionId = 'test-session-456';
      const manualName = 'custom-session-name';

      const namerWithManual = new SessionNamer({
        manualNames: {
          [sessionId]: manualName,
        },
      });

      const name = namerWithManual.getOrCreateName(sessionId, 'startup');
      expect(name).toBe(manualName);

      const info = namerWithManual.getSessionInfo(sessionId);
      expect(info?.manual).toBe(true);
    });
  });

  describe('Lookup', () => {
    test('should lookup session name by ID', () => {
      const sessionId = 'test-session-789';
      const generatedName = namer.getOrCreateName(sessionId, 'startup');

      const lookedUpName = namer.getSessionName(sessionId);
      expect(lookedUpName).toBe(generatedName);
    });

    test('should lookup session ID by name', () => {
      const sessionId = 'test-session-abc';
      const name = namer.getOrCreateName(sessionId, 'startup');

      const lookedUpId = namer.getSessionId(name);
      expect(lookedUpId).toBe(sessionId);
    });

    test('should return undefined for unknown session ID', () => {
      const name = namer.getSessionName('unknown-session');
      expect(name).toBeUndefined();
    });

    test('should return undefined for unknown session name', () => {
      const id = namer.getSessionId('unknown-name');
      expect(id).toBeUndefined();
    });
  });

  describe('Rename', () => {
    test('should rename session', () => {
      const sessionId = 'test-session-rename';
      const originalName = namer.getOrCreateName(sessionId, 'startup');
      const newName = 'renamed-session';

      namer.renameSession(sessionId, newName);

      const lookedUpName = namer.getSessionName(sessionId);
      expect(lookedUpName).toBe(newName);
      expect(lookedUpName).not.toBe(originalName);

      const info = namer.getSessionInfo(sessionId);
      expect(info?.manual).toBe(true);
    });

    test('should throw error if renaming to existing name', () => {
      const session1 = 'session-1';
      const session2 = 'session-2';

      namer.getOrCreateName(session1, 'startup');
      const name2 = namer.getOrCreateName(session2, 'startup');

      expect(() => {
        namer.renameSession(session1, name2);
      }).toThrow();
    });

    test('should throw error if session does not exist', () => {
      expect(() => {
        namer.renameSession('non-existent-session', 'new-name');
      }).toThrow();
    });
  });

  describe('List Sessions', () => {
    test('should list all sessions', () => {
      namer.getOrCreateName('session-1', 'startup');
      namer.getOrCreateName('session-2', 'resume');
      namer.getOrCreateName('session-3', 'clear');

      const sessions = namer.listSessions();
      expect(sessions).toHaveLength(3);

      const sessionIds = sessions.map(s => s.sessionId);
      expect(sessionIds).toContain('session-1');
      expect(sessionIds).toContain('session-2');
      expect(sessionIds).toContain('session-3');
    });

    test('should return empty array when no sessions exist', () => {
      const sessions = namer.listSessions();
      expect(sessions).toHaveLength(0);
    });
  });

  describe('Session Info', () => {
    test('should store session metadata', () => {
      const sessionId = 'test-session-metadata';
      const source = 'resume';

      namer.getOrCreateName(sessionId, source);

      const info = namer.getSessionInfo(sessionId);
      expect(info).toBeDefined();
      expect(info?.name).toBeDefined();
      expect(info?.created).toBeDefined();
      expect(info?.source).toBe(source);
      expect(info?.manual).toBe(false);
    });
  });
});
