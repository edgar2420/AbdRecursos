import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../domain/pagination';

/** Query base de todo listado: page, limit, search, sort, order (seccion 9). */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(120).optional(),
  sort: z.string().trim().max(60).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

/** Evita ordenar por una columna arbitraria enviada por el cliente. */
export function safeSort<T extends string>(
  sort: string | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(sort as T) ? (sort as T) : fallback;
}
