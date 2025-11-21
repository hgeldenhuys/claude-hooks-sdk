# Non-Blocking Hook Error Handling

## Overview

By default, **hook failures DO NOT block Claude Code**. This is critical for reliability - a failed API call or network timeout shouldn't freeze your Claude Code session.

## Default Behavior (Non-Blocking)

```typescript
const manager = new HookManager({
  logEvents: true,
  enableFailureQueue: true,
  // blockOnFailure: false (default)
});

manager.onPreToolUse(async (input) => {
  // If this fails, Claude Code continues normally
  await fetch('https://analytics.example.com/track', {
    method: 'POST',
    body: JSON.stringify(input)
  });

  return success();
});
```

**What happens when the handler fails:**

1. ✅ Error is logged to console (if `debug: true`)
2. ✅ Event is added to failure queue (if `enableFailureQueue: true`)
3. ✅ Hook exits with code `0` (success)
4. ✅ **Claude Code continues normally** - user is unaffected

## Blocking Mode (Opt-In)

For critical operations where failure should halt Claude Code:

```typescript
const manager = new HookManager({
  blockOnFailure: true,  // ← Opt-in to blocking behavior
  debug: true
});

manager.onPreToolUse(async (input) => {
  // If this fails, Claude Code will be blocked
  const result = await criticalSecurityCheck(input);

  if (!result.approved) {
    return error('Security check failed!');
  }

  return success();
});
```

**What happens when the handler fails:**

1. ❌ Error is logged to console
2. ❌ Hook exits with code `1` (failure)
3. ❌ **Claude Code is blocked** - user sees error message

## Use Cases

### Non-Blocking (Default) - Recommended for:

- **Analytics/Telemetry** - Tracking tool usage, user behavior
- **Logging** - Sending events to external logging services
- **Notifications** - Slack/Discord notifications
- **Metrics** - Prometheus, Datadog, CloudWatch metrics
- **Webhooks** - Notifying external systems
- **Auditing** - Compliance logging
- **AI Model Calls** - Non-critical LLM augmentation

**Why non-blocking:**
- Network failures are common
- External services may be down
- Rate limits may be hit
- These shouldn't block the user's work

### Blocking (Opt-In) - Use for:

- **Security enforcement** - Approval workflows, access control
- **Data validation** - Critical input validation
- **Quota enforcement** - Hard limits that must be respected
- **Compliance checks** - Regulatory requirements
- **License validation** - Paid feature checks

**Why blocking:**
- Failures indicate serious issues
- User should be notified immediately
- Work should not proceed without approval

## Error Recovery

### With Failure Queue (Non-Blocking + Retry)

The recommended pattern:

```typescript
const manager = new HookManager({
  blockOnFailure: false,        // Non-blocking
  enableFailureQueue: true,     // Retry failed events
  maxRetries: 3,
  debug: true
});

manager.onPostToolUse(async (input) => {
  // Send to analytics API
  const response = await fetch('https://api.analytics.com/events', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      event: 'tool_use',
      tool: input.tool_name,
      timestamp: Date.now()
    })
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}`);
  }

  return success();
});
```

**What happens:**

1. First attempt fails → queued for retry
2. Second event arrives → drains queue first (FIFO)
3. Retry succeeds → event removed from queue
4. Current event processed normally

**User experience:**
- ✅ Claude Code never blocks
- ✅ Events eventually reach the API
- ✅ Failed events are retried automatically
- ✅ Queue is drained on next hook event

## Testing

### Test Non-Blocking Mode:

```bash
# Simulates a failing handler
cat <<'EOF' | bun your-hook.ts
{"hook_event_name":"PreToolUse","session_id":"test","tool_name":"Test","tool_input":{},"cwd":"/tmp","transcript_path":"/tmp/test.jsonl","tool_use_id":"test"}
EOF

echo "Exit code: $?"
# Should print: Exit code: 0
```

### Test Blocking Mode:

```typescript
const manager = new HookManager({
  blockOnFailure: true
});

// ... same test ...
// Should print: Exit code: 1
```

## Real-World Example

### Analytics Hook (Non-Blocking)

```typescript
import { HookManager, success } from 'claude-hooks-sdk';

const manager = new HookManager({
  logEvents: true,
  enableFailureQueue: true,
  maxRetries: 3,
  debug: false,  // Don't spam user with errors
});

manager.onPreToolUse(async (input) => {
  try {
    await fetch('https://analytics.company.com/track', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ANALYTICS_TOKEN}` },
      body: JSON.stringify({
        user: input.session_id,
        tool: input.tool_name,
        timestamp: Date.now()
      }),
      signal: AbortSignal.timeout(5000)  // 5 second timeout
    });
  } catch (error) {
    // Will be queued and retried
    throw error;
  }

  return success();
});

manager.run();
```

**Benefits:**
- Network failures don't block user
- Timeouts don't freeze Claude Code
- Failed events retry on next hook
- Analytics eventually consistent

### Security Gate (Blocking)

```typescript
import { HookManager, success, error } from 'claude-hooks-sdk';

const manager = new HookManager({
  blockOnFailure: true,  // Must block on security failures
  debug: true
});

manager.onPreToolUse(async (input) => {
  // Check if tool is allowed
  const allowed = await checkSecurityPolicy(input.tool_name);

  if (!allowed) {
    return error(`Tool ${input.tool_name} is not allowed by security policy`);
  }

  return success();
});

manager.run();
```

**Benefits:**
- Unauthorized tools are blocked
- User sees clear error message
- Security policy is enforced
- No bypass possible

## Migration Guide

If you have existing hooks that should be non-blocking:

**Before:**
```typescript
// Implicitly blocking
const manager = new HookManager();
manager.onPreToolUse(async (input) => {
  await sendAnalytics(input);  // If this fails, blocks Claude Code
  return success();
});
```

**After:**
```typescript
// Explicitly non-blocking
const manager = new HookManager({
  blockOnFailure: false,      // Default, but explicit
  enableFailureQueue: true,   // Enable retry
  maxRetries: 3
});

manager.onPreToolUse(async (input) => {
  await sendAnalytics(input);  // If this fails, queued for retry
  return success();
});
```

## Summary

| Feature | Non-Blocking (Default) | Blocking (Opt-In) |
|---------|----------------------|------------------|
| **Exit Code on Failure** | 0 (success) | 1 (error) |
| **Claude Code Behavior** | Continues | Blocked |
| **User Impact** | None | Error shown |
| **Failure Queue** | Events queued | No queue |
| **Best For** | Analytics, logging, telemetry | Security, validation |
| **Recommended** | ✅ Yes | ⚠️ Use sparingly |

**Default configuration is non-blocking for maximum reliability!**
