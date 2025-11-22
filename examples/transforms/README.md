# Hook Transform Examples

This directory contains practical examples of using transform utilities to create useful logging and analytics patterns for Claude Code hooks.

## Available Examples

### 1. Conversation Logger (`conversation-logger.ts`)

Logs hook events in a conversation format, tracking user prompts between Stop events and creating chat-like turns.

**Output:**
```json
{
  "assistant": {
    "content": "I'll help you with that...",
    "timestamp": "2025-11-21T23:00:00.000Z",
    "toolsUsed": ["Read", "Edit"]
  },
  "user_prompts": [
    { "text": "Can you read the file?", "timestamp": "..." },
    { "text": "Now edit it", "timestamp": "..." }
  ],
  "turn_number": 3,
  "session_id": "abc123"
}
```

**Usage:**
```bash
bun packages/hooks-sdk/examples/transforms/conversation-logger.ts
```

### 2. File Changes Logger (`file-changes-logger.ts`)

Tracks file modifications from Write, Edit, and MultiEdit tools.

**Output:**
```json
{
  "file": "src/components/Button.tsx",
  "operation": "modified",
  "tool": "Edit",
  "timestamp": "2025-11-21T23:00:00.000Z",
  "session_id": "abc123",
  "size_hint": 1234
}
```

**Usage:**
```bash
bun packages/hooks-sdk/examples/transforms/file-changes-logger.ts
```

### 3. Todo Logger (`todo-logger.ts`)

Tracks todo items created and updated via TodoWrite tool.

**Output:**
```json
{
  "event_type": "todos_created",
  "todos": [
    { "content": "Implement feature X", "status": "in_progress" }
  ],
  "added": 2,
  "completed": 0,
  "in_progress": 1,
  "pending": 1,
  "timestamp": "2025-11-21T23:00:00.000Z",
  "session_id": "abc123"
}
```

**Usage:**
```bash
bun packages/hooks-sdk/examples/transforms/todo-logger.ts
```

### 4. AI Summarizer (`ai-summarizer.ts`)

Uses Claude Haiku to automatically summarize each Stop event.

**Output:**
```json
{
  "summary": "Read configuration files and updated database schema",
  "model": "claude-haiku-3-5-20241022",
  "input_tokens": 125,
  "output_tokens": 12,
  "timestamp": "2025-11-21T23:00:00.000Z",
  "session_id": "abc123",
  "turn_number": 3
}
```

**Requirements:**
- Set `ANTHROPIC_API_KEY` environment variable

**Usage:**
```bash
ANTHROPIC_API_KEY=sk-... bun packages/hooks-sdk/examples/transforms/ai-summarizer.ts
```

### 5. All Transforms Combined (`all-transforms.ts`)

Demonstrates using all transform utilities together for comprehensive session logging.

**Features:**
- Conversation tracking
- File change monitoring
- Todo progress tracking
- AI summaries (optional)

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛑 STOP EVENT - Turn 3
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💬 CONVERSATION:
   User prompts: 2, Tools used: 3
   Tools: Read, Edit, Bash

📁 FILES MODIFIED:
   src/components/Button.tsx (2x)
   src/utils/helpers.ts (1x)

✅ TODO PROGRESS:
   60% complete (3/5)
   Status: 1 in progress, 1 pending
   Current: "Implement feature X"

🤖 AI SUMMARY:
   "Read configuration files and updated database schema"
   (125→12 tokens)

📊 METADATA:
   Session: abc123
   Turn: 3
   Timestamp: 2025-11-21T23:00:00.000Z

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Usage:**
```bash
ANTHROPIC_API_KEY=sk-... bun packages/hooks-sdk/examples/transforms/all-transforms.ts
```

## Using in Production

These examples are production-ready and can be used as-is or customized for your needs.

### Integration with `.claude/hooks.ts`

