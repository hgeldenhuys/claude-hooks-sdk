# File Auditor Plugin

Comprehensive file change tracking with audit trails. Track every Write, Edit, and MultiEdit operation with timestamps and session IDs.

## Features

- 📝 **Complete Audit Trail** - Track all file Write/Edit/MultiEdit operations
- 📊 **Session Summaries** - View all files modified in a session
- 🔍 **Operation Tracking** - See exactly what changes were made
- 💾 **Audit Logs** - Persistent log file with timestamps and session IDs
- 📈 **Change Statistics** - Count operations by type

## Installation

### Step 1: Install the Plugin

```bash
/plugin install file-auditor
```

### Step 2: Register Hooks (REQUIRED)

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/file-auditor/hook.ts"
          }
        ]
      }
    ],
    "SessionEnd": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/file-auditor/hook.ts"
          }
        ]
      }
    ]
  }
}
```

### Step 3: Configure (Optional)

Create or edit `.claude-plugin/config.json`:

```json
{
  "file-auditor": {
    "enabled": true,
    "auditLogPath": ".claude/file-audit.log",
    "gitIntegration": false
  }
}
```

### Step 4: Restart Claude Code

Hooks only load at startup.

## Usage

Once enabled, all file operations are automatically tracked:

```bash
# File operations are logged in real-time
[file-auditor] 📝 WRITE: src/components/Button.tsx
[file-auditor] 📝 EDIT: src/utils/helpers.ts
[file-auditor] 📝 WRITE: src/pages/Home.tsx
```

At session end, you'll see a summary:

```
[file-auditor] 📊 File Change Summary
  Total changes: 12
  Files modified: 8
  Operations: write(5), edit(7)

  Files:
    - src/components/Button.tsx
    - src/utils/helpers.ts
    - src/pages/Home.tsx
    - src/styles/globals.css
    - package.json
    - README.md
    - src/components/Header.tsx
    - src/hooks/useAuth.ts
```

## Audit Log Format

The audit log (`.claude/file-audit.log`) uses a simple pipe-delimited format:

```
2025-11-23T12:34:56.789Z | WRITE | src/components/Button.tsx | session:abc-123-def-456
2025-11-23T12:35:12.345Z | EDIT | src/utils/helpers.ts | session:abc-123-def-456
2025-11-23T12:36:05.678Z | WRITE | src/pages/Home.tsx | session:abc-123-def-456
```

### Fields

1. **Timestamp** - ISO 8601 format
2. **Operation** - WRITE, EDIT, or MULTIEDIT
3. **File Path** - Absolute or relative path to the file
4. **Session ID** - Claude Code session identifier

## Use Cases

### Compliance and Auditing

Track all code changes for compliance requirements:

```bash
# View all changes today
grep "$(date +%Y-%m-%d)" .claude/file-audit.log

# Count changes by file
cat .claude/file-audit.log | cut -d'|' -f3 | sort | uniq -c | sort -rn

# Find changes by session
grep "session:abc-123" .claude/file-audit.log
```

### Change Analysis

Understand what files are modified most frequently:

```bash
# Top 10 most modified files
cat .claude/file-audit.log | cut -d'|' -f3 | sort | uniq -c | sort -rn | head -10

# Changes in last hour
find .claude/file-audit.log -mmin -60 -exec cat {} \;
```

### Session Investigation

Review exactly what changed in a specific session:

```bash
# Get session ID from conversation log
SESSION_ID="abc-123-def-456"

# View all file changes for that session
grep "session:$SESSION_ID" .claude/file-audit.log
```

### Integration with Git

Verify that all Claude Code changes were committed:

```bash
# Get list of files modified by Claude
cat .claude/file-audit.log | cut -d'|' -f3 | sort -u > /tmp/claude-changes.txt

# Compare with git status
git status --short | awk '{print $2}' > /tmp/git-changes.txt

# Find uncommitted changes
comm -23 /tmp/claude-changes.txt /tmp/git-changes.txt
```

## Configuration Options

### `enabled`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable/disable the plugin

### `auditLogPath`
- **Type**: `string`
- **Default**: `.claude/file-audit.log`
- **Description**: Path to audit log file (relative to project root)

### `gitIntegration`
- **Type**: `boolean`
- **Default**: `false`
- **Description**: Enable git integration (experimental)

## Performance

File auditor has minimal performance impact:
- **Per file operation**: <1ms overhead
- **Disk I/O**: Append-only writes (very fast)
- **Memory**: Tracks only current session in memory

## Troubleshooting

**Q: No audit log appearing?**

1. Check `.claude/settings.json` has PostToolUse hook registered
2. Restart Claude Code
3. Verify log directory exists: `mkdir -p .claude`

**Q: Audit log too large?**

Rotate logs periodically:

```bash
# Archive old logs
mv .claude/file-audit.log .claude/file-audit-$(date +%Y%m%d).log
gzip .claude/file-audit-*.log

# Or truncate after analysis
: > .claude/file-audit.log
```

**Q: Missing some file changes?**

The plugin only tracks Claude Code file operations (Write, Edit, MultiEdit). Manual file edits or changes from other tools won't appear in the audit log.

## License

MIT
