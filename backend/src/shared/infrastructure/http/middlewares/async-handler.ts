import { NextFunction, Request, Response } from 'express';

/** Evita try/catch repetido: cualquier rechazo va al error handler central. */
export const asyncHandler =
  <T extends Request>(fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req as T, res, next)).catch(next);
  };
