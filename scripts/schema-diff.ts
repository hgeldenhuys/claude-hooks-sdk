#!/usr/bin/env bun
/**
 * Schema Diff Tool
 * Compares current event schemas against a baseline
 * Run this periodically to detect Claude Code schema changes
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const BASELINE_PATH = join(__dirname, '../schemas/baseline.json');
const logPath = process.env.CLAUDE_PROJECT_DIR
  ? join(process.env.CLAUDE_PROJECT_DIR, '.claude/hooks/event-logger/logs/events.jsonl')
  : join(process.cwd(), '.claude/hooks/event-logger/logs/events.jsonl');

// Extract current schemas
const lines = readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
const events = lines.map(line => JSON.parse(line));

const currentSchemas: Record<string, Set<string>> = {};
for (const event of events) {
  const type = event.input.hook.hook_event_name;
  if (!currentSchemas[type]) {
    currentSchemas[type] = new Set();
  }
  for (const key of Object.keys(event.input.hook)) {
    currentSchemas[type].add(key);
  }
}

// Convert Sets to Arrays for JSON serialization
const currentSchemasJSON: Record<string, string[]> = {};
for (const [type, keys] of Object.entries(currentSchemas)) {
  currentSchemasJSON[type] = Array.from(keys).sort();
}

// Load baseline if exists
if (!existsSync(BASELINE_PATH)) {
  console.log('📝 No baseline found, creating one...');
  writeFileSync(BASELINE_PATH, JSON.stringify(currentSchemasJSON, null, 2));
  console.log(`✅ Baseline saved to: ${BASELINE_PATH}`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf-8'));

// Compare
console.log('🔍 Comparing against baseline...\n');

let changesDetected = false;

for (const eventType of Object.keys(currentSchemasJSON)) {
  const current = new Set(currentSchemasJSON[eventType]);
  const base = new Set(baseline[eventType] || []);

  const added = Array.from(current).filter(k => !base.has(k));
  const removed = Array.from(base).filter(k => !current.has(k));

  if (added.length > 0 || removed.length > 0) {
    changesDetected = true;
    console.log(`### ${eventType}`);
    if (added.length > 0) {
      console.log(`  🆕 ADDED: ${added.join(', ')}`);
    }
    if (removed.length > 0) {
      console.log(`  ❌ REMOVED: ${removed.join(', ')}`);
    }
    console.log();
  }
}

// Check for new event types
for (const eventType of Object.keys(baseline)) {
  if (!currentSchemasJSON[eventType]) {
    changesDetected = true;
    console.log(`### ${eventType}`);
    console.log(`  ⚠️  EVENT TYPE NO LONGER SEEN`);
    console.log();
  }
}

if (!changesDetected) {
  console.log('✅ No schema changes detected!');
} else {
  console.log('🚨 Schema changes detected!');
  console.log('\nTo update baseline:');
  console.log(`  rm ${BASELINE_PATH}`);
  console.log('  bun scripts/schema-diff.ts');
}
