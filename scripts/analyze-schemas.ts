#!/usr/bin/env bun
/**
 * Schema Analysis Script
 * Analyzes actual hook events to discover schema changes
 */

import { readFileSync } from 'fs';
import { join } from 'path';

interface EventLog {
  input: {
    hook: Record<string, any>;
    context: Record<string, any>;
  };
}

const logPath = process.env.CLAUDE_PROJECT_DIR
  ? join(process.env.CLAUDE_PROJECT_DIR, '.claude/hooks/event-logger/logs/events.jsonl')
  : join(process.cwd(), '.claude/hooks/event-logger/logs/events.jsonl');

console.log(`📊 Analyzing events from: ${logPath}\n`);

// Read all events
const lines = readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
const events: EventLog[] = lines.map(line => JSON.parse(line));

// Group by event type
const eventsByType = new Map<string, EventLog[]>();
for (const event of events) {
  const type = event.input.hook.hook_event_name;
  if (!eventsByType.has(type)) {
    eventsByType.set(type, []);
  }
  eventsByType.get(type)!.push(event);
}

// Extract schemas
console.log('='.repeat(80));
console.log('DISCOVERED SCHEMAS');
console.log('='.repeat(80));

for (const [eventType, eventList] of eventsByType.entries()) {
  console.log(`\n### ${eventType} (${eventList.length} events)`);

  // Collect all keys across all events of this type
  const allKeys = new Set<string>();
  const keyExamples = new Map<string, any>();

  for (const event of eventList) {
    for (const [key, value] of Object.entries(event.input.hook)) {
      allKeys.add(key);
      if (!keyExamples.has(key)) {
        keyExamples.set(key, value);
      }
    }
  }

  // Sort keys
  const sortedKeys = Array.from(allKeys).sort();

  // Print schema
  console.log('```typescript');
  console.log(`interface ${eventType}Input {`);
  for (const key of sortedKeys) {
    const example = keyExamples.get(key);
    const type = getTypeFromValue(example);
    console.log(`  ${key}: ${type};`);
  }
  console.log('}');
  console.log('```');

  // Show example
  console.log('\nExample values:');
  for (const key of sortedKeys) {
    const example = keyExamples.get(key);
    const displayValue = typeof example === 'object'
      ? JSON.stringify(example).slice(0, 60) + '...'
      : example;
    console.log(`  ${key}: ${displayValue}`);
  }
}

// Compare with documented schemas
console.log('\n\n' + '='.repeat(80));
console.log('UNDOCUMENTED PROPERTIES DETECTION');
console.log('='.repeat(80));

// Define what we expect from docs (baseline)
const documentedSchemas: Record<string, Set<string>> = {
  PreToolUse: new Set(['hook_event_name', 'session_id', 'cwd', 'transcript_path', 'tool_name', 'tool_input', 'tool_use_id']),
  PostToolUse: new Set(['hook_event_name', 'session_id', 'cwd', 'transcript_path', 'tool_name', 'tool_output', 'tool_use_id']),
  SessionStart: new Set(['hook_event_name', 'session_id', 'cwd', 'transcript_path']),
  SessionEnd: new Set(['hook_event_name', 'session_id', 'cwd', 'transcript_path', 'reason']),
  UserPromptSubmit: new Set(['hook_event_name', 'session_id', 'cwd', 'transcript_path', 'user_input']),
  Stop: new Set(['hook_event_name', 'session_id', 'cwd', 'transcript_path', 'reason']),
  SubagentStop: new Set(['hook_event_name', 'session_id', 'cwd', 'transcript_path', 'agent_name']),
};

for (const [eventType, eventList] of eventsByType.entries()) {
  const actualKeys = new Set<string>();
  for (const event of eventList) {
    for (const key of Object.keys(event.input.hook)) {
      actualKeys.add(key);
    }
  }

  const documented = documentedSchemas[eventType] || new Set();
  const newKeys = Array.from(actualKeys).filter(k => !documented.has(k));
  const missingKeys = Array.from(documented).filter(k => !actualKeys.has(k));

  if (newKeys.length > 0 || missingKeys.length > 0) {
    console.log(`\n### ${eventType}`);
    if (newKeys.length > 0) {
      console.log(`  ⚠️  NEW/UNDOCUMENTED: ${newKeys.join(', ')}`);
    }
    if (missingKeys.length > 0) {
      console.log(`  ❌ EXPECTED BUT MISSING: ${missingKeys.join(', ')}`);
    }
  }
}

// Helper function
function getTypeFromValue(value: any): string {
  if (value === null || value === undefined) {
    return 'any';
  }

  const type = typeof value;
  if (type === 'object') {
    if (Array.isArray(value)) {
      return 'any[]';
    }
    return 'Record<string, any>';
  }

  return type;
}

console.log('\n\n✅ Analysis complete!\n');
