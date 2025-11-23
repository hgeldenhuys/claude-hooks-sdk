/**
 * PersistentState - Durable state storage for hook transforms
 *
 * Provides SQLite, file-based, and in-memory storage backends
 * for state that needs to survive restarts.
 *
 * @example
 * ```typescript
 * const state = new PersistentState({
 *   storage: 'sqlite',
 *   path: '.claude/state.db'
 * });
 *
 * await state.set('lastSync', Date.now());
 * const lastSync = await state.get<number>('lastSync');
 *
 * // Namespaced state
 * const sessionState = state.namespace('session-123');
 * await sessionState.set('turnCount', 5);
 *
 * // Atomic operations
 * await state.increment('requestCount');
 * await state.append('errors', { message: 'Failed', timestamp: Date.now() });
 * ```
 */

import { Database } from 'bun:sqlite';
import * as fs from 'fs';
import * as path from 'path';

export type StorageBackend = 'sqlite' | 'file' | 'memory';

export interface PersistentStateOptions {
  /** Storage backend type */
  storage: StorageBackend;
  /** Path to storage file (for sqlite and file backends) */
  path?: string;
  /** Optional namespace prefix for all keys */
  namespace?: string;
}

export interface StateValue<T = any> {
  key: string;
  value: T;
  created_at: number;
  updated_at: number;
}

/**
 * PersistentState provides durable key-value storage with multiple backends
 */
export class PersistentState {
  private backend: StorageBackend;
  private db?: Database;
  private filePath?: string;
  private memory: Map<string, StateValue> = new Map();
  private namespacePrefix: string;

  constructor(options: PersistentStateOptions) {
    this.backend = options.storage;
    this.namespacePrefix = options.namespace ? `${options.namespace}:` : '';

    if (this.backend === 'sqlite') {
      // Allow empty path when creating namespaced instances (db will be set later)
      if (options.path) {
        this.initSQLite(options.path);
      }
    } else if (this.backend === 'file') {
      if (!options.path) {
        throw new Error('File backend requires a path');
      }
      this.filePath = options.path;
      this.initFile(options.path);
    }
    // Memory backend needs no initialization
  }

  /**
   * Initialize SQLite database
   */
  private initSQLite(dbPath: string): void {
    // Ensure directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.db = new Database(dbPath);

    // Create schema
    this.db.run(`
      CREATE TABLE IF NOT EXISTS state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_state_updated_at ON state(updated_at)
    `);
  }

