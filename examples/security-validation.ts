#!/usr/bin/env bun
/**
 * Security Validation Hook
 * Blocks dangerous bash commands
 */

import { HookManager, block, success } from '../src/index';

const manager = new HookManager();

manager.onPreToolUse(async (input) => {
  // Only validate Bash tool
  if (input.tool_name !== 'Bash') {
    return success();
  }

  const command = input.tool_input.command as string;

  // Block dangerous commands
  const dangerousPatterns = [
    /rm\s+-rf\s+\//,           // rm -rf /
    /mkfs/,                     // Format filesystem
    /dd\s+if=/,                 // Disk duplication (can be dangerous)
    /:\(\)\{\s*:\|:&\s*\};:/,   // Fork bomb
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(command)) {
      return block(`Blocked dangerous command: ${command}`);
    }
  }

  // Warn about sudo
  if (command.includes('sudo')) {
    return {
      exitCode: 0,
      stdout: '⚠️  Warning: Command uses sudo',
      output: {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: 'Command requires elevated privileges',
        },
      },
    };
  }

  return success();
});

manager.run();
