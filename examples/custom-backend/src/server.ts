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
        const payload: HookEvent = await req.json();

        // Add to front of array (latest first)
        events.unshift(payload);

        // Keep only MAX_EVENTS
        if (events.length > MAX_EVENTS) {
          events.pop();
        }

        // Handle both HookEventPayload and flat structures for logging
        const isPayloadStructure = (payload as any).event !== undefined;
        const event = isPayloadStructure ? (payload as any).event : payload;
        const eventName = event.hook_event_name || 'unknown';
        const sessionName = event.session_name || 'unnamed';
        const sessionId = event.session_id ? event.session_id.substring(0, 8) : 'unknown';

        console.log(`📥 Received ${eventName} event from session ${sessionName} (${sessionId})`);

        // Debug: log full payload structure
        if (isPayloadStructure) {
          console.log(`   └─ Has conversation: ${(payload as any).conversation ? 'yes' : 'no'}`);
        }

        // Debug: log tool name for PostToolUse events
        if (eventName === 'PostToolUse' && event.tool_name) {
          console.log(`   └─ Tool: ${event.tool_name}`);
        }

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

    // GET /chat - Conversation view
    if (req.method === 'GET' && url.pathname === '/chat') {
      const html = generateChatPage();
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'X-Server-Version': '1.0.0',
        },
      });
    }

    // GET /file-changes - File operations view
    if (req.method === 'GET' && url.pathname === '/file-changes') {
      const html = generateFileChangesPage();
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'X-Server-Version': '1.0.0',
        },
      });
    }

    // GET /transactions - Detailed event timeline
    if (req.method === 'GET' && url.pathname === '/transactions') {
      const html = generateTransactionsPage();
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'X-Server-Version': '1.0.0',
        },
      });
    }

    // GET /context-usage - Context window usage tracker
    if (req.method === 'GET' && url.pathname === '/context-usage') {
      const html = generateContextUsagePage();
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html',
          'X-Server-Version': '1.0.0',
        },
      });
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
      <div style="display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
        <a href="/" style="padding: 8px 16px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: 600;">Events</a>
        <a href="/chat" style="padding: 8px 16px; background: #f0f0f0; color: #667eea; text-decoration: none; border-radius: 5px; font-weight: 600;">Chat</a>
        <a href="/file-changes" style="padding: 8px 16px; background: #f0f0f0; color: #667eea; text-decoration: none; border-radius: 5px; font-weight: 600;">File Changes</a>
        <a href="/transactions" style="padding: 8px 16px; background: #f0f0f0; color: #667eea; text-decoration: none; border-radius: 5px; font-weight: 600;">Transactions</a>
        <a href="/context-usage" style="padding: 8px 16px; background: #f0f0f0; color: #667eea; text-decoration: none; border-radius: 5px; font-weight: 600;">Context Usage</a>
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

