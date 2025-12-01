#!/usr/bin/env bun
import { HookDispatcher, builtInHandlers } from 'claude-hooks-sdk';

const dispatcher = new HookDispatcher({ logger: undefined, stopOnError: false, parallel: false });
dispatcher.registerMultiple(builtInHandlers.SessionEnd);
const userHandlers = await dispatcher.loadUserHandlers(process.cwd(), 'SessionEnd');
dispatcher.registerMultiple(userHandlers);
await dispatcher.run();
