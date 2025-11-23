# Transaction Logger Example

> **Comprehensive conversation transaction tracker** - Captures the full context of each Claude Code turn from user prompt through tool calls to assistant response, with beautiful TUI viewer.

## 🎯 What It Does

The Transaction Logger tracks **everything** that happens in a conversation transaction:

- ✅ **User Prompts** - All messages submitted during the turn
- ✅ **Tool Calls** - Every tool used (Read, Write, Bash, etc.)
- ✅ **File Changes** - Write/Edit/MultiEdit operations with line counts
- ✅ **Todos Created** - TodoWrite events with status
- ✅ **Assistant Response** - Final response text
- ✅ **Metadata** - Transaction ID, session ID/name, timestamps, duration
- ✅ **Line Numbers** - Fast transcript lookups via line numbers

**Perfect for:**
- 📊 Understanding what happened in a session
- 🔍 Debugging complex multi-tool workflows
- 📈 Analyzing productivity and tool usage
- 🗂️ Creating audit trails
- 🎓 Learning Claude Code patterns

## 🚀 Quick Start

### 1. Configure the Hook

Add to your `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "type": "command",
        "command": "bun \"$CLAUDE_PROJECT_DIR\"/examples/transaction-logger/hook.ts"
      }
    ],
    "PostToolUse": [
      {
        "type": "command",
        "command": "bun \"$CLAUDE_PROJECT_DIR\"/examples/transaction-logger/hook.ts"
      }
    ],
    "Stop": [
      {
        "type": "command",
        "command": "bun \"$CLAUDE_PROJECT_DIR\"/examples/transaction-logger/hook.ts"
      }
    ]
  }
}
```

### 2. Use Claude Code

Just use Claude Code normally! Every conversation turn will be logged to:
```
.claude/logs/transactions.jsonl
```

### 3. View Transactions

```bash
# View all transactions
bun examples/transaction-logger/viewer.ts

# View latest 10
bun examples/transaction-logger/viewer.ts --latest 10

# Filter by session
bun examples/transaction-logger/viewer.ts --session brave-elephant

# Watch mode (live updates)
bun examples/transaction-logger/viewer.ts --watch

# Show statistics
bun examples/transaction-logger/viewer.ts --stats
```

## 📊 Example Output

```
╔════════════════════════════════════════════════════════════════════════════╗
║                      TRANSACTION LOG VIEWER                                ║
╚════════════════════════════════════════════════════════════════════════════╝

#1 a3f2c1d8
  Session: brave-elephant
  Time: 14:32:15 (2.3s)

  💬 User Prompts:
    → Help me implement a new feature for user authentication

  🤖 Assistant:
    I'll help you implement user authentication. Let me create the necessary...
    (Line 42)

  📝 Files Changed (3):
    WRITE: auth.service.ts (120 lines)
    WRITE: auth.routes.ts (45 lines)
    EDIT: app.ts (8 lines)

  ✅ Todos (5):
    ✓ Create authentication service
    ▶ Implementing login endpoint
    ○ Add tests for auth flow
    ○ Update documentation
    ○ Deploy to staging

  📊 Summary:
    Tools: Write, Edit, TodoWrite, Read, Bash
    3 files • 5 todos • 12 tool calls

────────────────────────────────────────────────────────────────────────────

Showing 1 transaction(s)
```

## 📁 Transaction Data Structure

Each transaction is saved as a JSON line with this structure:

```typescript
{
  "transaction_id": "a3f2c1d8-...",
  "session_id": "c8adc6d9-...",
  "session_name": "brave-elephant",
  "timestamp_start": "2025-11-23T14:32:15.000Z",
  "timestamp_end": "2025-11-23T14:32:17.300Z",
  "duration_ms": 2300,

  "user_prompts": [
    "Help me implement a new feature for user authentication"
  ],

  "assistant_response": "I'll help you implement user authentication...",
  "transcript_line_number": 42,

  "files_changed": [
    {
      "path": "/project/src/auth.service.ts",
      "operation": "write",
      "lines_changed": 120,
      "timestamp": "2025-11-23T14:32:16.000Z"
    }
  ],

  "todos_created": [
    {
      "content": "Create authentication service",
      "status": "completed",
      "activeForm": "Creating authentication service"
    }
  ],

  "tools_used": [
    {
      "tool_name": "Write",
      "timestamp": "2025-11-23T14:32:16.000Z",
      "input": { ... }
    }
  ],

  "summary": {
    "total_files_changed": 3,
    "total_todos_created": 5,
    "total_tools_used": 12,
    "unique_tools": ["Write", "Edit", "TodoWrite", "Read", "Bash"]
  }
}
```

