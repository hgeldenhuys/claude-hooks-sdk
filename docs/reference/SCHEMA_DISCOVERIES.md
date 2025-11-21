# Hook Event Schema Discoveries

This document tracks discovered schema differences between Claude Code documentation and actual event payloads.

**Last Updated:** 2025-11-21

## Summary

We've discovered **7 major schema differences** and **1 completely undocumented event structure**.

### Events Captured

- ✅ **SessionStart** - 1 event
- ✅ **UserPromptSubmit** - 4 events
- ✅ **PreToolUse** - 34 events
- ✅ **PostToolUse** - 31 events
- ✅ **Stop** - 3 events
- ✅ **SubagentStop** - 4 events
- ✅ **Notification** - 1 event (NEW!)
- ⚠️  **SessionEnd** - 0 events (requires session exit)
- ⚠️  **PreCompact** - 0 events (requires context window filling)
- ⚠️  **PermissionRequest** - 0 events (requires permission dialog)

## Discovered Properties

### 1. `permission_mode` (UNDOCUMENTED)

**Found in:** PreToolUse, PostToolUse, UserPromptSubmit, Stop, SubagentStop

**Values:**
- `"bypassPermissions"` - Tools run without permission prompts
- `"default"` - Standard permission mode

**Purpose:** Indicates the permission level for the current operation. Critical for security auditing.

**Example:**
```json
{
  "hook_event_name": "PreToolUse",
  "permission_mode": "bypassPermissions",
  "tool_name": "Bash"
}
```

### 2. `source` (UNDOCUMENTED)

**Found in:** SessionStart

**Values:**
- `"resume"` - Session was resumed from previous state
- `"new"` - New session (likely)

**Purpose:** Distinguish between fresh sessions and resumed sessions.

**Example:**
```json
{
  "hook_event_name": "SessionStart",
  "source": "resume",
  "session_id": "42de7f80-6dc8-486b-a8ce-38a67b5df2a8"
}
```

### 3. `stop_hook_active` (UNDOCUMENTED)

**Found in:** Stop, SubagentStop

**Values:**
- `true` - Stop hook is currently running
- `false` - Stop hook is not running

**Purpose:** Prevents recursive Stop hook invocations. Safety mechanism.

**Example:**
```json
{
  "hook_event_name": "Stop",
  "stop_hook_active": false
}
```

### 4. `agent_id` vs `agent_name` (DOCUMENTATION MISMATCH)

**Found in:** SubagentStop

**Documentation says:** `agent_name: string`
**Actually:** `agent_id: string`

**Values:** Short hexadecimal IDs (e.g., `"118b0863"`, `"4c9b40eb"`)

**Example:**
```json
{
  "hook_event_name": "SubagentStop",
  "agent_id": "118b0863",
  "session_id": "74d6d41b-dbef-4522-ab8c-c8623b2f9520"
}
```

**Note:** The `session_id` in SubagentStop is the **parent session ID**, not the agent's session ID.

### 5. `agent_transcript_path` (UNDOCUMENTED)

**Found in:** SubagentStop

**Values:** Full path to agent's transcript file

**Purpose:** Points to the subagent's conversation transcript for debugging/analysis.

**Example:**
```json
{
  "agent_id": "118b0863",
  "agent_transcript_path": "/Users/username/.claude/projects/my-project/agent-118b0863.jsonl"
}
```

### 6. `prompt` vs `user_input` (DOCUMENTATION MISMATCH)

**Found in:** UserPromptSubmit

**Documentation says:** `user_input: string`
**Actually:** `prompt: string`

**Example:**
```json
{
  "hook_event_name": "UserPromptSubmit",
  "prompt": "okay, i see it logging now"
}
```

### 7. `tool_response` vs `tool_output` (DOCUMENTATION MISMATCH)

**Found in:** PostToolUse

**Documentation says:** `tool_output: any`
**Actually:** `tool_response: Record<string, any>`

**Structure:**
```typescript
{
  stdout: string;
  stderr: string;
  interrupted: boolean;
  isImage: boolean;
}
```

**Example:**
```json
{
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_response": {
    "stdout": "...",
    "stderr": "",
    "interrupted": false,
    "isImage": false
  }
}
```

### 8. `tool_input` in PostToolUse (UNDOCUMENTED)

**Found in:** PostToolUse

**Purpose:** Repeats the tool input from PreToolUse for convenience. Allows PostToolUse handlers to access both input and output without looking up PreToolUse event.

**Example:**
```json
{
  "hook_event_name": "PostToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "ls -la",
    "description": "List directory contents"
  },
  "tool_response": {
    "stdout": "..."
  }
}
```

