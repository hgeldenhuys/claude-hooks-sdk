#!/usr/bin/env bun

/**
 * Example: Mini Bun Server for Claude Code Hook Events
 *
 * This demonstrates how to build a simple backend that:
 * - Receives hook events via HTTP POST
 * - Stores events in memory
 * - Renders an HTML page showing recent events
 * - Uses custom headers for API key authentication
 *
 * Run with: bun server.ts
 * View at: http://localhost:3030
 */

interface HookEvent {
  hook_event_name: string;
  session_id: string;
  timestamp: string;
  context?: Record<string, unknown>;
  session_name?: string;
  [key: string]: unknown;
}

// In-memory store for events (latest first)
const events: HookEvent[] = [];
const MAX_EVENTS = 50;

// Simple API key for demonstration
const API_KEY = 'demo-key-12345';

const server = Bun.serve({
  port: 3030,
  async fetch(req) {
    const url = new URL(req.url);

    // POST /events - Receive hook events
    if (req.method === 'POST' && url.pathname === '/events') {
      // Check custom X-API-Key header
      const apiKey = req.headers.get('X-API-Key');
      if (apiKey !== API_KEY) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid API key' }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              'X-Server-Version': '1.0.0', // Custom header example
            },
          }
        );
      }

      try {
        const event: HookEvent = await req.json();

        // Add to front of array (latest first)
        events.unshift(event);

        // Keep only MAX_EVENTS
        if (events.length > MAX_EVENTS) {
          events.pop();
        }

        console.log(`📥 Received ${event.hook_event_name} event from session ${event.session_name || event.session_id.substring(0, 8)}`);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Event received',
            total_events: events.length,
          }),
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'X-Server-Version': '1.0.0',
              'X-Events-Count': events.length.toString(),
            },
          }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }
    }

    // GET / - Display HTML page with events
    if (req.method === 'GET' && url.pathname === '/') {
      const html = generateHtmlPage();
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'X-Server-Version': '1.0.0',
        },
      });
    }

    // GET /health - Health check
    if (req.method === 'GET' && url.pathname === '/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          events_count: events.length,
          uptime_seconds: Math.floor(process.uptime()),
        }),
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Server-Version': '1.0.0',
          },
        }
      );
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`🚀 Claude Code Hook Events Server running at http://localhost:${server.port}`);
console.log(`📊 View events at http://localhost:${server.port}/`);
console.log(`🔑 API Key: ${API_KEY}`);

