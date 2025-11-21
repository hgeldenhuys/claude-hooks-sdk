# Trigger All Hook Events - Test Plan

This document outlines how to trigger each of the 10 Claude Code hook events for schema discovery.

## Events to Trigger

### 1. SessionStart ✅
- **How:** Start a new Claude Code session
- **Command:** `claude` (new session)
- **Expected:** Captures session_id, cwd, transcript_path

### 2. SessionEnd
- **How:** Exit Claude Code gracefully
- **Command:** `/exit` or Ctrl+D
- **Expected:** Captures reason (e.g., "user_exit")

### 3. UserPromptSubmit ✅
- **How:** Submit any user message
- **Command:** Type any prompt and press Enter
- **Expected:** Captures user input, possibly prompt_id

### 4. PreToolUse ✅
- **How:** Trigger any tool
- **Command:** Ask Claude to read a file, run bash, etc.
- **Expected:** Captures tool_name, tool_input, tool_use_id

### 5. PostToolUse ✅
- **How:** Let any tool complete
- **Command:** (automatic after PreToolUse)
- **Expected:** Captures tool_name, tool_output, exit_code, duration

### 6. Stop
- **How:** Stop Claude during response generation
- **Command:** Ctrl+C while Claude is responding
- **Expected:** Captures stop reason, partial response state

### 7. SubagentStop ✅
- **How:** Use Task tool to spawn a subagent
- **Command:** Ask Claude to delegate work to an agent
- **Expected:** Captures agent_name, agent_type, completion status

### 8. Notification
- **How:** Trigger a system notification
- **Command:** (unclear - may be internal only)
- **Possible:** Budget warnings, rate limits, system messages

### 9. PreCompact
- **How:** Fill up context window to trigger compaction
- **Command:** Long conversation or large file reads
- **Expected:** Captures trigger reason, context size

### 10. PermissionRequest
- **How:** Trigger a permission dialog
- **Command:** Try to access restricted resource (if not in bypass mode)
- **Expected:** Captures permission type, requested action

## Test Execution Plan

1. Clear existing logs
2. Start fresh session (SessionStart)
3. Submit prompt (UserPromptSubmit)
4. Read file (PreToolUse, PostToolUse)
5. Run bash command (PreToolUse, PostToolUse)
6. Spawn subagent via Task tool (SubagentStop)
7. Stop response mid-generation (Stop)
8. Fill context to trigger compaction (PreCompact)
9. Exit session (SessionEnd)

## Schema Analysis Commands

After triggering events:

```bash
# Extract all unique keys from each event type
cat .claude/hooks/event-logger/logs/events.jsonl | \
  jq -r 'select(.input.hook.hook_event_name == "PreToolUse") | .input.hook | keys[]' | \
  sort -u

# Compare schemas between event types
for event in SessionStart SessionEnd UserPromptSubmit PreToolUse PostToolUse Stop SubagentStop Notification PreCompact PermissionRequest; do
  echo "=== $event ==="
  cat .claude/hooks/event-logger/logs/events.jsonl | \
    jq -r "select(.input.hook.hook_event_name == \"$event\") | .input.hook | keys[]" | \
    sort -u
done

# Find new/undocumented properties
cat .claude/hooks/event-logger/logs/events.jsonl | \
  jq '.input.hook | keys[]' | sort -u > /tmp/actual_keys.txt
```
