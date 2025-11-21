#!/usr/bin/env bun
/**
 * Basic Hook Example
 * Shows the simplest possible hook that logs events
 */

import { HookManager, success } from '../src/index';

const manager = new HookManager({ debug: true });

// Log all SessionStart events
manager.onSessionStart(async (input) => {
  console.log(`Session started: ${input.session_id}`);
  console.log(`Source: ${input.source}`);
  return success();
});

// Log all Stop events
manager.onStop(async (input) => {
  console.log(`Session stopping: ${input.session_id}`);
  return success();
});

manager.run();