function generateHtmlPage(): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claude Code Hook Events</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
    }

    header {
      background: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      margin-bottom: 30px;
    }

    h1 {
      color: #333;
      font-size: 32px;
      margin-bottom: 10px;
    }

    .stats {
      display: flex;
      gap: 20px;
      margin-top: 15px;
    }

    .stat {
      background: #f7fafc;
      padding: 10px 20px;
      border-radius: 5px;
      font-size: 14px;
      color: #555;
    }

    .stat strong {
      color: #667eea;
    }

    .events-container {
      display: grid;
      gap: 15px;
    }

    .event-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .event-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
    }

    .event-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 15px;
      border-bottom: 2px solid #f0f0f0;
    }

    .event-type {
      font-size: 18px;
      font-weight: 600;
      color: #333;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .event-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }

    .badge-session_start { background: #d4edda; color: #155724; }
    .badge-user_prompt_submit { background: #d1ecf1; color: #0c5460; }
    .badge-assistant_response { background: #fff3cd; color: #856404; }
    .badge-tool_use { background: #f8d7da; color: #721c24; }
    .badge-default { background: #e2e3e5; color: #383d41; }

    .event-time {
      font-size: 14px;
      color: #888;
    }

    .event-details {
      display: grid;
      gap: 10px;
    }

    .detail-row {
      display: flex;
      align-items: flex-start;
      gap: 10px;
    }

    .detail-label {
      font-weight: 600;
      color: #555;
      min-width: 100px;
    }

    .detail-value {
      color: #333;
      word-break: break-word;
      flex: 1;
    }

    .session-name {
      color: #667eea;
      font-weight: 600;
    }

    .session-id {
      font-family: 'Courier New', monospace;
      font-size: 12px;
      color: #888;
    }

    pre {
      background: #f7fafc;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      font-size: 13px;
      margin-top: 10px;
    }

    .empty-state {
      background: white;
      padding: 60px 20px;
      border-radius: 10px;
      text-align: center;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.1);
    }

    .empty-state h2 {
      color: #333;
      margin-bottom: 10px;
    }

    .empty-state p {
      color: #888;
      line-height: 1.6;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .event-card {
      animation: fadeIn 0.3s ease-out;
    }
  </style>
  <script>
    // Smart polling - only reload if event count changes
    let lastEventCount = ${events.length};

    setInterval(async () => {
      try {
        const response = await fetch('/health');
        const data = await response.json();

        if (data.events_count !== lastEventCount) {
          lastEventCount = data.events_count;
          location.reload();
        }
      } catch (error) {
        console.error('Failed to check for updates:', error);
      }
    }, 2000);
  </script>
</head>
<body>
  <div class="container">
    <header>
      <h1>🤖 Claude Code Hook Events</h1>
      <p style="color: #666; margin-top: 5px;">Real-time monitoring of Claude Code hook events</p>
      <div class="stats">
        <div class="stat"><strong>${events.length}</strong> events</div>
        <div class="stat"><strong>${new Set(events.map(e => e.session_id)).size}</strong> sessions</div>
        <div class="stat">Last updated: <strong>${new Date().toLocaleTimeString()}</strong></div>
      </div>
    </header>

    <div class="events-container">
      ${events.length === 0 ? generateEmptyState() : events.map(generateEventCard).join('')}
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generateEmptyState(): string {
  return `
    <div class="empty-state">
      <h2>No events yet</h2>
      <p>Waiting for Claude Code hook events...<br>Make sure your hook is configured to POST to <code>http://localhost:3030/events</code></p>
    </div>
  `;
}

function generateEventCard(event: HookEvent): string {
  // Handle both flat and nested structures (event.hook.*)
  const hookData = (event as any).hook || event;

  const eventType = event.hook_event_name || hookData.hook_event_name || 'unknown';
  const badgeClass = `badge-${eventType.toLowerCase()}`;

  // Handle missing or invalid timestamps
  const eventTimestamp = event.timestamp || hookData.timestamp || (event as any)._enriched_at;
  const timestamp = eventTimestamp
    ? new Date(eventTimestamp).toLocaleString()
    : 'No timestamp';

  const sessionName = event.session_name || 'unnamed';
  const sessionId = (event.session_id || hookData.session_id || 'unknown').substring(0, 8);

  // Extract key details from event (check both top-level, nested, and context)
  const contextDetails: string[] = [];

  // User message (could be in multiple places)
  const userMessage = (event as any).prompt_text || hookData.prompt_text || (event as any).user_prompt || event.context?.user_message;
  if (userMessage) {
    contextDetails.push(`<div class="detail-row">
      <span class="detail-label">Message:</span>
      <span class="detail-value">${escapeHtml(String(userMessage).substring(0, 200))}${String(userMessage).length > 200 ? '...' : ''}</span>
    </div>`);
  }

  // Tool name (could be top-level, nested, or in context)
  const toolName = (event as any).tool_name || hookData.tool_name || event.context?.tool_name;
  if (toolName) {
    contextDetails.push(`<div class="detail-row">
      <span class="detail-label">Tool:</span>
      <span class="detail-value">${escapeHtml(String(toolName))}</span>
    </div>`);
  }

  // Model
  const model = (event as any).model || hookData.model || event.context?.model;
  if (model) {
    contextDetails.push(`<div class="detail-row">
      <span class="detail-label">Model:</span>
      <span class="detail-value">${escapeHtml(String(model))}</span>
    </div>`);
  }

  // CWD (working directory)
  const cwd = (event as any).cwd || hookData.cwd;
  if (cwd) {
    contextDetails.push(`<div class="detail-row">
      <span class="detail-label">Directory:</span>
      <span class="detail-value">${escapeHtml(String(cwd))}</span>
    </div>`);
  }

  return `
    <div class="event-card">
      <div class="event-header">
        <div class="event-type">
          <span class="event-badge ${badgeClass}">${eventType}</span>
        </div>
        <div class="event-time">${timestamp}</div>
      </div>
      <div class="event-details">
        <div class="detail-row">
          <span class="detail-label">Session:</span>
          <span class="detail-value">
            <span class="session-name">${escapeHtml(sessionName)}</span>
            <span class="session-id">(${sessionId})</span>
          </span>
        </div>
        ${contextDetails.join('')}
      </div>
      <details style="margin-top: 15px;">
        <summary style="cursor: pointer; color: #667eea; font-weight: 600;">View full event payload</summary>
        <pre>${JSON.stringify(event, null, 2)}</pre>
      </details>
    </div>
  `;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}
