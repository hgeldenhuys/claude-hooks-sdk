# Custom Backend Integration Example

This example demonstrates how to build a complete custom backend integration for Claude Code hooks, including:

- 🔌 **Custom Hook** - Posts events to a backend via HTTP
- 🖥️ **Mini Server** - Receives and displays events in real-time
- 🔐 **Authentication** - Custom header-based API key auth
- 🎨 **HTML UI** - Beautiful real-time event dashboard
- ⚡ **Error Handling** - Timeout management and graceful failures

## Architecture

```
Claude Code
    ↓
[hook.ts] ──HTTP POST──> [server.ts] ──> HTML Dashboard
    ↑                          ↓
Custom Headers          In-Memory Store
X-API-Key                   (Events)
X-Hook-Event
```

## Quick Start

### 1. Start the Server

```bash
cd examples/custom-backend
bun server.ts
```

The server will start on `http://localhost:3030` and display:
```
🚀 Claude Code Hook Events Server running at http://localhost:3030
📊 View events at http://localhost:3030/
🔑 API Key: demo-key-12345
```

### 2. Configure Claude Code Hooks

Add the hook to your `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "bun /absolute/path/to/examples/custom-backend/hook.ts"
      }
    ],
    "UserPromptSubmit": [
      {
        "type": "command",
        "command": "bun /absolute/path/to/examples/custom-backend/hook.ts"
      }
    ],
    "AssistantResponse": [
      {
        "type": "command",
        "command": "bun /absolute/path/to/examples/custom-backend/hook.ts"
      }
    ]
  }
}
```

**💡 Pro Tip:** Use absolute paths to ensure the hook can be found from any working directory.

### 3. Use Claude Code

Start a Claude Code session:

```bash
claude
```

Events will automatically post to the server and appear in the dashboard at `http://localhost:3030`!

## Features

### Server (`server.ts`)

- **POST /events** - Receives hook events from the custom hook
  - Validates API key via `X-API-Key` header
  - Stores events in memory (latest first, max 50 events)
  - Returns JSON response with success status and event count
  - Includes custom response headers (`X-Server-Version`, `X-Events-Count`)