## Complete Notification Event Schema (NEWLY DISCOVERED)

The **Notification** event is minimally documented. Here's the actual schema:

```typescript
interface NotificationInput {
  hook_event_name: 'Notification';
  session_id: string;
  transcript_path: string;
  cwd: string;
  message: string;
  notification_type: string;
}
```

**Observed notification types:**
- `"idle_prompt"` - Claude is waiting for user input

**Example:**
```json
{
  "hook_event_name": "Notification",
  "session_id": "74d6d41b-dbef-4522-ab8c-c8623b2f9520",
  "message": "Claude is waiting for your input",
  "notification_type": "idle_prompt",
  "cwd": "/Users/username/project",
  "transcript_path": "..."
}
```

**Likely other notification types** (not yet observed):
- Budget warnings
- Rate limit notices
- Context window alerts
- System messages

## Parent-Child Session Relationships

### Subagent Event Structure

When a subagent is spawned via the Task tool:

```json
{
  "hook_event_name": "SubagentStop",
  "session_id": "parent-session-id",        // ← Parent's session ID
  "agent_id": "agent-short-id",              // ← Subagent's ID
  "agent_transcript_path": "/path/to/agent-transcript.jsonl"
}
```

### Context Enrichment for Subagents

Our SDK now automatically enriches SubagentStop events with:

```json
{
  "context": {
    "transactionId": "tx_...",
    "conversationId": "original-session-id",
    "parentSessionId": "parent-session-id",  // ← NEW
    "agentId": "agent-short-id",             // ← NEW
    "project_dir": "/path/to/project",
    "git": {...}
  }
}
```

This allows easy filtering and correlation:

```bash
# Find all subagent events for a specific parent
cat events.jsonl | jq 'select(.input.context.parentSessionId == "74d6d41b-...")'

# Find all events for a specific subagent
cat events.jsonl | jq 'select(.input.context.agentId == "118b0863")'
```

## Missing Events (Not Yet Triggered)

### SessionEnd
**How to trigger:** Exit Claude Code session with `/exit` or Ctrl+D

**Expected schema:**
```typescript
interface SessionEndInput {
  hook_event_name: 'SessionEnd';
  session_id: string;
  cwd: string;
  transcript_path: string;
  reason: string;  // Likely: "user_exit", "timeout", "error"
}
```

### PreCompact
**How to trigger:** Fill context window to capacity (difficult to do intentionally)

**Expected schema:**
```typescript
interface PreCompactInput {
  hook_event_name: 'PreCompact';
  session_id: string;
  cwd: string;
  transcript_path: string;
  trigger: string;  // Likely: "auto", "manual"
}
```

### PermissionRequest
**How to trigger:** Attempt restricted operation without `bypassPermissions`

**Expected schema:** Unknown (no documentation)

## Recommendations

### 1. Update SDK Types

Update `src/types.ts` to reflect actual properties:

```typescript
// Fix UserPromptSubmit
export interface UserPromptSubmitInput extends BaseHookInput {
  hook_event_name: 'UserPromptSubmit';
  prompt: string;  // NOT user_input
  permission_mode?: string;
}

// Fix PostToolUse
export interface PostToolUseInput extends BaseHookInput {
  hook_event_name: 'PostToolUse';
  tool_name: string;
  tool_input: Record<string, unknown>;  // NEW
  tool_response: {                       // NOT tool_output
    stdout: string;
    stderr: string;
    interrupted: boolean;
    isImage: boolean;
  };
  tool_use_id: string;
  permission_mode?: string;
}

// Fix SubagentStop
export interface SubagentStopInput extends BaseHookInput {
  hook_event_name: 'SubagentStop';
  agent_id: string;           // NOT agent_name
  agent_transcript_path: string;
  permission_mode?: string;
  stop_hook_active: boolean;
}
```

### 2. Add Universal Properties

All events seem to have:
- `session_id`
- `transcript_path`
- `cwd`
- `hook_event_name`

Many have:
- `permission_mode` (PreToolUse, PostToolUse, UserPromptSubmit, Stop, SubagentStop)

### 3. Monitor for Changes

Run schema analysis:
- Weekly during Claude Code development
- After every Claude Code update
- When unexpected behavior occurs

```bash
bun scripts/analyze-schemas.ts
bun scripts/schema-diff.ts
```

## Version History

### 2025-11-21 - Initial Discovery

- Analyzed 73 events across 7 event types
- Discovered 8 major schema differences
- Added parent session tracking for subagents
- Documented Notification event structure
