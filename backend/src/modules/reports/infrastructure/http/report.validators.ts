import { z } from 'zod';
import { fechaLocal } from '../../../../shared/infrastructure/http/fecha-local';

export const dashboardQuerySchema = z.object({
  from: fechaLocal.optional(),
  to: fechaLocal.optional(),
  departmentId: z.string().uuid().optional(),
});

export const payrollQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
