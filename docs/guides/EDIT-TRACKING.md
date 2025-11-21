# Edit Tracking Feature

## Overview

The SDK can automatically track which files were edited between `UserPromptSubmit` and `Stop` events, providing a complete list of files modified during Claude's response.

This is useful for:
- **Code review workflows** - Know exactly what changed
- **Automated testing** - Test only modified files
- **Change notifications** - Alert team members about edits
- **Audit trails** - Track file modifications per transaction
- **Git workflows** - Automatically stage/commit edited files

## How It Works

### Lifecycle

```
1. UserPromptSubmit
   ↓ (Start tracking)
2. PreToolUse (Edit)
3. PostToolUse (Edit) → Track file_path
   ↓
4. PreToolUse (Edit)
5. PostToolUse (Edit) → Track file_path
   ↓
6. PreToolUse (Bash) → Ignore (not Edit)
7. PostToolUse (Bash)
   ↓
8. Stop → Attach editedFiles[] to context
   ↓ (Reset tracking)
```

### What Gets Tracked

- ✅ **Edit tool** - File modifications from `PostToolUse` events
- ✅ **Write tool** - New file creation tracked
- ✅ **MultiEdit tool** - All files in edits array tracked
- ✅ **Deduplicated** - Same file edited multiple times = one entry
- ✅ **Order preserved** - Files appear in chronological order of first modification
- ❌ **Other tools** - Bash, Read, etc. are ignored

## Usage

### Enable Tracking

```typescript
import { HookManager, success } from 'claude-hooks-sdk';

const manager = new HookManager({
  trackEdits: true,  // ← Enable edit tracking
  logEvents: true,
  clientId: 'my-hook'
});

manager.onStop(async (input) => {
  const enrichedInput = input as any;
  const editedFiles = enrichedInput.context?.editedFiles;

  if (editedFiles && editedFiles.length > 0) {
    console.log(`Files edited in this response:`);
    editedFiles.forEach(file => console.log(`  - ${file}`));
  }

  return success();
});

manager.run();
```

### Access Tracked Files

Edited files are available in the **Stop event's context**:

```typescript
{
  "input": {
    "hook": {
      "hook_event_name": "Stop",
      "session_id": "...",
      // ...
    },
    "context": {
      "transactionId": "tx_...",
      "conversationId": "...",
      "promptId": "prompt_...",
      "editedFiles": [           // ← Tracked files here
        "/project/src/file1.ts",
        "/project/src/file2.ts"
      ]
    }
  }
}
```

## Use Cases

### 1. Automated Git Staging

```typescript
manager.onStop(async (input) => {
  const context = (input as any).context;

  if (context?.editedFiles && context.editedFiles.length > 0) {
    // Stage all edited files
    const files = context.editedFiles.join(' ');
    execSync(`git add ${files}`);

    console.log(`✅ Staged ${context.editedFiles.length} files`);
  }

  return success();
});
```

### 2. Run Tests on Changed Files

```typescript
manager.onStop(async (input) => {
  const context = (input as any).context;

  if (context?.editedFiles) {
    // Find test files for edited files
    const testFiles = context.editedFiles
      .filter(f => f.endsWith('.ts'))
      .map(f => f.replace('/src/', '/tests/').replace('.ts', '.test.ts'));

    // Run tests
    for (const testFile of testFiles) {
      if (existsSync(testFile)) {
        execSync(`bun test ${testFile}`);
      }
    }
  }

  return success();
});
```

### 3. Slack Notification

```typescript
manager.onStop(async (input) => {
  const context = (input as any).context;

  if (context?.editedFiles && context.editedFiles.length > 0) {
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({
        text: `🔧 Claude edited ${context.editedFiles.length} files`,
        blocks: [{
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: context.editedFiles.map(f => `\`${f}\``).join('\n')
          }
        }]
      })
    });
  }

  return success();
});
```

### 4. Code Review Workflow

```typescript
manager.onStop(async (input) => {
  const context = (input as any).context;

  if (context?.editedFiles && context.editedFiles.length >= 5) {
    // Large changeset - request code review
    await createGitHubPR({
      title: `Claude changes (${context.editedFiles.length} files)`,
      body: `Files modified:\n${context.editedFiles.map(f => `- ${f}`).join('\n')}`,
      reviewers: ['team-lead']
    });
  }

  return success();
});
```

### 5. Lint Only Changed Files

```typescript
manager.onStop(async (input) => {
  const context = (input as any).context;

  if (context?.editedFiles) {
    const tsFiles = context.editedFiles.filter(f =>
      f.endsWith('.ts') || f.endsWith('.tsx')
    );

    if (tsFiles.length > 0) {
      execSync(`eslint ${tsFiles.join(' ')} --fix`);
      console.log(`✅ Linted ${tsFiles.length} TypeScript files`);
    }
  }

  return success();
});
```

## Behavior Details

### Deduplication

Files are tracked using a `Set<string>`, so duplicate edits to the same file only appear once:

```typescript
// Events:
PostToolUse (Edit, file: "/project/src/app.ts")
PostToolUse (Edit, file: "/project/src/utils.ts")
PostToolUse (Edit, file: "/project/src/app.ts")  // ← Duplicate

