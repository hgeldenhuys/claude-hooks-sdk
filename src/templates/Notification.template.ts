#!/usr/bin/env bun
import { HookDispatcher, builtInHandlers } from 'claude-hooks-sdk';

const dispatcher = new HookDispatcher({ logger: undefined, stopOnError: false, parallel: false });
dispatcher.registerMultiple(builtInHandlers.Notification);
const userHandlers = await dispatcher.loadUserHandlers(process.cwd(), 'Notification');
dispatcher.registerMultiple(userHandlers);
await dispatcher.run();
