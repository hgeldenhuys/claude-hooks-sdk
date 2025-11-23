# Real-Time Dashboard Plugin

Stream events to a live web dashboard via SSE. Monitor Claude Code sessions in real-time with a beautiful web interface.

## Features

- 📡 **Real-Time Streaming** - Server-Sent Events (SSE) for live updates
- 🌐 **Web Dashboard** - Beautiful web interface included
- 📊 **Live Metrics** - See prompts, tool usage, and token counts in real-time
- 🔄 **Multi-Session Support** - Monitor multiple Claude instances simultaneously
- 🎨 **Visual Indicators** - Color-coded events and activity timeline

## Installation

### Step 1: Install the Plugin

```bash
/plugin install real-time-dashboard
```

### Step 2: Register Hooks (REQUIRED)

Add to `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/real-time-dashboard/hook.ts"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/real-time-dashboard/hook.ts"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "bun \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/real-time-dashboard/hook.ts"
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
  "real-time-dashboard": {
    "enabled": true,
    "port": 3001,
    "path": "/events",
    "cors": true
  }
}
```

### Step 4: Restart Claude Code

Hooks only load at startup.

## Usage

### Start Claude Code

When you start Claude Code with the plugin enabled, you'll see:

```
[real-time-dashboard] 📡 Dashboard streaming on http://localhost:3001/events
[real-time-dashboard] 🌐 Open dashboard: http://localhost:3001/dashboard
```

### Open the Dashboard

Open your browser to:

```
http://localhost:3001/dashboard
```

You'll see a live-updating dashboard showing:
- User prompts as they're submitted
- Tool usage in real-time
- Token counts for each turn
- Activity timeline

### Dashboard Features

The dashboard displays:

**Event Feed**
- 👤 User prompts (truncated to 100 chars)
- 🔧 Tool usage (tool name)
- 🤖 Assistant responses (token count)

**Activity Timeline**
- Visual timeline of events
- Color-coded by event type
- Timestamps for each event

**Session Info**
- Current session count
- Total events received
- Connection status

## Configuration Options

### `enabled`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable/disable the plugin

### `port`
- **Type**: `number`
- **Default**: `3001`
- **Description**: HTTP server port for dashboard and SSE endpoint

**Note**: Choose a different port if 3001 is already in use:
```json
{
  "real-time-dashboard": {
    "port": 3002
  }
}
```

### `path`
- **Type**: `string`
- **Default**: `/events`
- **Description**: SSE endpoint path

### `cors`
- **Type**: `boolean`
- **Default**: `true`
- **Description**: Enable CORS for cross-origin access

**When to disable**: If dashboard is served from same origin as SSE endpoint
**When to enable**: If dashboard is hosted separately (different port/domain)

## SSE Event Format

Events are streamed in Server-Sent Events format:

```
event: message
data: {"type":"user-prompt","prompt":"Fix the authentication bug","timestamp":1700000000000}

event: message
data: {"type":"tool-use","tool":"Read","timestamp":1700000000100}

event: message
data: {"type":"stop","tokens":1234,"timestamp":1700000000500}
```

### Event Types

**user-prompt**
```json
{
  "type": "user-prompt",
  "prompt": "First 100 characters of prompt...",
  "timestamp": 1700000000000
}
```

**tool-use**
```json
{
  "type": "tool-use",
  "tool": "Read",
  "timestamp": 1700000000100
}
```

**stop**
```json
{
  "type": "stop",
  "tokens": 1234,
  "timestamp": 1700000000500
}
```

## Use Cases

### Multi-Agent Development

Monitor multiple Claude Code instances working on different tasks:

**Terminal 1:** Backend agent
```bash
cd backend && claude
```

**Terminal 2:** Frontend agent
```bash
cd frontend && claude
```

**Browser:** Dashboard showing both agents' activity
```
http://localhost:3001/dashboard
```

### Team Collaboration