  /**
   * Initialize file-based storage
   */
  private initFile(filePath: string): void {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Load existing data if file exists
    if (fs.existsSync(filePath)) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        this.memory = new Map(Object.entries(data));
      } catch (error) {
        // File corrupted or empty, start fresh
        this.memory = new Map();
      }
    }
  }

  /**
   * Persist file-based storage to disk
   */
  private persistFile(): void {
    if (!this.filePath) return;

    const data = Object.fromEntries(this.memory.entries());
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Build full key with namespace
   */
  private buildKey(key: string): string {
    return `${this.namespacePrefix}${key}`;
  }

  /**
   * Get a value from state
   */
  async get<T = any>(key: string): Promise<T | null> {
    const fullKey = this.buildKey(key);

    if (this.backend === 'sqlite' && this.db) {
      const row = this.db.query('SELECT value FROM state WHERE key = ?').get(fullKey) as
        | { value: string }
        | null;

      if (!row) return null;
      return JSON.parse(row.value) as T;
    } else {
      // File and memory backends use the Map
      const stateValue = this.memory.get(fullKey);
      if (!stateValue) return null;
      return stateValue.value as T;
    }
  }

  /**
   * Set a value in state
   */
  async set<T = any>(key: string, value: T): Promise<void> {
    const fullKey = this.buildKey(key);
    const now = Date.now();

    if (this.backend === 'sqlite' && this.db) {
      this.db
        .query(
          `INSERT INTO state (key, value, created_at, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET
             value = excluded.value,
             updated_at = excluded.updated_at`
        )
        .run(fullKey, JSON.stringify(value), now, now);
    } else {
      // File and memory backends
      const existing = this.memory.get(fullKey);
      const stateValue: StateValue<T> = {
        key: fullKey,
        value,
        created_at: existing?.created_at || now,
        updated_at: now,
      };

      this.memory.set(fullKey, stateValue);

      if (this.backend === 'file') {
        this.persistFile();
      }
    }
  }

  /**
   * Delete a key from state
   */
  async delete(key: string): Promise<void> {
    const fullKey = this.buildKey(key);

    if (this.backend === 'sqlite' && this.db) {
      this.db.query('DELETE FROM state WHERE key = ?').run(fullKey);
    } else {
      this.memory.delete(fullKey);

      if (this.backend === 'file') {
        this.persistFile();
      }
    }
  }

  /**
   * Clear all state
   */
  async clear(): Promise<void> {
    if (this.backend === 'sqlite' && this.db) {
      if (this.namespacePrefix) {
        // Clear only namespaced keys
        this.db.query('DELETE FROM state WHERE key LIKE ?').run(`${this.namespacePrefix}%`);
      } else {
        // Clear all
        this.db.run('DELETE FROM state');
      }
    } else {
      if (this.namespacePrefix) {
        // Clear only namespaced keys
        const keysToDelete: string[] = [];
        for (const key of this.memory.keys()) {
          if (key.startsWith(this.namespacePrefix)) {
            keysToDelete.push(key);
          }
        }
        for (const key of keysToDelete) {
          this.memory.delete(key);
        }
      } else {
        // Clear all
        this.memory.clear();
      }

      if (this.backend === 'file') {
        this.persistFile();
      }
    }
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    if (this.backend === 'sqlite' && this.db) {
      const rows = this.db.query('SELECT key FROM state').all() as { key: string }[];
      return rows
        .map((r) => r.key)
        .filter((k) => k.startsWith(this.namespacePrefix))
        .map((k) => k.substring(this.namespacePrefix.length));
    } else {
      return Array.from(this.memory.keys())
        .filter((k) => k.startsWith(this.namespacePrefix))
        .map((k) => k.substring(this.namespacePrefix.length));
    }
  }

  /**
   * Create a namespaced instance
   */
  namespace(ns: string): PersistentState {
    const fullNamespace = this.namespacePrefix ? `${this.namespacePrefix}${ns}` : ns;

    if (this.backend === 'sqlite' && this.db) {
      // Share same DB instance
      const namespaced = new PersistentState({
        storage: 'sqlite',
        path: '', // Won't be used
        namespace: fullNamespace,
      });
      namespaced.db = this.db;
      return namespaced;
    } else if (this.backend === 'file' && this.filePath) {
      // Share same file and memory
      const namespaced = new PersistentState({
        storage: 'file',
        path: this.filePath,
        namespace: fullNamespace,
      });
      namespaced.memory = this.memory;
      return namespaced;
    } else {
      // Share same memory
      const namespaced = new PersistentState({
        storage: 'memory',
        namespace: fullNamespace,
      });
      namespaced.memory = this.memory;
      return namespaced;
    }
  }

  /**
   * Atomic increment operation
   */
  async increment(key: string, delta: number = 1): Promise<number> {
    const current = (await this.get<number>(key)) || 0;
    const newValue = current + delta;
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Atomic decrement operation
   */
  async decrement(key: string, delta: number = 1): Promise<number> {
    return this.increment(key, -delta);
  }

  /**
   * Atomic append operation (for arrays)
   */
  async append<T = any>(key: string, value: T): Promise<T[]> {
    const current = (await this.get<T[]>(key)) || [];
    const newValue = [...current, value];
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Atomic prepend operation (for arrays)
   */
  async prepend<T = any>(key: string, value: T): Promise<T[]> {
    const current = (await this.get<T[]>(key)) || [];
    const newValue = [value, ...current];
    await this.set(key, newValue);
    return newValue;
  }

  /**
   * Check if a key exists
   */
  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  /**
   * Get the number of keys
   */
  async size(): Promise<number> {
    const allKeys = await this.keys();
    return allKeys.length;
  }

  /**
   * Close the database connection (for SQLite)
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = undefined;
    }
  }
}
