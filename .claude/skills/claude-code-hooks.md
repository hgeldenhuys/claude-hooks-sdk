---
skill_name: claude-code-hooks
description: Guide for implementing Claude Code hooks - automated scripts that execute at specific workflow points
tags: [hooks, automation, claude-code, validation, integration]
difficulty: intermediate
version: 0.8.5
last_updated: 2025-12-05
---

# Claude Code Hooks Implementation Guide

Implement automated hooks that execute bash commands or TypeScript scripts in response to Claude Code events.

## Quick Reference

### 9 Available Hook Events

1. **PreToolUse** - Before tool execution (validation, blocking)
2. **PostToolUse** - After tool success (formatting, testing)
3. **Notification** - On Claude notifications
4. **UserPromptSubmit** - Before processing user input (context injection)
5. **Stop** - When main agent finishes responding
6. **SubagentStop** - When subagent completes
7. **PreCompact** - Before context compaction
8. **SessionStart** - Session begins
9. **SessionEnd** - Session ends

### Hook Input (stdin JSON)

```json
{
  "session_id": "...",
  "transcript_path": "...",
  "cwd": "/current/working/dir",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input": {"file_path": "...", "content": "..."},
  "tool_response": "..."
}
```

### Hook Output Mechanisms

**Exit Codes:**
- `0` - Success (stdout → transcript, or context if UserPromptSubmit)
- `2` - Blocking error (stderr → Claude feedback)
- Other - Non-blocking error (shown to user)

**JSON Output (stdout):**
```json
{
  "continue": true,
  "stopReason": "optional message",
  "suppressOutput": true,
  "decision": "allow|deny|ask",
  "hookSpecificOutput": {}
}
```

## Recommended: Use claude-hooks-sdk for TypeScript

For TypeScript hooks, use the SDK for type safety and utilities:

```bash
bun add claude-hooks-sdk
```

```typescript
#!/usr/bin/env bun
import { HookManager, success, block, createLogger } from 'claude-hooks-sdk';

const logger = createLogger('my-hook');

const manager = new HookManager({
  logEvents: true,
  clientId: 'my-hook',
  trackEdits: true,
});

manager.onPreToolUse(async (input) => {
  if (input.tool_name === 'Bash' && input.tool_input.command.includes('rm -rf /')) {
    logger.warn('Blocked dangerous command');
    return block('Dangerous command blocked');
  }
  return success();
});

manager.run();
```

## Common Use Cases

### 1. Code Formatting (PostToolUse)

**Goal**: Auto-format code after Write/Edit

**Configuration** (`.claude/settings.json`):
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/format-code.sh"
          }
        ]
      }
    ]
  }
}
```

**Script** (`.claude/hooks/format-code.sh`):
```bash
#!/bin/bash
# Read hook input
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

# Only format TypeScript/JavaScript files
if [[ "$FILE_PATH" =~ \.(ts|tsx|js|jsx)$ ]]; then
  npx prettier --write "$FILE_PATH" 2>&1
  echo "✓ Formatted: $FILE_PATH"
fi

exit 0  # Success
```

### 2. Security Validation (PreToolUse)

**Goal**: Block dangerous bash commands

**Configuration**:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/validate-bash.sh"
          }
        ]
      }
    ]
  }
}
```

**Script** (`.claude/hooks/validate-bash.sh`):
```bash
#!/bin/bash
INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command')

# Block path traversal
if [[ "$COMMAND" =~ \.\. ]]; then
  echo '{"decision": "deny", "continue": false}' | jq
  echo "❌ Blocked: Path traversal detected" >&2
  exit 2  # Blocking error
fi

# Block sensitive file access
if [[ "$COMMAND" =~ (\.env|\.git/config|id_rsa) ]]; then
  echo '{"decision": "deny", "continue": false}' | jq
  echo "❌ Blocked: Sensitive file access" >&2
  exit 2
fi

# Suggest ripgrep instead of grep
if [[ "$COMMAND" =~ grep.*\| ]] && [[ ! "$COMMAND" =~ "rg " ]]; then
  echo '{"decision": "ask"}' | jq
  echo "💡 Suggestion: Use 'rg' (ripgrep) instead of grep for better performance" >&2
  exit 0
fi

# Allow by default
echo '{"decision": "allow", "continue": true}' | jq
exit 0
```

### 3. Context Injection (UserPromptSubmit)

**Goal**: Add session context to user prompts (most powerful pattern!)

**Using SDK (recommended)**:
```typescript
#!/usr/bin/env bun
import { createUserPromptSubmitHook } from 'claude-hooks-sdk';

// ONE LINE - injects session ID and name into Claude's context
createUserPromptSubmitHook();
```

**Using bash**:
```bash
#!/bin/bash
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id')

# Output becomes Claude's context (not shown to user)
echo "Current session: $SESSION_ID"
echo "Working directory: $(pwd)"
echo "Git branch: $(git branch --show-current 2>/dev/null || echo 'N/A')"

exit 0
```

### 4. Environment Setup (SessionStart)

**Goal**: Install dependencies and configure environment

**Configuration**:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/setup-env.sh",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

**Script** (`.claude/hooks/setup-env.sh`):
```bash
#!/bin/bash

# Setup Node version with nvm
if [ -f .nvmrc ]; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  nvm use
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  bun install
fi

# Persist environment variables for subsequent bash commands
if [ -n "$CLAUDE_ENV_FILE" ]; then
  echo "export NODE_ENV=development" >> "$CLAUDE_ENV_FILE"
fi

echo "✓ Environment ready"
exit 0
```