function generateEventCard(payload: HookEvent): string {
  // Handle HookEventPayload structure (event, conversation, timestamp)
  // Also support legacy flat structure for backwards compatibility
  const isPayloadStructure = (payload as any).event !== undefined;
  const event = isPayloadStructure ? (payload as any).event : payload;
  const conversation = isPayloadStructure ? (payload as any).conversation : null;
  const payloadTimestamp = isPayloadStructure ? (payload as any).timestamp : null;

  const eventType = event.hook_event_name || 'unknown';
  const badgeClass = `badge-${eventType.toLowerCase()}`;

  // Use payload timestamp if available, otherwise fall back to event timestamp
  const timestamp = payloadTimestamp || event.timestamp
    ? new Date(payloadTimestamp || event.timestamp).toLocaleString()
    : 'No timestamp';

  const sessionName = event.session_name || 'unnamed';
  const sessionId = (event.session_id || 'unknown').substring(0, 8);

  // Extract key details from event
  const contextDetails: string[] = [];

  // User message from event or conversation
  const userMessage = event.prompt || conversation?.content;
  if (userMessage) {
    contextDetails.push(`<div class="detail-row">
      <span class="detail-label">Message:</span>
      <span class="detail-value">${escapeHtml(String(userMessage).substring(0, 200))}${String(userMessage).length > 200 ? '...' : ''}</span>
    </div>`);
  }

  // Tool name
  const toolName = event.tool_name;
  if (toolName) {
    contextDetails.push(`<div class="detail-row">
      <span class="detail-label">Tool:</span>
      <span class="detail-value">${escapeHtml(String(toolName))}</span>
    </div>`);
  }

  // Model
  const model = event.model;
  if (model) {
    contextDetails.push(`<div class="detail-row">
      <span class="detail-label">Model:</span>
      <span class="detail-value">${escapeHtml(String(model))}</span>
    </div>`);
  }

  // CWD (working directory)
  const cwd = event.cwd;
  if (cwd) {
    contextDetails.push(`<div class="detail-row">
      <span class="detail-label">Directory:</span>
      <span class="detail-value">${escapeHtml(String(cwd))}</span>
    </div>`);
  }

  // Show conversation context if available
  if (conversation && conversation.role && conversation.content) {
    const role = String(conversation.role);
    const content = String(conversation.content);
    contextDetails.push(`<div class="detail-row">
      <span class="detail-label">Conversation:</span>
      <span class="detail-value">${escapeHtml(role)}: ${escapeHtml(content.substring(0, 100))}${content.length > 100 ? '...' : ''}</span>
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
        <summary style="cursor: pointer; color: #667eea; font-weight: 600;">View full payload</summary>
        <pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
      </details>
    </div>
  `;
}

function generateChatPage(): string {
  // Build complete conversation from all recentConversation arrays
  const allMessages: Array<{ role: string; content: string; timestamp: string; type: string }> = [];
  const seenMessages = new Set<string>();

  // Collect all conversation messages from payloads
  for (const payload of events) {
    const isPayloadStructure = (payload as any).event !== undefined;
    const event = isPayloadStructure ? (payload as any).event : payload;
    const recentConv = isPayloadStructure ? (payload as any).recentConversation : null;
    const payloadTimestamp = isPayloadStructure ? (payload as any).timestamp : new Date().toISOString();

    // Check for user prompt directly in event (UserPromptSubmit)
    if (event.hook_event_name === 'UserPromptSubmit' && event.prompt) {
      const msgHash = `user:${event.prompt.substring(0, 100)}`;
      if (!seenMessages.has(msgHash)) {
        seenMessages.add(msgHash);
        allMessages.push({
          role: 'user',
          content: event.prompt,
          timestamp: payloadTimestamp,
          type: 'user',
        });
      }
    }

    if (recentConv && Array.isArray(recentConv)) {
      for (const line of recentConv) {
        // Transcript lines have type: 'user' or 'assistant'
        if (!line || !line.message) continue;

        const msg = line.message;

        if (line.type === 'user' && typeof msg.content === 'string') {
          // User messages have string content
          const msgHash = `user:${msg.content.substring(0, 100)}`;
          if (!seenMessages.has(msgHash)) {
            seenMessages.add(msgHash);
            allMessages.push({
              role: 'user',
              content: msg.content,
              timestamp: line.timestamp || payloadTimestamp,
              type: 'user',
            });
          }
        } else if (line.type === 'assistant' && Array.isArray(msg.content)) {
          // Assistant messages have text and thinking blocks
          const textBlocks: string[] = [];
          const thinkingBlocks: string[] = [];

          for (const block of msg.content) {
            if (block.type === 'text') {
              textBlocks.push(block.text);
            } else if (block.type === 'thinking') {
              thinkingBlocks.push(block.thinking);
            }
          }

          const textContent = textBlocks.join('\n\n');
          const thinkingContent = thinkingBlocks.join('\n\n');

          if (textContent || thinkingContent) {
            const msgHash = `assistant:${textContent.substring(0, 100)}`;
            if (!seenMessages.has(msgHash)) {
              seenMessages.add(msgHash);
              allMessages.push({
                role: 'assistant',
                content: textContent,
                timestamp: line.timestamp || payloadTimestamp,
                type: 'assistant',
                thinking: thinkingContent || undefined,
              } as any);
            }
          }
        }
      }
    }
  }

  // Sort by timestamp if available
  allMessages.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });

  const chatHtml = allMessages.length === 0
    ? '<div class="empty-chat">No conversation events yet</div>'
    : allMessages.map((msg) => {
        if (msg.role === 'user') {
          return `
            <div class="chat-message user-message">
              <div class="message-header">
                <span class="message-author">👤 User</span>
                <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              <div class="message-content">${escapeHtml(msg.content)}</div>
            </div>
          `;
        } else if (msg.role === 'assistant') {
          const thinking = (msg as any).thinking;
          return `
            <div class="chat-message assistant-message">
              <div class="message-header">
                <span class="message-author">🤖 Assistant</span>
                <span class="message-time">${new Date(msg.timestamp).toLocaleTimeString()}</span>
              </div>
              ${thinking ? `
                <details class="thinking-block">
                  <summary>💭 Thinking</summary>
                  <div class="thinking-content">${escapeHtml(thinking)}</div>
                </details>
              ` : ''}
              ${msg.content ? `<div class="message-content">${escapeHtml(msg.content)}</div>` : ''}
            </div>
          `;
        }
        return '';
      }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Chat Conversation - Claude Code Events</title>
  <script src="https://cdn.jsdelivr.net/npm/marked@11.0.0/marked.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 900px;
      margin: 0 auto;
    }
    .header {
      background: white;
      padding: 20px 30px;
      border-radius: 15px;
      margin-bottom: 20px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    }
    .header h1 {
      color: #333;
      font-size: 24px;
      margin-bottom: 10px;
    }
    .nav {
      display: flex;
      gap: 15px;
      margin-top: 15px;
    }
    .nav a {
      color: #667eea;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 8px;
      background: #f0f0f0;
      transition: all 0.2s;
    }
    .nav a:hover { background: #e0e0e0; }
    .nav a.active { background: #667eea; color: white; }
    .chat-container {
      background: white;
      border-radius: 15px;
      padding: 20px;
      min-height: 500px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column-reverse;
    }
    .chat-message {
      margin-bottom: 20px;
      padding: 15px;
      border-radius: 10px;
    }
    .user-message {
      background: #e3f2fd;
      margin-left: 10%;
    }
    .assistant-message {
      background: #f5f5f5;
      margin-right: 10%;
    }
    .message-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .message-author {
      font-weight: 600;
      color: #555;
    }
    .message-time {
      color: #999;
      font-size: 12px;
    }
    .message-content {
      color: #333;
      line-height: 1.6;
    }
    .message-content p { margin: 0 0 10px 0; }
    .message-content p:last-child { margin-bottom: 0; }
    .message-content pre {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 5px;
      overflow-x: auto;
      margin: 10px 0;
    }
    .message-content code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
      font-size: 0.9em;
    }
    .message-content pre code {
      background: none;
      padding: 0;
    }
    .message-content ul, .message-content ol {
      margin: 10px 0;
      padding-left: 25px;
    }
    .message-content li {
      margin: 5px 0;
    }
    .thinking-block {
      margin-bottom: 10px;
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 10px;
      border-radius: 5px;
    }
    .thinking-block summary {
      cursor: pointer;
      font-weight: 600;
      color: #856404;
      user-select: none;
    }
    .thinking-content {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #ffeaa7;
      color: #856404;
      line-height: 1.6;
      font-size: 14px;
    }
    .thinking-content p { margin: 0 0 8px 0; }
    .thinking-content p:last-child { margin-bottom: 0; }
    .thinking-content code {
      background: #ffe8a1;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: monospace;
      font-size: 0.9em;
    }
    .chat-event {
      text-align: center;
      padding: 10px;
      color: #999;
      font-size: 14px;
      margin: 10px 0;
    }
    .event-icon { margin-right: 8px; }
    .empty-chat {
      text-align: center;
      padding: 50px;
      color: #999;
      font-size: 18px;
    }
  </style>
  <script>
    // Configure marked for safe rendering
    marked.setOptions({
      breaks: true,
      gfm: true,
    });

    // Render markdown in message content
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('.message-content').forEach(el => {
        const markdown = el.textContent;
        el.innerHTML = marked.parse(markdown);
      });

      document.querySelectorAll('.thinking-content').forEach(el => {
        const markdown = el.textContent;
        el.innerHTML = marked.parse(markdown);
      });
    });

    setInterval(() => location.reload(), 5000);
  </script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💬 Chat Conversation</h1>
      <div class="nav">
        <a href="/">Events</a>
        <a href="/chat" class="active">Chat</a>
        <a href="/file-changes">File Changes</a>
        <a href="/transactions">Transactions</a>
      </div>
    </div>
    <div class="chat-container">
      ${chatHtml}
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generateFileChangesPage(): string {
  // Extract file operation events
  const fileOps = events
    .map((payload) => {
      const isPayloadStructure = (payload as any).event !== undefined;
      const event = isPayloadStructure ? (payload as any).event : payload;
      const payloadTimestamp = isPayloadStructure ? (payload as any).timestamp : null;

      if (event.hook_event_name !== 'PostToolUse') return null;

      const toolName = event.tool_name;
      const toolInput = event.tool_input || {};

      if (!['Read', 'Write', 'Edit', 'Glob', 'Grep'].includes(toolName)) return null;

      return {
        toolName,
        filePath: toolInput.file_path || toolInput.path || toolInput.pattern || 'N/A',
        timestamp: payloadTimestamp || event.timestamp || new Date().toISOString(),
        details: toolInput,
      };
    })
    .filter(Boolean)
    .reverse();

  const fileOpsHtml = fileOps.length === 0
    ? '<div class="empty-state">No file operations yet</div>'
    : fileOps.map((op: any) => `
        <div class="file-op">
          <div class="op-header">
            <span class="op-type op-${op.toolName.toLowerCase()}">${op.toolName}</span>
            <span class="op-time">${new Date(op.timestamp).toLocaleString()}</span>
          </div>
          <div class="op-file">${escapeHtml(op.filePath)}</div>
          <details class="op-details">
            <summary>View details</summary>
            <pre>${escapeHtml(JSON.stringify(op.details, null, 2))}</pre>
          </details>
        </div>
      `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>File Changes - Claude Code Events</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: white;
      padding: 20px 30px;
      border-radius: 15px;
      margin-bottom: 20px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    }
    .header h1 { color: #333; font-size: 24px; margin-bottom: 10px; }
    .nav {
      display: flex;
      gap: 15px;
      margin-top: 15px;
    }
    .nav a {
      color: #667eea;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 8px;
      background: #f0f0f0;
      transition: all 0.2s;
    }
    .nav a:hover { background: #e0e0e0; }
    .nav a.active { background: #667eea; color: white; }
    .file-op {
      background: white;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 15px;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
    }
    .op-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .op-type {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .op-read { background: #d1ecf1; color: #0c5460; }
    .op-write { background: #d4edda; color: #155724; }
    .op-edit { background: #fff3cd; color: #856404; }
    .op-glob { background: #e2e3e5; color: #383d41; }
    .op-grep { background: #f8d7da; color: #721c24; }
    .op-time { color: #999; font-size: 14px; }
    .op-file {
      font-family: 'Courier New', monospace;
      background: #f5f5f5;
      padding: 10px;
      border-radius: 5px;
      margin: 10px 0;
      color: #333;
      font-size: 14px;
    }
    .op-details { margin-top: 10px; }
    .op-details summary {
      cursor: pointer;
      color: #667eea;
      font-weight: 600;
      padding: 5px 0;
    }
    .op-details pre {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 5px;
      margin-top: 10px;
      overflow-x: auto;
      font-size: 12px;
    }
    .empty-state {
      background: white;
      padding: 50px;
      border-radius: 15px;
      text-align: center;
      color: #999;
      font-size: 18px;
    }
  </style>
  <script>
    setInterval(() => location.reload(), 5000);
  </script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📁 File Changes</h1>
      <div class="nav">
        <a href="/">Events</a>
        <a href="/chat">Chat</a>
        <a href="/file-changes" class="active">File Changes</a>
        <a href="/transactions">Transactions</a>
      </div>
    </div>
    ${fileOpsHtml}
  </div>
</body>
</html>
  `.trim();
}

function generateTransactionsPage(): string {
  // All events in detailed timeline view
  const transactions = events
    .map((payload) => {
      const isPayloadStructure = (payload as any).event !== undefined;
      const event = isPayloadStructure ? (payload as any).event : payload;
      const conversation = isPayloadStructure ? (payload as any).conversation : null;
      const payloadTimestamp = isPayloadStructure ? (payload as any).timestamp : null;

      return {
        eventType: event.hook_event_name || 'unknown',
        sessionName: event.session_name || 'unnamed',
        sessionId: event.session_id ? event.session_id.substring(0, 8) : 'unknown',
        timestamp: payloadTimestamp || event.timestamp || new Date().toISOString(),
        hasConversation: !!conversation,
        toolName: event.tool_name,
        fullPayload: payload,
      };
    })
    .reverse();

  const transactionsHtml = transactions.length === 0
    ? '<div class="empty-state">No transactions yet</div>'
    : transactions.map((tx) => `
        <tr>
          <td class="tx-time">${new Date(tx.timestamp).toLocaleString()}</td>
          <td><span class="tx-event badge-${tx.eventType.toLowerCase()}">${tx.eventType}</span></td>
          <td class="tx-session">${escapeHtml(tx.sessionName)} <span class="tx-id">(${tx.sessionId})</span></td>
          <td class="tx-tool">${tx.toolName || '-'}</td>
          <td class="tx-conv">${tx.hasConversation ? '✓' : '-'}</td>
          <td>
            <details>
              <summary class="tx-details-btn">View JSON</summary>
              <pre>${escapeHtml(JSON.stringify(tx.fullPayload, null, 2))}</pre>
            </details>
          </td>
        </tr>
      `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Transactions - Claude Code Events</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    .header {
      background: white;
      padding: 20px 30px;
      border-radius: 15px;
      margin-bottom: 20px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    }
    .header h1 { color: #333; font-size: 24px; margin-bottom: 10px; }
    .nav {
      display: flex;
      gap: 15px;
      margin-top: 15px;
    }
    .nav a {
      color: #667eea;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 8px;
      background: #f0f0f0;
      transition: all 0.2s;
    }
    .nav a:hover { background: #e0e0e0; }
    .nav a.active { background: #667eea; color: white; }
    .tx-table {
      background: white;
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #667eea;
      color: white;
      padding: 15px;
      text-align: left;
      font-weight: 600;
    }
    td {
      padding: 15px;
      border-bottom: 1px solid #f0f0f0;
    }
    tr:hover { background: #f9f9f9; }
    .tx-time { color: #666; font-size: 14px; min-width: 180px; }
    .tx-event {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      display: inline-block;
    }
    .badge-sessionstart { background: #d4edda; color: #155724; }
    .badge-userpromptsubmit { background: #d1ecf1; color: #0c5460; }
    .badge-posttooluse { background: #fff3cd; color: #856404; }
    .badge-stop { background: #f8d7da; color: #721c24; }
    .badge-pretooluse { background: #e2e3e5; color: #383d41; }
    .tx-session { color: #333; }
    .tx-id { color: #999; font-size: 12px; }
    .tx-tool { font-family: monospace; color: #667eea; }
    .tx-conv { text-align: center; color: #28a745; }
    .tx-details-btn {
      cursor: pointer;
      color: #667eea;
      font-size: 12px;
      font-weight: 600;
    }
    pre {
      background: #f5f5f5;
      padding: 10px;
      border-radius: 5px;
      margin-top: 10px;
      overflow-x: auto;
      font-size: 11px;
      max-height: 400px;
      overflow-y: auto;
    }
    .empty-state {
      background: white;
      padding: 50px;
      border-radius: 15px;
      text-align: center;
      color: #999;
      font-size: 18px;
    }
  </style>
  <script>
    setInterval(() => location.reload(), 5000);
  </script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Event Transactions</h1>
      <div class="nav">
        <a href="/">Events</a>
        <a href="/chat">Chat</a>
        <a href="/file-changes">File Changes</a>
        <a href="/transactions" class="active">Transactions</a>
      </div>
    </div>
    <div class="tx-table">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Event</th>
            <th>Session</th>
            <th>Tool</th>
            <th>Conv</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${transactionsHtml}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function generateContextUsagePage(): string {
  // Track context/token usage across events
  const usageStats = {
    totalEvents: events.length,
    toolUses: 0,
    reads: 0,
    writes: 0,
    edits: 0,
    totalConversationLength: 0,
    sessionsTracked: new Set<string>(),
    eventsByType: {} as Record<string, number>,
  };

  events.forEach((payload) => {
    const isPayloadStructure = (payload as any).event !== undefined;
    const event = isPayloadStructure ? (payload as any).event : payload;
    const conversation = isPayloadStructure ? (payload as any).conversation : null;

    const eventType = event.hook_event_name || 'unknown';
    usageStats.eventsByType[eventType] = (usageStats.eventsByType[eventType] || 0) + 1;

    if (event.session_id) {
      usageStats.sessionsTracked.add(event.session_id);
    }

    if (eventType === 'PostToolUse') {
      usageStats.toolUses++;
      if (event.tool_name === 'Read') usageStats.reads++;
      if (event.tool_name === 'Write') usageStats.writes++;
      if (event.tool_name === 'Edit') usageStats.edits++;
    }

    if (conversation && conversation.content) {
      usageStats.totalConversationLength += String(conversation.content).length;
    }
  });

  const eventTypeRows = Object.entries(usageStats.eventsByType)
    .sort(([, a], [, b]) => b - a)
    .map(([type, count]) => `
      <tr>
        <td class="ctx-event-type">${escapeHtml(type)}</td>
        <td class="ctx-count">${count}</td>
        <td class="ctx-percentage">${((count / usageStats.totalEvents) * 100).toFixed(1)}%</td>
      </tr>
    `).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Context Usage - Claude Code Events</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .header {
      background: white;
      padding: 20px 30px;
      border-radius: 15px;
      margin-bottom: 20px;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    }
    .header h1 { color: #333; font-size: 24px; margin-bottom: 10px; }
    .nav {
      display: flex;
      gap: 15px;
      margin-top: 15px;
    }
    .nav a {
      color: #667eea;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 8px;
      background: #f0f0f0;
      transition: all 0.2s;
    }
    .nav a:hover { background: #e0e0e0; }
    .nav a.active { background: #667eea; color: white; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      padding: 25px;
      border-radius: 10px;
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
    }
    .stat-label {
      color: #999;
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .stat-value {
      color: #333;
      font-size: 32px;
      font-weight: 700;
    }
    .stat-icon {
      font-size: 24px;
      margin-right: 10px;
    }
    .event-breakdown {
      background: white;
      border-radius: 15px;
      overflow: hidden;
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    }
    .event-breakdown h2 {
      background: #667eea;
      color: white;
      padding: 20px;
      margin: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th {
      background: #f5f5f5;
      padding: 15px;
      text-align: left;
      font-weight: 600;
      color: #555;
    }
    td {
      padding: 15px;
      border-bottom: 1px solid #f0f0f0;
    }
    tr:hover { background: #f9f9f9; }
    .ctx-event-type { color: #333; font-weight: 500; }
    .ctx-count { color: #667eea; font-weight: 600; font-size: 18px; }
    .ctx-percentage { color: #999; }
  </style>
  <script>
    setInterval(() => location.reload(), 5000);
  </script>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Context Usage Analytics</h1>
      <div class="nav">
        <a href="/">Events</a>
        <a href="/chat">Chat</a>
        <a href="/file-changes">File Changes</a>
        <a href="/transactions">Transactions</a>
        <a href="/context-usage" class="active">Context Usage</a>
      </div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">📦 Total Events</div>
        <div class="stat-value">${usageStats.totalEvents}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">🔧 Tool Uses</div>
        <div class="stat-value">${usageStats.toolUses}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">📖 File Reads</div>
        <div class="stat-value">${usageStats.reads}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">✏️ File Edits</div>
        <div class="stat-value">${usageStats.edits}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">💾 File Writes</div>
        <div class="stat-value">${usageStats.writes}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">🎯 Sessions</div>
        <div class="stat-value">${usageStats.sessionsTracked.size}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">💬 Conv. Chars</div>
        <div class="stat-value">${usageStats.totalConversationLength.toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">📈 Event Types</div>
        <div class="stat-value">${Object.keys(usageStats.eventsByType).length}</div>
      </div>
    </div>

    <div class="event-breakdown">
      <h2>Event Type Breakdown</h2>
      <table>
        <thead>
          <tr>
            <th>Event Type</th>
            <th>Count</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${eventTypeRows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
  `.trim();
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