## 🔧 Advanced Usage

### Programmatic Access

```typescript
import fs from 'fs';
import type { Transaction } from './transformer';

// Read all transactions
const content = fs.readFileSync('.claude/logs/transactions.jsonl', 'utf-8');
const transactions: Transaction[] = content
  .trim()
  .split('\n')
  .map(line => JSON.parse(line));

// Find transactions that changed specific files
const authTransactions = transactions.filter(tx =>
  tx.files_changed.some(f => f.path.includes('auth'))
);

// Calculate average duration
const avgDuration = transactions.reduce((sum, tx) => sum + tx.duration_ms, 0) / transactions.length;
console.log(`Average transaction duration: ${avgDuration}ms`);

// Get most-used tools
const toolCounts = new Map<string, number>();
for (const tx of transactions) {
  for (const tool of tx.summary.unique_tools) {
    toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
  }
}
```

### Custom Filters

```bash
# Find transactions with file changes
jq 'select(.summary.total_files_changed > 0)' .claude/logs/transactions.jsonl

# Find slow transactions (>5s)
jq 'select(.duration_ms > 5000)' .claude/logs/transactions.jsonl

# Get all unique tools used
jq -r '.summary.unique_tools[]' .claude/logs/transactions.jsonl | sort -u

# Count transactions per session
jq -r '.session_name // .session_id' .claude/logs/transactions.jsonl | sort | uniq -c
```

### Debugging Mode

Enable detailed console output:

```bash
DEBUG_TRANSACTIONS=true claude
```

This will print transaction summaries to stderr after each Stop event.

## 📈 Analytics Examples

### 1. Productivity Dashboard

```typescript
// Most productive sessions (by file changes)
const productivity = transactions.map(tx => ({
  session: tx.session_name || tx.session_id.substring(0, 8),
  files: tx.summary.total_files_changed,
  todos: tx.summary.total_todos_created,
  duration: tx.duration_ms,
}));

productivity.sort((a, b) => b.files - a.files);
console.table(productivity.slice(0, 10));
```

### 2. Tool Usage Report

```typescript
// Generate tool usage statistics
const toolStats = new Map<string, { count: number; avgDuration: number }>();

for (const tx of transactions) {
  for (const tool of tx.summary.unique_tools) {
    const existing = toolStats.get(tool) || { count: 0, avgDuration: 0 };
    existing.count++;
    existing.avgDuration = (existing.avgDuration * (existing.count - 1) + tx.duration_ms) / existing.count;
    toolStats.set(tool, existing);
  }
}

// Sort by usage
const sorted = Array.from(toolStats.entries())
  .sort((a, b) => b[1].count - a[1].count);

console.log('\nTool Usage Statistics:');
for (const [tool, stats] of sorted) {
  console.log(`${tool}: ${stats.count} uses, avg ${stats.avgDuration}ms per transaction`);
}
```

### 3. File Change Heatmap

```typescript
// Which files get modified most?
const fileChanges = new Map<string, number>();

for (const tx of transactions) {
  for (const file of tx.files_changed) {
    const fileName = file.path.split('/').pop() || file.path;
    fileChanges.set(fileName, (fileChanges.get(fileName) || 0) + 1);
  }
}

// Sort by frequency
const topFiles = Array.from(fileChanges.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10);

console.log('\nMost Frequently Modified Files:');
for (const [file, count] of topFiles) {
  console.log(`  ${file}: ${count} changes`);
}
```

## 🛠️ Customization

