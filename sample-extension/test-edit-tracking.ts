#!/usr/bin/env bun
/**
 * Test: Edit Tracking Feature
 *
 * Simulates the lifecycle:
 * 1. UserPromptSubmit - Start tracking
 * 2. PostToolUse (Edit) - Track file #1
 * 3. PostToolUse (Edit) - Track file #2
 * 4. PostToolUse (Bash) - Ignore non-Edit tools
 * 5. PostToolUse (Edit) - Track file #3
 * 6. Stop - Attach tracked files to context
 */

import { HookManager, success } from '../src/index';
import { readFileSync } from 'fs';
import { join } from 'path';

const manager = new HookManager({
  trackEdits: true,
  debug: true,
  logEvents: true,
  clientId: 'test-edit-tracking',
  enableContextTracking: true
});

// Track Stop events to verify edited files
manager.onStop(async (input) => {
  console.log('\n=== Stop Event Received ===');
  const enrichedInput = input as any;
  console.log('Context:', JSON.stringify(enrichedInput.context, null, 2));
  return success();
});

// Simulate the lifecycle
async function simulate() {
  console.log('=== Simulating Edit Tracking Lifecycle ===\n');

  // 1. UserPromptSubmit
  console.log('1. UserPromptSubmit');
  await manager.execute({
    hook_event_name: 'UserPromptSubmit',
    session_id: 'test-session',
    cwd: '/tmp',
    transcript_path: '/tmp/test.jsonl',
    prompt: 'Edit some files',
    permission_mode: 'bypassPermissions'
  } as any);

  // 2. Edit file #1
  console.log('\n2. PostToolUse - Edit file1.ts');
  await manager.execute({
    hook_event_name: 'PostToolUse',
    session_id: 'test-session',
    cwd: '/tmp',
    transcript_path: '/tmp/test.jsonl',
    tool_name: 'Edit',
    tool_input: {
      file_path: '/project/src/file1.ts',
      old_string: 'old',
      new_string: 'new'
    },
    tool_response: { success: true },
    tool_use_id: 'edit-1',
    permission_mode: 'bypassPermissions'
  } as any);

  // 3. Edit file #2
  console.log('\n3. PostToolUse - Edit file2.ts');
  await manager.execute({
    hook_event_name: 'PostToolUse',
    session_id: 'test-session',
    cwd: '/tmp',
    transcript_path: '/tmp/test.jsonl',
    tool_name: 'Edit',
    tool_input: {
      file_path: '/project/src/components/file2.ts',
      old_string: 'old',
      new_string: 'new'
    },
    tool_response: { success: true },
    tool_use_id: 'edit-2',
    permission_mode: 'bypassPermissions'
  } as any);

  // 4. Bash command (should be ignored)
  console.log('\n4. PostToolUse - Bash (should be ignored)');
  await manager.execute({
    hook_event_name: 'PostToolUse',
    session_id: 'test-session',
    cwd: '/tmp',
    transcript_path: '/tmp/test.jsonl',
    tool_name: 'Bash',
    tool_input: {
      command: 'ls -la'
    },
    tool_response: { stdout: 'files...' },
    tool_use_id: 'bash-1',
    permission_mode: 'bypassPermissions'
  } as any);

  // 5. Edit file #3 (duplicate of file1 - should still be tracked once)
  console.log('\n5. PostToolUse - Edit file1.ts again');
  await manager.execute({
    hook_event_name: 'PostToolUse',
    session_id: 'test-session',
    cwd: '/tmp',
    transcript_path: '/tmp/test.jsonl',
    tool_name: 'Edit',
    tool_input: {
      file_path: '/project/src/file1.ts',  // Same as #1
      old_string: 'another',
      new_string: 'change'
    },
    tool_response: { success: true },
    tool_use_id: 'edit-3',
    permission_mode: 'bypassPermissions'
  } as any);

  // 6. Stop event - should have edited files in context
  console.log('\n6. Stop Event');
  await manager.execute({
    hook_event_name: 'Stop',
    session_id: 'test-session',
    cwd: '/tmp',
    transcript_path: '/tmp/test.jsonl',
    permission_mode: 'bypassPermissions',
    stop_hook_active: false
  } as any);

  // Verify the logged event
  console.log('\n=== Checking Logged Stop Event ===');
  const logPath = join(
    process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    '.claude/hooks/test-edit-tracking/logs/events.jsonl'
  );

  try {
    const logs = readFileSync(logPath, 'utf-8').split('\n').filter(Boolean);
    const stopEvent = logs
      .map(line => JSON.parse(line))
      .find(event => event.input.hook.hook_event_name === 'Stop');

    if (stopEvent) {
      console.log('\nStop Event Context:');
      console.log(JSON.stringify(stopEvent.input.context, null, 2));

      const editedFiles = stopEvent.input.context.editedFiles;
      if (editedFiles) {
        console.log(`\n✅ Success! Tracked ${editedFiles.length} unique edited files:`);
        editedFiles.forEach((file: string, i: number) => {
          console.log(`   ${i + 1}. ${file}`);
        });
      } else {
        console.log('\n❌ ERROR: No edited files in context!');
      }
    } else {
      console.log('\n❌ ERROR: No Stop event found in logs!');
    }
  } catch (error) {
    console.error('\n❌ ERROR reading logs:', error);
  }
}

// Run simulation
simulate().catch(console.error);
