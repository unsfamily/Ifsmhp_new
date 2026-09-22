import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from 'express';
export const auditContext = new AsyncLocalStorage<{ request: Request; requestId: string }>();
