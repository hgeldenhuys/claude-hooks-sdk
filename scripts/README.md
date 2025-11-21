# Hook Event Schema Discovery & Monitoring

This directory contains tools for discovering and monitoring Claude Code hook event schemas.

## Problem

Claude Code's hook events can evolve without documentation updates. Properties may be:
- Added without announcement
- Renamed (e.g., `user_input` → `prompt`, `tool_output` → `tool_response`)
- Removed silently
- Changed in type or structure

## Solution: Continuous Schema Monitoring

### 1. Trigger All Events

Manually trigger all 10 hook event types:

```bash
# See trigger-all-events.md for complete guide
```

Key events to test:
- ✅ SessionStart - Start new session
- ✅ UserPromptSubmit - Submit any prompt
- ✅ PreToolUse - Run any tool
- ✅ PostToolUse - Let tool complete
- ✅ Stop - Ctrl+C during response
- ✅ SubagentStop - Use Task tool
- ⚠️  SessionEnd - Exit session
- ⚠️  Notification - System notifications (rare)
- ⚠️  PreCompact - Fill context window
- ❓ PermissionRequest - Trigger permission dialog

### 2. Analyze Current Schemas

Extract and analyze all schemas from logged events:

```bash
bun scripts/analyze-schemas.ts
```

This will:
- Extract all properties from each event type
- Generate TypeScript interfaces
- Compare against documented schemas
- Highlight undocumented properties

**Output:**
```
### PreToolUse (9 events)
```typescript
interface PreToolUseInput {
  cwd: string;
  hook_event_name: string;
  permission_mode: string;  // ⚠️ UNDOCUMENTED!
  // ...
}
```

### 3. Monitor for Changes

Compare current schemas against baseline:

```bash
# First run creates baseline
bun scripts/schema-diff.ts

# Subsequent runs detect changes
bun scripts/schema-diff.ts
```

**Example output:**
```
### PreToolUse
  🆕 ADDED: new_property
  ❌ REMOVED: old_property
```

### 4. Update SDK Types

When schema changes are detected:

1. **Verify the change:**
   ```bash
   # View examples of the new property
   cat .claude/hooks/event-logger/logs/events.jsonl | \
     jq 'select(.input.hook.hook_event_name == "PreToolUse") | .input.hook.new_property' | \
     head -5
   ```

2. **Update types in `src/types.ts`:**
   ```typescript
   export interface PreToolUseInput extends BaseHookInput {
     hook_event_name: 'PreToolUse';
     tool_name: string;
     tool_input: Record<string, unknown>;
     tool_use_id: string;
     permission_mode?: string; // 🆕 Add new property
   }
   ```

3. **Document the change:**
   ```bash
   echo "## $(date +%Y-%m-%d) - Schema Change Detected" >> SCHEMA_CHANGES.md
   echo "- PreToolUse: Added \`permission_mode\` property" >> SCHEMA_CHANGES.md
   ```

4. **Update baseline:**
   ```bash
   rm schemas/baseline.json
   bun scripts/schema-diff.ts  # Creates new baseline
   ```

5. **Bump version:**
   ```bash
   # If breaking change
   npm version minor

   # If backward-compatible
   npm version patch
   ```

## Discovered Schema Differences (2025-11-21)

### Properties Not in Documentation:

1. **`permission_mode`** - In PreToolUse, PostToolUse, UserPromptSubmit, Stop, SubagentStop
   - Values: `"bypassPermissions"`, `"default"`
   - Indicates permission level for the operation

2. **`source`** - In SessionStart
   - Values: `"resume"`, `"new"` (likely)
   - Indicates if session was resumed or newly created

3. **`stop_hook_active`** - In Stop, SubagentStop
   - Values: `true`, `false`
   - Prevents recursive Stop hook calls

4. **`agent_id`** - In SubagentStop
   - Short agent identifier (e.g., `"118b0863"`)
   - Docs mentioned `agent_name` but actual property is `agent_id`

5. **`agent_transcript_path`** - In SubagentStop
   - Full path to agent's transcript file

6. **`prompt`** - In UserPromptSubmit
   - Docs say `user_input` but actual property is `prompt`

7. **`tool_response`** - In PostToolUse
   - Docs say `tool_output` but actual property is `tool_response`
   - Contains: `{stdout, stderr, interrupted, isImage}`

## Recommended Schedule

Run schema analysis:
- **Weekly** during active Claude Code development
- **Monthly** during stable periods
- **After every Claude Code update**

## Automation

Add to your workflow:

```bash
# Add to .claude/hooks/SessionStart
bun scripts/schema-diff.ts > /tmp/schema-diff.log 2>&1
if [ $? -ne 0 ]; then
  echo "⚠️  Schema changes detected! Check /tmp/schema-diff.log"
fi
```

## Files

- `analyze-schemas.ts` - Extract and analyze all schemas
- `schema-diff.ts` - Compare against baseline, detect changes
- `trigger-all-events.md` - Guide for triggering all event types
- `../schemas/baseline.json` - Current schema baseline
