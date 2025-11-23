/**
 * EventStreamer - Stream events to dashboards/monitoring tools in real-time
 *
 * @example
 * ```typescript
 * const streamer = new EventStreamer({
 *   type: 'sse',
 *   port: 3001,
 *   path: '/events'
 * });
 *
 * // Start the server
 * await streamer.start();
 *
 * // Broadcast events
 * manager.onPostToolUse((input) => {
 *   streamer.broadcast({
 *     type: 'file-change',
 *     file: input.tool_input.file_path,
 *     operation: input.tool_name,
 *     timestamp: Date.now()
 *   });
 * });
 * ```
 */

import * as http from 'http';

export interface EventStreamerOptions {
  /** Streaming type: 'sse' (Server-Sent Events) */
  type: 'sse';
  /** Port to listen on */
  port: number;
  /** Path for SSE endpoint */
  path?: string;
  /** Enable CORS */
  cors?: boolean;
}

export interface StreamEvent {
  type: string;
  [key: string]: any;
}

interface SSEClient {
  id: string;
  res: http.ServerResponse;
  channels: Set<string>;
}

/**
 * EventStreamer streams events via Server-Sent Events
 */
export class EventStreamer {
  private options: EventStreamerOptions;
  private server?: http.Server;
  private clients: Map<string, SSEClient> = new Map();
  private nextClientId = 1;

  constructor(options: EventStreamerOptions) {
    this.options = {
      path: '/events',
      cors: true,
      ...options,
    };
  }

  /**
   * Start the SSE server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        // CORS headers
        if (this.options.cors) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        }

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (req.url === this.options.path && req.method === 'GET') {
          this.handleSSEConnection(req, res);
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      this.server.listen(this.options.port, () => {
        console.log(`EventStreamer listening on port ${this.options.port}`);
        resolve();
      });
    });
  }

  /**
   * Handle SSE connection
   */
  private handleSSEConnection(req: http.IncomingMessage, res: http.ServerResponse): void {
    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Generate client ID
    const clientId = `client-${this.nextClientId++}`;

    // Parse channels from query string (e.g., ?channels=errors,warnings)
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const channelsParam = url.searchParams.get('channels');
    const channels = channelsParam ? new Set(channelsParam.split(',')) : new Set(['default']);

    // Store client
    const client: SSEClient = {
      id: clientId,
      res,
      channels,
    };
    this.clients.set(clientId, client);

    console.log(`Client ${clientId} connected (channels: ${Array.from(channels).join(', ')})`);

    // Send initial connection event
    this.sendEvent(res, {
      type: 'connected',
      clientId,
      channels: Array.from(channels),
    });

    // Handle client disconnect
    req.on('close', () => {
      this.clients.delete(clientId);
      console.log(`Client ${clientId} disconnected`);
    });

    // Keep connection alive with periodic pings
    const pingInterval = setInterval(() => {
      if (!res.destroyed) {
        res.write(': ping\n\n');
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);

    req.on('close', () => {
      clearInterval(pingInterval);
    });
  }

  /**
   * Send an SSE event to a response
   */
  private sendEvent(res: http.ServerResponse, event: StreamEvent): void {
    if (res.destroyed) return;

    const data = JSON.stringify(event);
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${data}\n\n`);
  }

  /**
   * Broadcast an event to all clients or specific channel
   */
  broadcast(event: StreamEvent, channel: string = 'default'): void {
    for (const client of this.clients.values()) {
      if (client.channels.has(channel) || client.channels.has('*')) {
        this.sendEvent(client.res, event);
      }
    }
  }

  /**
   * Send an event to a specific client
   */
  send(clientId: string, event: StreamEvent): void {
    const client = this.clients.get(clientId);
    if (client) {
      this.sendEvent(client.res, event);
    }
  }

  /**
   * Get the number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all client IDs
   */
  getClientIds(): string[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      // Close all client connections
      for (const client of this.clients.values()) {
        if (!client.res.destroyed) {
          client.res.end();
        }
      }
      this.clients.clear();

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('EventStreamer stopped');
          resolve();
        }
      });
    });
  }
}

/**
 * EventClient - Client for consuming SSE events
 *
 * @example
 * ```typescript
 * const client = new EventClient('http://localhost:3001/events');
 * client.on('file-change', (data) => {
 *   console.log('File changed:', data.file);
 * });
 * await client.connect();
 * ```
 */
export class EventClient {
  private url: string;
  private eventSource?: any; // Using 'any' since EventSource is browser API
  private handlers: Map<string, Array<(data: any) => void>> = new Map();

  constructor(url: string, channels?: string[]) {
    // Add channels to URL if specified
    if (channels && channels.length > 0) {
      const separator = url.includes('?') ? '&' : '?';
      url += `${separator}channels=${channels.join(',')}`;
    }
    this.url = url;
  }

  /**
   * Register an event handler
   */
  on(eventType: string, handler: (data: any) => void): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Connect to the event stream
   */
  connect(): void {
    if (typeof EventSource === 'undefined') {
      throw new Error('EventSource is not available in this environment');
    }

    this.eventSource = new (EventSource as any)(this.url);

    // Handle all registered event types
    for (const [eventType, handlers] of this.handlers.entries()) {
      this.eventSource.addEventListener(eventType, (event: any) => {
        const data = JSON.parse(event.data);
        for (const handler of handlers) {
          handler(data);
        }
      });
    }

    // Handle connection events
    this.eventSource.onopen = () => {
      console.log('Connected to event stream');
    };

    this.eventSource.onerror = (error: any) => {
      console.error('Event stream error:', error);
    };
  }

  /**
   * Disconnect from the event stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = undefined;
    }
  }
}
