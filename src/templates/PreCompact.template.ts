#!/usr/bin/env bun
import { HookDispatcher, builtInHandlers } from 'claude-hooks-sdk';

const dispatcher = new HookDispatcher({ logger: undefined, stopOnError: false, parallel: false });
dispatcher.registerMultiple(builtInHandlers.PreCompact);
const userHandlers = await dispatcher.loadUserHandlers(process.cwd(), 'PreCompact');
dispatcher.registerMultiple(userHandlers);
await dispatcher.run();
