import { z } from 'zod';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';

export const listAuditLogsSchema = pageQuerySchema.extend({
  entity: z.string().trim().max(60).optional(),
  action: z.string().trim().max(80).optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
