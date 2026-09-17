import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '../../../domain/errors';

type Source = 'body' | 'query' | 'params';

export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return next(new ValidationError('Datos invalidos', details));
    }
    if (source === 'body') req.body = result.data;
    else (req as unknown as Record<string, unknown>)[`validated_${source}`] = result.data;
    next();
  };
}

export function validated<T>(req: Request, source: Source): T {
  if (source === 'body') return req.body as T;
  return (req as unknown as Record<string, unknown>)[`validated_${source}`] as T;
}