```typescript
#!/usr/bin/env bun
import {
  HookManager,
  success,
  ConversationLogger,
  FileChangeTracker,
  TodoTracker,
} from 'claude-hooks-sdk';

const conversationLogger = new ConversationLogger();
const fileTracker = new FileChangeTracker();
const todoTracker = new TodoTracker();

const manager = new HookManager();

manager
  .onUserPromptSubmit((input) => {
    conversationLogger.recordUserPrompt(input);
    return success();
  })
  .onPreToolUse((input) => {
    conversationLogger.recordToolUse(input.tool_name);
    return success();
  })
  .onPostToolUse((input) => {
    fileTracker.recordChange(input);
    todoTracker.recordTodoWrite(input);
    return success();
  })
  .onStop(async (input, context) => {
    const turn = await conversationLogger.recordStop(input, context);
    const files = fileTracker.getBatch(input.session_id);
    const todos = todoTracker.getSnapshot(input.session_id);

    // Send to your backend/analytics service
    await sendToBackend({ turn, files, todos });

    return success();
  });

manager.run();
```

### Logging to Files

You can log to separate files for different transform types:

```typescript
import { appendFileSync } from 'fs';
import { join } from 'path';

manager.onStop(async (input, context) => {
  const turn = await conversationLogger.recordStop(input, context);

  // Log to conversation.jsonl
  appendFileSync(
    join(process.cwd(), '.agent/conversation.jsonl'),
    JSON.stringify(turn) + '\n'
  );

  return success();
});
```

### Sending to Backend API

```typescript
manager.onStop(async (input, context) => {
  const turn = await conversationLogger.recordStop(input, context);
  const files = fileTracker.getBatch(input.session_id);
  const todos = todoTracker.getSnapshot(input.session_id);

  await fetch('https://api.example.com/sessions/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'stop',
      conversation: turn,
      files,
      todos,
      timestamp: new Date().toISOString(),
    }),
  });

  return success();
});
```

## Transform Utilities API

### ConversationLogger

```typescript
import { ConversationLogger } from 'claude-hooks-sdk';

const logger = new ConversationLogger();

// Record user prompt
logger.recordUserPrompt(input);

// Record tool use
logger.recordToolUse(toolName);

// Record Stop and get conversation turn
const turn = await logger.recordStop(input, context);

// Get current turn number
logger.getTurnNumber(); // 3

// Reset state
logger.reset();
```

### FileChangeTracker

```typescript
import { FileChangeTracker } from 'claude-hooks-sdk';

const tracker = new FileChangeTracker();

// Record file change
const change = tracker.recordChange(input);

// Get batch of changes
const batch = tracker.getBatch(sessionId);

// Get unique files modified
const files = tracker.getUniqueFiles(sessionId);

// Get modification count for a file
const count = tracker.getFileModificationCount(sessionId, filePath);

// Clear session
tracker.clearSession(sessionId);
```

### TodoTracker

```typescript
import { TodoTracker } from 'claude-hooks-sdk';

const tracker = new TodoTracker();

// Record TodoWrite
const event = tracker.recordTodoWrite(input);

// Get snapshot
const snapshot = tracker.getSnapshot(sessionId);

// Get todos by status
const inProgress = tracker.getTodosByStatus(sessionId, 'in_progress');

// Get completion percentage
const pct = tracker.getCompletionPercentage(sessionId); // 60

// Clear session
tracker.clearSession(sessionId);
```

### AISummarizer

```typescript
import { AISummarizer } from 'claude-hooks-sdk';

const summarizer = new AISummarizer({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  model: 'claude-haiku-3-5-20241022',
});

// Summarize Stop event
const summary = await summarizer.summarizeStop(input, context);

// Summarize with custom prompt
const summary = await summarizer.summarizeWithPrompt(
  content,
  'Summarize this in 1 sentence: {content}',
  sessionId
);

// Get turn number
summarizer.getTurnNumber(); // 3

// Reset turn counter
summarizer.reset();
```

## Testing

To test an example with your `.claude/hooks.ts`:

1. Copy the example code to your `.claude/hooks.ts` file
2. Configure `.claude/settings.json` to use the hook
3. Run any Claude Code command
4. Check the output

## License

MIT
