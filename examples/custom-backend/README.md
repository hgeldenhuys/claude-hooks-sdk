# Custom Backend Example

Real-time hook event visualization server with conversation tracking, file change monitoring, and analytics.

## Features

### Event Dashboard (`/`)
- Real-time hook event monitoring
- Smart polling - only refreshes when new events arrive (no janky page flashing)
- Session name display with friendly names (e.g., "mutual-lion")
- Collapsible JSON payload viewer with HTML escaping
- Event type badges and timestamps

### Chat View (`/chat`)
- Full conversation timeline with user and assistant messages
- **Markdown rendering** - Code blocks, links, lists, and formatting
- **Thinking blocks** - Collapsible 💭 sections showing AI reasoning
- **Latest-first display** - Most recent messages at top (CSS flexbox reverse)
- **Instant user message display** - Shows prompts immediately from UserPromptSubmit events
- Message timestamps and role indicators

### File Changes (`/file-changes`)
- Track Read/Write/Edit/Glob/Grep operations
- File path display with timestamps
- Collapsible tool input details

### Transactions (`/transactions`)
- Detailed event timeline table
- All event types with full metadata

### Context Usage (`/context-usage`)
- Analytics on event types and tool usage
- Session activity tracking
- Event count statistics

## Quick Start

```bash
# Start the server
bun src/server.ts

# Configure hook (in .claude/settings.json)
{
  "hooks": {
    "SessionStart": [
      { "type": "command", "command": "bun $CLAUDE_PROJECT_DIR/.claude/examples/custom-backend/src/hook.ts" }
    ],
    "UserPromptSubmit": [
      { "type": "command", "command": "bun $CLAUDE_PROJECT_DIR/.claude/examples/custom-backend/src/hook.ts" }
    ],
    "PostToolUse": [
      { "type": "command", "command": "bun $CLAUDE_PROJECT_DIR/.claude/examples/custom-backend/src/hook.ts" }
    ],
    "Stop": [
      { "type": "command", "command": "bun $CLAUDE_PROJECT_DIR/.claude/examples/custom-backend/src/hook.ts" }
    ]
  }
}
```

## How It Works

1. **Hook** (`src/hook.ts`):
   - Receives events from Claude Code via stdin
   - Reads transcript file for conversation context
   - Creates `HookEventPayload` with event + conversation + timestamp
   - POSTs to backend server

2. **Server** (`src/server.ts`):
   - Stores events in-memory (latest 50)
   - Serves multiple views for different use cases
   - Auto-refreshes UI every 5 seconds

## API Endpoints

- `POST /events` - Receive hook events (requires API key)
- `GET /` - Event dashboard
- `GET /chat` - Conversation view
- `GET /file-changes` - File operations tracker
- `GET /transactions` - Detailed event timeline
- `GET /context-usage` - Usage analytics
- `GET /health` - Health check

## Configuration

Environment variables:
- `HOOK_BACKEND_URL` - Backend URL (default: `http://localhost:3030/events`)
- `HOOK_API_KEY` - API key for authentication (default: `demo-key-12345`)

## Architecture

Built with:
- **Bun** - Runtime and HTTP server
- **claude-hooks-sdk** - Session naming and transcript parsing
- **marked.js** - Markdown rendering in chat view (CDN)
- **Pure TypeScript** - No build step or bundler required

## Development

```bash
# Run server
bun src/server.ts

# Run tests (when added)
bun test

# Lint/format
bun run lint
```
