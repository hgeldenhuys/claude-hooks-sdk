#!/usr/bin/env bun

/**
 * Example: Custom Hook with Backend Integration
 *
 * This demonstrates how to build a custom hook that:
 * - Receives hook events from Claude Code
 * - Posts events to a backend server via HTTP
 * - Handles authentication with custom headers
 * - Returns the backend response to Claude Code
 * - Includes error handling and timeout management
 *
 * Usage:
 * 1. Start the server: bun server.ts
 * 2. Configure in .claude/settings.json:
 *    {
 *      "hooks": {
 *        "SessionStart": [
 *          { "type": "command", "command": "bun /path/to/hook.ts" }
 *        ],
 *        "UserPromptSubmit": [
 *          { "type": "command", "command": "bun /path/to/hook.ts" }
 *        ]
 *      }
 *    }
 * 3. Use Claude Code - events will be posted to the server
 */

interface HookInput {
  hook_event_name: string;
  session_id: string;
  timestamp: string;
  cwd: string;
  context: Record<string, unknown>;
  session_name?: string;
}

interface HookOutput {
  continue: boolean;
  message?: string;
}

interface BackendResponse {
  success: boolean;
  message?: string;
  total_events?: number;
  error?: string;
}

const BACKEND_URL = process.env.HOOK_BACKEND_URL || 'http://localhost:3030/events';
const API_KEY = process.env.HOOK_API_KEY || 'demo-key-12345';
const TIMEOUT_MS = 5000; // 5 second timeout

async function main() {
  try {
    // Read input from stdin (Claude Code sends hook data as JSON)
    const input = await readStdin();
    const hookEvent: HookInput = JSON.parse(input);

    // Post event to backend
    const response = await postToBackend(hookEvent);

    // Return success to Claude Code
    const output: HookOutput = {
      continue: true,
      message: response.message || `Posted ${hookEvent.hook_event_name} to backend`,
    };

    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (error) {
    // On error, still continue (don't block Claude Code)
    const output: HookOutput = {
      continue: true,
      message: `Backend hook error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };

    console.error(JSON.stringify(output));
    process.exit(0);
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of Bun.stdin.stream()) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf-8');
}

async function postToBackend(event: HookInput): Promise<BackendResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY, // Custom authentication header
        'X-Hook-Event': event.hook_event_name, // Custom metadata header
        'User-Agent': 'claude-hooks-sdk/custom-backend-example',
      },
      body: JSON.stringify(event),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Backend returned ${response.status}: ${errorBody}`);
    }

    // Read custom response headers
    const serverVersion = response.headers.get('X-Server-Version');
    const eventsCount = response.headers.get('X-Events-Count');

    const result: BackendResponse = await response.json();

    // Optionally log custom headers
    if (serverVersion) {
      console.error(`[Backend] Server version: ${serverVersion}`);
    }
    if (eventsCount) {
      console.error(`[Backend] Total events stored: ${eventsCount}`);
    }

    return result;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Backend request timed out after ${TIMEOUT_MS}ms`);
    }

    throw error;
  }
}

main();
