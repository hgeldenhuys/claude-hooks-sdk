import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { PersistentState } from '../src/persistent-state';
import * as fs from 'fs';
import * as path from 'path';

const TEST_DIR = '/tmp/claude-hooks-sdk-test';
const TEST_DB = path.join(TEST_DIR, 'test.db');
const TEST_FILE = path.join(TEST_DIR, 'test.json');

describe('PersistentState', () => {
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

  describe('Memory backend', () => {
    test('should set and get values', async () => {
      const state = new PersistentState({ storage: 'memory' });

      await state.set('key1', 'value1');
      await state.set('key2', 42);
      await state.set('key3', { foo: 'bar' });

      expect(await state.get('key1')).toBe('value1');
      expect(await state.get<number>('key2')).toBe(42);
      expect(await state.get<{ foo: string }>('key3')).toEqual({ foo: 'bar' });
    });

    test('should delete values', async () => {
      const state = new PersistentState({ storage: 'memory' });

      await state.set('key1', 'value1');
      expect(await state.get('key1')).toBe('value1');

      await state.delete('key1');
      expect(await state.get('key1')).toBeNull();
    });

    test('should clear all values', async () => {
      const state = new PersistentState({ storage: 'memory' });

      await state.set('key1', 'value1');
      await state.set('key2', 'value2');

      await state.clear();

      expect(await state.get('key1')).toBeNull();
      expect(await state.get('key2')).toBeNull();
    });

    test('should list all keys', async () => {
      const state = new PersistentState({ storage: 'memory' });

      await state.set('key1', 'value1');
      await state.set('key2', 'value2');
      await state.set('key3', 'value3');

      const keys = await state.keys();
      expect(keys.sort()).toEqual(['key1', 'key2', 'key3']);
    });

    test('should support namespaced state', async () => {
      const state = new PersistentState({ storage: 'memory' });
      const sessionState = state.namespace('session-123');

      await state.set('global', 'value1');
      await sessionState.set('local', 'value2');

      expect(await state.get('global')).toBe('value1');
      expect(await state.get('local')).toBeNull();
      expect(await sessionState.get('local')).toBe('value2');
    });

    test('should increment values', async () => {
      const state = new PersistentState({ storage: 'memory' });

      expect(await state.increment('counter')).toBe(1);
      expect(await state.increment('counter')).toBe(2);
      expect(await state.increment('counter', 5)).toBe(7);
    });

    test('should decrement values', async () => {
      const state = new PersistentState({ storage: 'memory' });

      await state.set('counter', 10);
      expect(await state.decrement('counter')).toBe(9);
      expect(await state.decrement('counter', 3)).toBe(6);
    });

    test('should append to arrays', async () => {
      const state = new PersistentState({ storage: 'memory' });

      await state.append('errors', { message: 'Error 1' });
      await state.append('errors', { message: 'Error 2' });

      const errors = await state.get<Array<{ message: string }>>('errors');
      expect(errors).toHaveLength(2);
      expect(errors![0].message).toBe('Error 1');
      expect(errors![1].message).toBe('Error 2');
    });

    test('should prepend to arrays', async () => {
      const state = new PersistentState({ storage: 'memory' });

      await state.prepend('items', 'first');
      await state.prepend('items', 'second');

      const items = await state.get<string[]>('items');
      expect(items).toEqual(['second', 'first']);
    });

    test('should check if key exists', async () => {
      const state = new PersistentState({ storage: 'memory' });

      expect(await state.has('key1')).toBe(false);
      await state.set('key1', 'value1');
      expect(await state.has('key1')).toBe(true);
    });

    test('should get size', async () => {
      const state = new PersistentState({ storage: 'memory' });

      expect(await state.size()).toBe(0);
      await state.set('key1', 'value1');
      await state.set('key2', 'value2');
      expect(await state.size()).toBe(2);
    });
  });

  describe('SQLite backend', () => {
    test('should persist data across instances', async () => {
      const state1 = new PersistentState({ storage: 'sqlite', path: TEST_DB });
      await state1.set('key1', 'value1');
      state1.close();

      const state2 = new PersistentState({ storage: 'sqlite', path: TEST_DB });
      expect(await state2.get('key1')).toBe('value1');
      state2.close();
    });

    test('should support all operations', async () => {
      const state = new PersistentState({ storage: 'sqlite', path: TEST_DB });

      // Set/Get
      await state.set('key1', { foo: 'bar' });
      expect(await state.get<{ foo: string }>('key1')).toEqual({ foo: 'bar' });

      // Increment
      expect(await state.increment('counter')).toBe(1);
      expect(await state.increment('counter', 5)).toBe(6);

      // Append
      await state.append('logs', 'log1');
      await state.append('logs', 'log2');
      expect(await state.get<string[]>('logs')).toEqual(['log1', 'log2']);

      // Keys
      const keys = await state.keys();
      expect(keys.sort()).toEqual(['counter', 'key1', 'logs']);

      // Delete
      await state.delete('key1');
      expect(await state.get('key1')).toBeNull();

      state.close();
    });

    test('should support namespaced state', async () => {
      const state = new PersistentState({ storage: 'sqlite', path: TEST_DB });
      const session1 = state.namespace('session-1');
      const session2 = state.namespace('session-2');

      await session1.set('count', 10);
      await session2.set('count', 20);

      expect(await session1.get('count')).toBe(10);
      expect(await session2.get('count')).toBe(20);

      // Clear only session-1
      await session1.clear();
      expect(await session1.get('count')).toBeNull();
      expect(await session2.get('count')).toBe(20);

      state.close();
    });
  });

  describe('File backend', () => {
    test('should persist data to file', async () => {
      const state1 = new PersistentState({ storage: 'file', path: TEST_FILE });
      await state1.set('key1', 'value1');
      await state1.set('key2', { nested: true });

      // Verify file exists and contains data
      expect(fs.existsSync(TEST_FILE)).toBe(true);
      const fileData = JSON.parse(fs.readFileSync(TEST_FILE, 'utf-8'));
      expect(fileData['key1'].value).toBe('value1');

      const state2 = new PersistentState({ storage: 'file', path: TEST_FILE });
      expect(await state2.get('key1')).toBe('value1');
      expect(await state2.get<{ nested: boolean }>('key2')).toEqual({ nested: true });
    });

    test('should support all operations', async () => {
      const state = new PersistentState({ storage: 'file', path: TEST_FILE });

      await state.set('key1', 'value1');
      expect(await state.increment('counter')).toBe(1);
      await state.append('items', 'item1');
      await state.append('items', 'item2');

      const keys = await state.keys();
      expect(keys.sort()).toEqual(['counter', 'items', 'key1']);

      await state.delete('key1');
      expect(await state.get('key1')).toBeNull();
    });
  });
});