### 5. Test Execution (PostToolUse)

**Goal**: Run tests after modifying test files

**Script** (`.claude/hooks/run-tests.sh`):
```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path')

# Only run tests if test file was modified
if [[ "$FILE_PATH" =~ \.test\.(ts|tsx|js|jsx)$ ]]; then
  echo "Running tests for: $FILE_PATH"

  # Run specific test file
  bun test "$FILE_PATH" --silent

  if [ $? -eq 0 ]; then
    echo "✓ Tests passed"
  else
    echo "❌ Tests failed" >&2
    exit 1  # Non-blocking error
  fi
fi

exit 0
```

### 6. MCP Tool Monitoring

**Goal**: Log all MCP tool usage

**Configuration**:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "mcp__.*",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/log-mcp.sh"
          }
        ]
      }
    ]
  }
}
```

**Script** (`.claude/hooks/log-mcp.sh`):
```bash
#!/bin/bash
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
TOOL_INPUT=$(echo "$INPUT" | jq -c '.tool_input')

# Log MCP tool usage
LOG_FILE="$CLAUDE_PROJECT_DIR/.agent/mcp-usage.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] $TOOL_NAME: $TOOL_INPUT" >> "$LOG_FILE"

exit 0  # Allow execution
```

## Best Practices

### Security

```bash
# ✅ GOOD - Validate and quote variables
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path')
if [[ ! -f "$FILE" ]]; then
  echo "File not found" >&2
  exit 2
fi
cat "$FILE"  # Safe

# ❌ BAD - Direct variable expansion
cat $FILE  # Injection risk!
```

### Path Safety

```bash
# ✅ GOOD - Block path traversal
if [[ "$PATH_VAR" =~ \.\. ]]; then
  exit 2  # Block
fi

# ✅ GOOD - Use absolute paths
ABSOLUTE_PATH=$(realpath "$RELATIVE_PATH")

# ❌ BAD - Trust user input
cd "$USER_PROVIDED_PATH"  # Security risk
```

### Error Handling

```bash
# ✅ GOOD - Explicit error handling
if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required but not installed" >&2
  exit 1  # Non-blocking error
fi

# ✅ GOOD - Blocking errors for critical issues
if [[ "$DANGEROUS_PATTERN" ]]; then
  echo '{"decision": "deny"}' | jq
  exit 2  # Blocking error
fi
```

### Testing

```bash
# Test hook manually before deployment
echo '{"session_id":"test","tool_name":"Write","tool_input":{"file_path":"test.ts"}}' | \
  .claude/hooks/your-hook.sh

# Enable debug logging
claude --debug

# Check hook execution in transcript
cat ~/.claude/transcripts/latest.txt | grep -A 5 "hook_event"
```

## Configuration Patterns

### Project-Specific Hooks

Store in `.claude/settings.json` (project root):
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/format-code.sh"
          }
        ]
      }
    ]
  }
}
```

### Global Hooks

Store in `~/.claude/settings.json` (user home):
```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/global-setup.sh"
          }
        ]
      }
    ]
  }
}
```

### Multiple Matchers

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write",
        "hooks": [{"type": "command", "command": "validate-write.sh"}]
      },
      {
        "matcher": "Edit",
        "hooks": [{"type": "command", "command": "validate-edit.sh"}]
      },
      {
        "matcher": "*",
        "hooks": [{"type": "command", "command": "log-all-tools.sh"}]
      }
    ]
  }
}
```

## Troubleshooting

### Hook Not Executing

1. **Check matcher pattern** - Case-sensitive, exact match required
2. **Verify script permissions** - `chmod +x .claude/hooks/script.sh`
3. **Enable debug mode** - `claude --debug` shows hook execution
4. **Check timeout** - Default 60s, increase if needed

### Hook Blocking Execution

1. **Check exit code** - Exit 2 blocks, other codes don't
2. **Verify JSON output** - `{"decision": "deny"}` blocks PreToolUse
3. **Test manually** - Echo JSON input and run script

### Environment Variables Not Persisting

- Only SessionStart hooks can persist via `$CLAUDE_ENV_FILE`
- Other hooks can't modify environment for future commands
- Solution: Use SessionStart for environment setup

## Common Gotchas

1. **Matcher wildcards** - `*` matches all, `""` (empty) also matches all
2. **Parallel execution** - Multiple matching hooks run in parallel
3. **Configuration snapshot** - Hooks captured at startup, changes need review
4. **stdin/stdout** - Always read from stdin, output to stdout/stderr
5. **jq dependency** - Most examples use jq for JSON parsing - install it first

## SDK vs Bash

| Feature | Bash Scripts | claude-hooks-sdk |
|---------|-------------|------------------|
| Type safety | ❌ | ✅ |
| Structured logging | Manual | Built-in Logger |
| Context tracking | Manual | Automatic |
| Edit tracking | Manual | Automatic |
| Error handling | Manual | Built-in queues |
| Transforms | ❌ | ConversationLogger, FileChangeTracker, etc. |
| Learning curve | Lower | Higher |
| Performance | Faster startup | Slightly slower |

**Recommendation**: Use SDK for complex hooks, bash for simple scripts.

## Resources

- [Official Claude Code Hooks Docs](https://code.claude.com/docs/en/hooks)
- [claude-hooks-sdk on npm](https://www.npmjs.com/package/claude-hooks-sdk)
- [claude-hooks-sdk on GitHub](https://github.com/hgeldenhuys/claude-hooks-sdk)
- [SDK Examples Repository](https://github.com/hgeldenhuys/claude-hooks-sdk-examples)