- **GET /** - HTML dashboard showing recent events
  - Auto-refreshes every 2 seconds
  - Color-coded event types
  - Session names and IDs
  - Expandable event context
  - Beautiful gradient design

- **GET /health** - Health check endpoint
  - Returns server status, event count, and uptime

### Hook (`hook.ts`)

- **Input Handling** - Reads JSON from stdin (Claude Code protocol)
- **HTTP POST** - Sends event to backend with custom headers:
  - `X-API-Key` - Authentication
  - `X-Hook-Event` - Event type for server-side routing
  - `User-Agent` - Client identification
- **Response Handling** - Reads custom response headers
- **Timeout Management** - 5-second timeout with AbortController
- **Error Handling** - Graceful failures (doesn't block Claude Code)

## Customization

### Change API Key

**Server:**
```typescript
const API_KEY = 'your-secret-key';
```

**Hook:**
```bash
export HOOK_API_KEY=your-secret-key
```

Or set in `.claude/settings.json`:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "type": "command",
        "command": "HOOK_API_KEY=your-secret-key bun /path/to/hook.ts"
      }
    ]
  }
}
```

### Change Backend URL

```bash
export HOOK_BACKEND_URL=https://your-server.com/api/events
```

### Modify Timeout

In `hook.ts`:
```typescript
const TIMEOUT_MS = 10000; // 10 seconds
```

### Persist Events to Database

Replace the in-memory array with your database of choice:

```typescript
// Example with PostgreSQL
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// In POST /events handler:
await pool.query(
  'INSERT INTO hook_events (event_type, session_id, data) VALUES ($1, $2, $3)',
  [event.hook_event_name, event.session_id, JSON.stringify(event)]
);
```

### Add More Custom Headers

**In hook.ts:**
```typescript
headers: {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
  'X-Hook-Event': event.hook_event_name,
  'X-Session-Name': event.session_name || 'unknown',
  'X-Client-Version': '1.0.0',
  'X-Environment': process.env.NODE_ENV || 'development',
}
```

**In server.ts:**
```typescript
const sessionName = req.headers.get('X-Session-Name');
const clientVersion = req.headers.get('X-Client-Version');
console.log(`Event from ${sessionName}, client v${clientVersion}`);
```

## Testing

### Test Server Directly

```bash
# Start server
bun server.ts

# In another terminal, send a test event
curl -X POST http://localhost:3030/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key-12345" \
  -d '{
    "hook_event_name": "test_event",
    "session_id": "test-session-123",
    "timestamp": "2025-11-23T10:00:00.000Z",
    "cwd": "/test",
    "context": {
      "message": "Hello from curl!"
    }
  }'

# Check response headers
curl -X POST http://localhost:3030/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: demo-key-12345" \
  -d '{"hook_event_name":"test","session_id":"123","timestamp":"2025-11-23T10:00:00.000Z","cwd":"/test","context":{}}' \
  -v 2>&1 | grep "X-"
```

### Test Invalid API Key

```bash
curl -X POST http://localhost:3030/events \
  -H "Content-Type: application/json" \
  -H "X-API-Key: wrong-key" \
  -d '{...}'

# Should return 401 Unauthorized
```

### Test Hook Directly

```bash
# Create a test event
echo '{
  "hook_event_name": "SessionStart",
  "session_id": "test-123",
  "timestamp": "2025-11-23T10:00:00.000Z",
  "cwd": "/test",
  "context": {},
  "session_name": "test-session"
}' | bun hook.ts
```

## Advanced Use Cases

### 1. Multi-Workspace Aggregation

Run multiple Claude Code instances across different projects, all posting to the same central server:

```json
// Project A: .claude/settings.json
{
  "hooks": {
    "UserPromptSubmit": [
      { "type": "command", "command": "HOOK_BACKEND_URL=https://central.company.com/events bun hook.ts" }
    ]
  }
}

// Project B: .claude/settings.json
{
  "hooks": {
    "UserPromptSubmit": [
      { "type": "command", "command": "HOOK_BACKEND_URL=https://central.company.com/events bun hook.ts" }
    ]
  }
}
```

### 2. Event Filtering

Only send specific events:

```typescript
// In hook.ts, before posting:
const ALLOWED_EVENTS = ['SessionStart', 'UserPromptSubmit', 'ToolUse'];

if (!ALLOWED_EVENTS.includes(hookEvent.hook_event_name)) {
  console.log(JSON.stringify({ continue: true, message: 'Event filtered' }));
  process.exit(0);
}
```

### 3. Data Enrichment

Add custom metadata before posting:

```typescript
// In hook.ts:
const enrichedEvent = {
  ...hookEvent,
  custom_metadata: {
    hostname: os.hostname(),
    user: os.userInfo().username,
    platform: os.platform(),
    node_version: process.version,
  },
};

await postToBackend(enrichedEvent);
```

### 4. Webhook Forwarding

Turn the server into a webhook forwarder:

```typescript
// In server.ts POST /events handler:
// Forward to Slack, Discord, etc.
await fetch('https://hooks.slack.com/services/YOUR/WEBHOOK/URL', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: `New ${event.hook_event_name} event from ${event.session_name}`,
  }),
});
```

## Troubleshooting

### Events not appearing in dashboard

1. **Check server is running:**
   ```bash
   curl http://localhost:3030/health
   ```

2. **Check hook output:**
   ```bash
   echo '{"hook_event_name":"test",...}' | bun hook.ts
   # Should see JSON output, not errors
   ```

3. **Verify API key matches:**
   - Server: `const API_KEY = 'demo-key-12345'`
   - Hook: `export HOOK_API_KEY=demo-key-12345`

### Hook timing out

Increase timeout in `hook.ts`:
```typescript
const TIMEOUT_MS = 10000; // 10 seconds instead of 5
```

Or check server logs for slow database queries or processing.

### Server showing "Invalid API key"

Make sure the `X-API-Key` header matches:
```bash
# Check what the hook is sending
echo '{"hook_event_name":"test","session_id":"123","timestamp":"2025-11-23T10:00:00.000Z","cwd":"/test","context":{}}' \
  | HOOK_API_KEY=demo-key-12345 bun hook.ts
```

## Production Deployment

For production use, consider:

1. **Use HTTPS** - Encrypt data in transit
2. **Real Database** - Replace in-memory storage with PostgreSQL, MongoDB, etc.
3. **Authentication** - Use JWT or OAuth instead of simple API keys
4. **Rate Limiting** - Prevent abuse with rate limits
5. **Logging** - Add structured logging (e.g., Pino, Winston)
6. **Monitoring** - Track server health and errors (e.g., Datadog, New Relic)
7. **Error Recovery** - Implement retry logic with exponential backoff
8. **Load Balancing** - Scale horizontally with multiple server instances

Example production server setup:

```typescript
import { Pool } from 'pg';
import pino from 'pino';

const logger = pino();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

Bun.serve({
  port: process.env.PORT || 3030,
  async fetch(req) {
    try {
      // ... your handlers
      logger.info({ event: 'request', url: req.url });
    } catch (error) {
      logger.error({ error, event: 'request_error' });
      // ... error handling
    }
  },
});
```

## Learn More

- [Claude Code Hooks Documentation](../../README.md)
- [Hook Event Reference](../../docs/events.md)
- [Security Best Practices](../../docs/security.md)
- [Bun Documentation](https://bun.sh/docs)

## License

MIT - see [LICENSE](../../LICENSE)