// Result:
editedFiles: [
  "/project/src/app.ts",    // ← Appears once
  "/project/src/utils.ts"
]
```

### Tracking Lifecycle

- **Starts:** On `UserPromptSubmit` event
- **Tracks:** Every `PostToolUse` with `tool_name === 'Edit'`
- **Ends:** On `Stop` event (files attached to context, then reset)

### Empty Arrays

If no files were edited, `editedFiles` will NOT be present in the context:

```typescript
// No edits made
context.editedFiles === undefined  // ✅

// Not:
context.editedFiles === []  // ❌
```

Always check for existence:

```typescript
if (context?.editedFiles && context.editedFiles.length > 0) {
  // Process edited files
}
```

### Multiple UserPromptSubmit Events

Each `UserPromptSubmit` resets tracking:

```typescript
UserPromptSubmit → Edit file1.ts → Stop
  → editedFiles: ["file1.ts"]

UserPromptSubmit → Edit file2.ts → Stop
  → editedFiles: ["file2.ts"]  // Previous tracking cleared
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `trackEdits` | `boolean` | `false` | Enable edit tracking |

### Recommended Setup

```typescript
const manager = new HookManager({
  trackEdits: true,              // Track edits
  logEvents: true,               // Log to file
  enableContextTracking: true,   // Enable correlation context
  clientId: 'my-app'
});
```

## Performance

- **Minimal overhead** - Uses `Set<string>` for O(1) deduplication
- **Memory efficient** - Only stores file paths, not file contents
- **Reset on Stop** - Memory is released after each response

Typical usage:
- 10 file edits = ~500 bytes of memory
- 100 file edits = ~5 KB of memory

## Debugging

Enable debug logging to see tracking in action:

```typescript
const manager = new HookManager({
  trackEdits: true,
  debug: true  // ← Enable debug output
});
```

**Output:**
```
[claude-hooks-sdk] Started tracking edits
[claude-hooks-sdk] Tracked edit: /project/src/file1.ts
[claude-hooks-sdk] Tracked edit: /project/src/file2.ts
[claude-hooks-sdk] Stop event - tracked 2 edited files
```

## Testing

See `sample-extension/test-edit-tracking.ts` for a complete test that simulates:
- UserPromptSubmit
- Multiple Edit tool uses
- Non-Edit tools (ignored)
- Duplicate edits (deduplicated)
- Stop event with tracked files

Run test:
```bash
CLAUDE_PROJECT_DIR=/path/to/project bun sample-extension/test-edit-tracking.ts
```

## Future Enhancements

Potential features:
- ✅ ~~Track `Write` tool (new file creation)~~ - **Implemented in v0.4.1**
- ✅ ~~Track `MultiEdit` tool~~ - **Implemented in v0.4.1**
- Track file deletions
- Include diff stats (lines added/removed)
- Filter by file pattern (e.g., only track `*.ts` files)

## Complete Example

```typescript
#!/usr/bin/env bun
import { HookManager, success } from 'claude-hooks-sdk';
import { execSync } from 'child_process';

const manager = new HookManager({
  trackEdits: true,
  logEvents: true,
  clientId: 'git-auto-commit'
});

manager.onStop(async (input) => {
  const context = (input as any).context;

  if (context?.editedFiles && context.editedFiles.length > 0) {
    console.log(`\n🔧 Claude edited ${context.editedFiles.length} files:`);
    context.editedFiles.forEach(file => console.log(`   ${file}`));

    // Stage edited files
    const files = context.editedFiles.join(' ');
    execSync(`git add ${files}`);

    // Create commit with transaction ID
    const message = `Claude edits (tx: ${context.transactionId})`;
    execSync(`git commit -m "${message}"`);

    console.log(`\n✅ Changes committed!`);
  }

  return success();
});

manager.run();
```

Register in `.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [{
      "matcher": "*",
      "hooks": [{
        "type": "command",
        "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/git-auto-commit.ts"
      }]
    }]
  }
}
```

Now every time Claude edits files, they're automatically staged and committed!
