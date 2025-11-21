# Repo Instance ID

## Overview

The SDK automatically generates a unique `repoInstanceId` for each checkout/clone of a repository. This ID persists across all hook events and helps distinguish between different instances of the same repository.

## Use Cases

### 1. Multi-Machine Analytics

Track which machine/checkout events are coming from:

```typescript
manager.onUserPromptSubmit(async (input) => {
  const repoId = input.context?.git?.repoInstanceId;

  await analytics.track({
    event: 'prompt_submitted',
    repoInstanceId: repoId,  // Identifies which checkout
    repo: input.context?.git?.repo,
    branch: input.context?.git?.branch,
  });

  return success();
});
```

### 2. Team Collaboration Tracking

Know which team member's checkout triggered an event:

```typescript
// Send to team dashboard
await fetch('https://team-dashboard.com/events', {
  method: 'POST',
  body: JSON.stringify({
    repoInstanceId: input.context?.git?.repoInstanceId,
    developer: input.context?.git?.user,
    email: input.context?.git?.email,
    event: input.hook_event_name,
  }),
});
```

### 3. Multi-Environment Tracking

Distinguish between:
- Developer's local machine
- CI/CD pipeline
- Different developer machines
- Different project directories

```typescript
{
  "context": {
    "git": {
      "repo": "https://github.com/org/repo.git",
      "repoInstanceId": "repo_1732195847123_abc123def4567",  // Unique to this checkout
      "user": "John Doe",
      "branch": "main"
    }
  }
}
```

## How It Works

### Generation

The `repoInstanceId` is generated **once** when:
1. First hook event is triggered
2. Git metadata is collected
3. No previous `repoInstanceId` exists in context

### Persistence

The ID is persisted in `.claude/hooks/{clientId}/context.json`:

```json
{
  "transactionId": "tx_1732195847123_abc123def",
  "conversationId": "session-uuid",
  "git": {
    "repo": "https://github.com/org/repo.git",
    "repoInstanceId": "repo_1732195847123_abc123def4567",
    "branch": "main"
  }
}
```

### Lifecycle

- **Generated:** First hook event in this checkout
- **Persists:** Across all sessions until context file is deleted
- **Unique:** Different checkouts of same repo = different IDs

## Format

```
repo_<timestamp>_<random>
```

Example: `repo_1732195847123_abc123def4567`

- Timestamp: Unix timestamp in milliseconds
- Random: 15 character random string (base36)

## Examples

### Same Repo, Different Checkouts

```
# Developer A's laptop - Checkout 1
repoInstanceId: "repo_1732195847123_abc123def4567"

# Developer B's laptop - Checkout 2
repoInstanceId: "repo_1732195999888_xyz789ghi0123"

# CI/CD pipeline - Checkout 3
repoInstanceId: "repo_1732196111222_pqr456stu7890"
```

All three have:
- Same `repo`: `"https://github.com/org/repo.git"`
- Different `repoInstanceId`
- Different `user` (developer name)

### Multi-Directory Checkouts

Same developer, different project directories:

```
# ~/projects/app - Checkout 1
repoInstanceId: "repo_1732195847123_abc123def4567"

# ~/work/app-fork - Checkout 2
repoInstanceId: "repo_1732196000000_def456ghi7890"
```

## Access Pattern

```typescript
manager.onStop(async (input) => {
  const git = input.context?.git;

  if (git?.repoInstanceId) {
    console.log(`Repo Instance: ${git.repoInstanceId}`);
    console.log(`Repository: ${git.repo}`);
    console.log(`Developer: ${git.user} <${git.email}>`);
    console.log(`Branch: ${git.branch}`);
    console.log(`Commit: ${git.commit}`);
  }

  return success();
});
```

**Output:**
```
Repo Instance: repo_1732195847123_abc123def4567
Repository: https://github.com/org/repo.git
Developer: John Doe <john@example.com>
Branch: main
Commit: abc123def456
```

## Type Safety

Full TypeScript support:

```typescript
interface EnrichedContext {
  git?: {
    repo?: string;
    repoInstanceId?: string;  // ✅ Fully typed
    user?: string;
    email?: string;
    branch?: string;
    commit?: string;
    dirty?: boolean;
  };
}
```

## Analytics Example

Track events across multiple checkouts:

```typescript
import { HookManager, success } from 'claude-hooks-sdk';

const manager = new HookManager({
  logEvents: true,
  clientId: 'analytics',
});

manager.onUserPromptSubmit(async (input) => {
  const context = input.context;

  await fetch('https://analytics.example.com/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event: 'claude_prompt',
      properties: {
        // Identify which checkout
        repoInstanceId: context?.git?.repoInstanceId,

        // Repo details
        repository: context?.git?.repo,
        branch: context?.git?.branch,

        // Developer details
        developer: context?.git?.user,
        email: context?.git?.email,

        // Correlation
        transactionId: context?.transactionId,
        sessionId: context?.conversationId,
      },
    }),
  });

  return success();
});

manager.run();
```

## Comparison with Other IDs

| ID | Scope | Lifetime | Use Case |
|----|-------|----------|----------|
| `repoInstanceId` | Checkout/clone | Persists until context deleted | Distinguish checkouts |
| `transactionId` | Session | Single session | Correlate events in session |
| `conversationId` | Session | Single session | Track conversation |
| `promptId` | Prompt | Single prompt/response | Track individual prompts |

## Notes

- **Not a user ID** - Identifies checkout, not developer
- **Not a session ID** - Persists across sessions
- **Not a machine ID** - Identifies project directory
- **Git required** - Only generated if `.git` directory exists

## Clearing the ID

To generate a new `repoInstanceId`:

```bash
# Delete context file
rm .claude/hooks/{clientId}/context.json

# Next hook event will generate new ID
```

## Privacy

The `repoInstanceId` is:
- ✅ Generated locally
- ✅ Not shared with external services (unless you send it)
- ✅ Random and non-identifying
- ✅ Can be regenerated at any time
