import { NextFunction, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { AuthenticatedRequest } from '../types';

export function requestId(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && incoming.length <= 64 ? incoming : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}
