# Quick Reference

## Project Structure

```
claude-hooks-sdk/
├── README.md              ← Start here
├── CHANGELOG.md          ← Version history
├── CONTRIBUTING.md       ← Development guide
│
├── docs/                 ← Documentation hub
│   ├── README.md         ← Documentation index
│   ├── guides/           ← Feature guides
│   │   ├── EDIT-TRACKING.md
│   │   ├── NON-BLOCKING-HOOKS.md
│   │   ├── FAILURE-QUEUE.md
│   │   └── REPO-INSTANCE-ID.md
│   ├── reference/        ← Technical reference
│   │   ├── SCHEMA_DISCOVERIES.md
│   │   └── PUBLICATION-CHECKLIST.md
│   └── releases/         ← Version-specific docs
│       ├── v0.4.1-SUMMARY.md
│       ├── BUG-FIXES-v0.4.1.md
│       └── VERIFICATION.md
│
├── src/                  ← Source code
│   ├── index.ts          ← Main exports
│   ├── manager.ts        ← Core HookManager
│   ├── types.ts          ← TypeScript definitions
│   ├── context-tracker.ts
│   ├── transcript.ts
│   └── utils.ts
│
├── sample-extension/     ← Working examples
│   ├── event-logger-v2.ts
│   ├── test-edit-tracking.ts
│   └── test-non-blocking.ts
│
└── scripts/             ← Development tools
    ├── analyze-schemas.ts
    ├── schema-diff.ts
    └── trigger-all-events.md
```

## Common Tasks

### Getting Started
1. Read [README.md](../README.md)
2. Follow [Quick Start](../README.md#quick-start)
3. Check [Examples](../sample-extension/)

### Learning Features
- **Track edited files?** → [Edit Tracking Guide](./guides/EDIT-TRACKING.md)
- **Handle errors gracefully?** → [Non-Blocking Hooks](./guides/NON-BLOCKING-HOOKS.md)
- **Implement retries?** → [Failure Queue](./guides/FAILURE-QUEUE.md)
- **Track repo checkouts?** → [Repo Instance ID](./guides/REPO-INSTANCE-ID.md)

### Troubleshooting
- **Type errors?** → Check [types.ts](../src/types.ts)
- **Schema mismatches?** → Read [Schema Discoveries](./reference/SCHEMA_DISCOVERIES.md)
- **Hook not working?** → Enable `debug: true` in HookManager

### Contributing
1. Read [CONTRIBUTING.md](../CONTRIBUTING.md)
2. Check [CHANGELOG.md](../CHANGELOG.md) for recent changes
3. Follow [Publication Checklist](./reference/PUBLICATION-CHECKLIST.md) before release

## Key Files

| File | Purpose |
|------|---------|
| `README.md` | Main documentation and API reference |
| `CHANGELOG.md` | Version history and breaking changes |
| `src/types.ts` | Complete TypeScript type definitions |
| `src/manager.ts` | Core SDK implementation |
| `sample-extension/event-logger-v2.ts` | Production-ready example |
| `docs/README.md` | Documentation index |

## Quick Links

- **Latest Release:** [v0.4.1](./releases/v0.4.1-SUMMARY.md)
- **Bug Fixes:** [v0.4.1 Fixes](./releases/BUG-FIXES-v0.4.1.md)
- **Full Docs:** [Documentation Index](./README.md)
- **Examples:** [sample-extension/](../sample-extension/)

## HookManager Options Cheat Sheet

```typescript
const manager = new HookManager({
  // Core
  debug: false,                      // Enable debug logging
  clientId: 'my-hook',              // Client identifier

  // Logging
  logEvents: true,                   // Enable event logging
  logDir: '.claude/hooks/my-hook',  // Custom log directory

  // Features
  trackEdits: true,                  // Track edited files
  enableContextTracking: true,       // Transaction IDs, git metadata

  // Error Handling
  blockOnFailure: false,             // Non-blocking by default
  handlerTimeout: 30000,             // 30s timeout (0 = disabled)

  // Failure Queue
  enableFailureQueue: true,          // Enable retry queue
  autoDrainQueue: true,              // Auto-drain (false = manual)
  maxRetries: 3,                     // Max retry attempts
  maxQueueDrainPerEvent: 10,         // Limit drain per event

  // Callbacks
  onErrorQueueNotEmpty: async (size, events) => {
    console.log(`Queue has ${size} events`);
  }
});
```

## Response Helpers

```typescript
import { success, block, error } from 'claude-hooks-sdk';

// Allow operation to continue
return success();

// Block operation with reason
return block('Dangerous command detected');

// Return error
return error('API call failed');
```

## Common Patterns

### Access Enriched Context
```typescript
manager.onStop(async (input) => {
  const context = input.context;

  // Transaction ID
  const txId = context?.transactionId;

  // Git metadata
  const branch = context?.git?.branch;
  const repoId = context?.git?.repoInstanceId;

  // Edited files
  const files = context?.editedFiles;

  return success();
});
```

### API Integration
```typescript
manager.onUserPromptSubmit(async (input) => {
  await fetch('https://api.example.com/track', {
    method: 'POST',
    body: JSON.stringify({
      event: input.hook_event_name,
      context: input.context,
    }),
  });

  return success();
});
```

### Security Check
```typescript
manager.onPreToolUse(async (input) => {
  if (input.tool_name === 'Bash') {
    const cmd = input.tool_input.command;

    if (cmd.includes('rm -rf /')) {
      return block('Dangerous command blocked');
    }
  }

  return success();
});
```