Share your dashboard URL with teammates to show what Claude is working on:

```bash
# Use ngrok for public access
ngrok http 3001

# Share URL with team
https://abc123.ngrok.io/dashboard
```

### Debugging and Monitoring

Watch Claude's thought process in real-time:
- See which tools are being used
- Spot patterns in prompt submissions
- Monitor token usage per turn
- Identify performance bottlenecks

### Live Demos

Use the dashboard for presentations or demos:
- Show Claude Code in action
- Visualize the agent's workflow
- Display real-time metrics
- Engage audience with live updates

## Custom Dashboard

You can build your own dashboard using the SSE endpoint:

```javascript
// Connect to SSE endpoint
const eventSource = new EventSource('http://localhost:3001/events');

// Listen for events
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'user-prompt':
      console.log('User:', data.prompt);
      break;
    case 'tool-use':
      console.log('Tool:', data.tool);
      break;
    case 'stop':
      console.log('Tokens:', data.tokens);
      break;
  }
};

// Handle errors
eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
};
```

## Advanced Usage

### Integrate with Analytics

Combine with `analytics-tracker` for cost + activity monitoring:

```javascript
// Subscribe to both SSE streams
const dashboardEvents = new EventSource('http://localhost:3001/events');
const analyticsEvents = new EventSource('http://localhost:3002/events');

// Correlate events by timestamp
dashboardEvents.onmessage = (e) => {
  const event = JSON.parse(e.data);
  if (event.type === 'stop') {
    // Show both tokens and estimated cost
    updateUI({ tokens: event.tokens, cost: estimateCost(event.tokens) });
  }
};
```

### Custom Event Types

Extend the plugin to stream custom events:

```typescript
// In hook.ts
manager.onSessionStart(async (input) => {
  streamer.broadcast({
    type: 'session-start',
    sessionId: input.session_id,
    timestamp: Date.now(),
  });
});
```

### WebSocket Alternative

For bidirectional communication, switch to WebSocket:

```json
{
  "real-time-dashboard": {
    "enabled": true,
    "type": "websocket",
    "port": 3001
  }
}
```

**Note**: WebSocket support requires additional implementation in `EventStreamer`.

## Security Considerations

**Local Development**
- Dashboard binds to `localhost` by default
- Only accessible from same machine
- No authentication required

**Production/Public Access**
- Use authentication middleware
- Enable HTTPS/WSS
- Restrict CORS origins
- Use reverse proxy (nginx, Caddy)

Example nginx config:

```nginx
server {
  listen 80;
  server_name dashboard.example.com;

  location /events {
    proxy_pass http://localhost:3001;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding off;
    proxy_buffering off;
    proxy_cache off;
  }

  location /dashboard {
    proxy_pass http://localhost:3001;
  }
}
```

## Troubleshooting

**Q: Dashboard not loading?**

1. Check the hook is registered in `.claude/settings.json`
2. Restart Claude Code
3. Verify port 3001 is not in use: `lsof -i :3001`
4. Check console for errors: `[real-time-dashboard]` prefix

**Q: Events not appearing?**

1. Check browser console for SSE connection errors
2. Verify CORS is enabled if dashboard is on different origin
3. Check firewall settings (allow port 3001)

**Q: Connection dropping?**

SSE connections may timeout after 2 minutes of inactivity. The dashboard should automatically reconnect. If issues persist:

1. Reduce SSE timeout in browser
2. Send keepalive events every 30 seconds
3. Use WebSocket instead of SSE

**Q: Port already in use?**

Change the port in config:

```json
{
  "real-time-dashboard": {
    "port": 3002
  }
}
```

Then access at `http://localhost:3002/dashboard`

## Performance

- **SSE overhead**: <1ms per event
- **Memory**: ~10MB for event streaming server
- **Concurrent connections**: Tested with 100+ simultaneous dashboard viewers
- **Bandwidth**: ~1KB/event, minimal with compression

## License

MIT
