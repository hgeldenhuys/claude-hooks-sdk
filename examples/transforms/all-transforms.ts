#!/usr/bin/env bun
/**
 * All Transforms Combined Example
 *
 * This example demonstrates using all transform utilities together
 * to create comprehensive session logging with conversation tracking,
 * file changes, todo progress, and AI summaries.
 *
 * This is a production-ready pattern for backend services that need
 * rich observability into Claude Code sessions.
 *
 * Requirements:
 *   - Set ANTHROPIC_API_KEY environment variable (optional, for summaries)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... bun packages/hooks-sdk/examples/transforms/all-transforms.ts
 */

import {
  HookManager,
  success,
  ConversationLogger,
  FileChangeTracker,
  TodoTracker,
  AISummarizer,
  type PreToolUseInput,
  type PostToolUseInput,
  type UserPromptSubmitInput,
  type StopInput,
  type HookContext,
} from '../../src';

// Initialize all trackers
const conversationLogger = new ConversationLogger();
const fileTracker = new FileChangeTracker();
const todoTracker = new TodoTracker();

// Initialize AI summarizer (optional)
const summarizer = process.env.ANTHROPIC_API_KEY
  ? new AISummarizer({
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-haiku-3-5-20241022',
    })
  : null;

// Create hook manager
const manager = new HookManager({
  debugHooks: false, // Disable default logging for cleaner output
});

// Track user prompts for conversation logger
manager.onUserPromptSubmit((input: UserPromptSubmitInput) => {
  conversationLogger.recordUserPrompt(input);
  return success();
});

// Track tool uses for conversation logger
manager.onPreToolUse((input: PreToolUseInput) => {
  conversationLogger.recordToolUse(input.tool_name);
  return success();
});

// Track file changes and todos on PostToolUse
manager.onPostToolUse((input: PostToolUseInput) => {
  // Track file changes
  const fileChange = fileTracker.recordChange(input);
  if (fileChange) {
    console.log('📄 FILE:', fileChange.file, `(${fileChange.operation})`);
  }

  // Track todos
  const todoEvent = todoTracker.recordTodoWrite(input);
  if (todoEvent) {
    console.log('✅ TODOS:', {
      event: todoEvent.event_type,
      total: todoEvent.todos.length,
      completed: todoEvent.completed,
      in_progress: todoEvent.in_progress,
      pending: todoEvent.pending,
    });
  }

  return success();
});

// Comprehensive Stop event logging
manager.onStop(async (input: StopInput, context: HookContext) => {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🛑 STOP EVENT - Turn ${conversationLogger.getTurnNumber() + 1}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Conversation turn
  const turn = await conversationLogger.recordStop(input, context);
  console.log('💬 CONVERSATION:');
  console.log(
    `   User prompts: ${turn.user_prompts.length}, Tools used: ${turn.assistant.toolsUsed.length}`
  );
  if (turn.assistant.toolsUsed.length > 0) {
    console.log(`   Tools: ${turn.assistant.toolsUsed.join(', ')}`);
  }

  // 2. File changes batch
  const fileBatch = fileTracker.getBatch(input.session_id);
  if (fileBatch.total_files > 0) {
    console.log('\n📁 FILES MODIFIED:');
    const uniqueFiles = fileTracker.getUniqueFiles(input.session_id);
    uniqueFiles.forEach((file) => {
      const count = fileTracker.getFileModificationCount(input.session_id, file);
      console.log(`   ${file} (${count}x)`);
    });
  }

  // 3. Todo snapshot
  const todoSnapshot = todoTracker.getSnapshot(input.session_id);
  if (todoSnapshot) {
    const completionPct = todoTracker.getCompletionPercentage(input.session_id);
    console.log('\n✅ TODO PROGRESS:');
    console.log(`   ${completionPct}% complete (${todoSnapshot.completed}/${todoSnapshot.total})`);
    console.log(
      `   Status: ${todoSnapshot.in_progress} in progress, ${todoSnapshot.pending} pending`
    );

    const inProgress = todoTracker.getTodosByStatus(input.session_id, 'in_progress');
    if (inProgress.length > 0) {
      console.log(`   Current: "${inProgress[0].content}"`);
    }
  }

  // 4. AI summary (if enabled)
  if (summarizer) {
    const summary = await summarizer.summarizeStop(input, context);
    if (summary) {
      console.log('\n🤖 AI SUMMARY:');
      console.log(`   "${summary.summary}"`);
      console.log(`   (${summary.input_tokens}→${summary.output_tokens} tokens)`);
    }
  }

  // 5. Session metadata
  console.log('\n📊 METADATA:');
  console.log(`   Session: ${input.session_id}`);
  console.log(`   Turn: ${turn.turn_number}`);
  console.log(`   Timestamp: ${turn.assistant.timestamp}`);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return success();
});

// Run the manager
manager.run();