### 1. Change Log Location

Edit `hook.ts`:

```typescript
const LOG_FILE = path.join(process.env.HOME, 'my-logs/transactions.jsonl');
```

### 2. Add Custom Metadata

Extend the Transaction interface in `transformer.ts`:

```typescript
export interface Transaction {
  // ... existing fields
  custom_metadata?: {
    project_name?: string;
    git_branch?: string;
    user_id?: string;
  };
}
```

### 3. Filter Specific Tools

In `transformer.ts`, modify `recordToolUse()`:

```typescript
// Only track file operations
if (!['Write', 'Edit', 'MultiEdit'].includes(toolName)) {
  return; // Skip
}
```

### 4. Add Notifications

In `hook.ts`, add alerts for large transactions:

```typescript
manager.onStop(async (input, context) => {
  const transaction = await logger.completeTransaction(input, context);

  if (transaction && transaction.summary.total_files_changed > 10) {
    console.error(`⚠️  Large transaction: ${transaction.summary.total_files_changed} files changed!`);
  }

  // ... rest of code
});
```

## 🎨 Viewer Options

| Option | Description | Example |
|--------|-------------|---------|
| `--latest N` | Show only last N transactions | `--latest 10` |
| `--session <id>` | Filter by session ID or name | `--session brave-elephant` |
| `--watch` | Live updates (tail -f style) | `--watch` |
| `--stats` | Show overall statistics | `--stats` |

## 🔍 Troubleshooting

### No transactions showing

1. **Check hook is configured:**
   ```bash
   cat .claude/settings.json | grep transaction-logger
   ```

2. **Verify log file exists:**
   ```bash
   ls -la .claude/logs/transactions.jsonl
   ```

3. **Test hook manually:**
   ```bash
   echo '{"hook_event_name":"UserPromptSubmit","transaction_id":"test-123","session_id":"test","timestamp":"2025-11-23T10:00:00Z"}' | bun hook.ts
   ```

### Hook failing silently

Enable debug mode:
```bash
DEBUG_TRANSACTIONS=true claude
```

Check for errors in Claude Code output.

### Large log files

Archive old transactions:
```bash
# Compress transactions older than 30 days
find .claude/logs -name "transactions-*.jsonl.gz" -mtime +30 -exec rm {} \;

# Archive current log
gzip .claude/logs/transactions.jsonl
mv .claude/logs/transactions.jsonl.gz .claude/logs/transactions-$(date +%Y%m%d).jsonl.gz
touch .claude/logs/transactions.jsonl
```

## 🚀 Integration Ideas

### 1. CI/CD Pipeline

Use transaction logs to verify deployment steps:

```bash
# Check if deployment todos were completed
jq 'select(.todos_created[] | select(.content | contains("deploy")) | select(.status == "completed"))' transactions.jsonl
```

### 2. Slack Notifications

Send summary to Slack after each transaction:

```typescript
manager.onStop(async (input, context) => {
  const tx = await logger.completeTransaction(input, context);

  if (tx && tx.summary.total_files_changed > 0) {
    await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🚀 ${tx.summary.total_files_changed} files changed in ${tx.session_name}`,
      }),
    });
  }

  return success();
});
```

### 3. Database Storage

Store transactions in PostgreSQL for advanced analytics:

```typescript
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

manager.onStop(async (input, context) => {
  const tx = await logger.completeTransaction(input, context);

  if (tx) {
    await pool.query(
      'INSERT INTO transactions (id, session_id, data) VALUES ($1, $2, $3)',
      [tx.transaction_id, tx.session_id, JSON.stringify(tx)]
    );
  }

  return success();
});
```

## 📚 Learn More

- [Claude Code Hooks Documentation](../../README.md)
- [TransactionLogger Transformer](./transformer.ts) - Core implementation
- [Hook Implementation](./hook.ts) - Hook wiring
- [Viewer CLI](./viewer.ts) - Beautiful terminal UI

## 🤝 Contributing

Found a bug or have an idea? Open an issue or PR!

## 📄 License

MIT - Part of claude-hooks-sdk
