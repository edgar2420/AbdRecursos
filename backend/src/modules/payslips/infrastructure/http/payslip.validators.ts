import { z } from 'zod';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';

const lineSchema = z.object({
  concept: z.string().trim().min(2).max(80),
  amount: z.coerce.number().min(0),
});

export const listPayslipsSchema = pageQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  periodYear: z.coerce.number().int().min(2000).max(2100).optional(),
  periodMonth: z.coerce.number().int().min(1).max(12).optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'CANCELLED']).optional(),
});

export const generatePayslipsSchema = z.object({
  periodYear: z.coerce.number().int().min(2000).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
  employeeIds: z.array(z.string().uuid()).optional(),
  includeAguinaldo: z.boolean().default(false),
  overwriteDrafts: z.boolean().default(true),
  overrides: z
    .array(
      z.object({
        employeeId: z.string().uuid(),
        workedDays: z.coerce.number().min(0).max(31).optional(),
        overtimeDayHours: z.coerce.number().min(0).max(200).optional(),
        overtimeNightHours: z.coerce.number().min(0).max(200).optional(),
        overtimeHolidayHours: z.coerce.number().min(0).max(200).optional(),
        fiscalCredit: z.coerce.number().min(0).optional(),
        extraEarnings: z.array(lineSchema).optional(),
        otherDeductions: z.array(lineSchema).optional(),
      }),
    )
    .optional(),
});

export const issuePayslipsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, 'Seleccione al menos una boleta'),
});

export const periodQuerySchema = z.object({
  periodYear: z.coerce.number().int().min(2000).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
});

export const aguinaldoQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  employeeId: z.string().uuid().optional(),
});

export const payslipIdParamSchema = z.object({ id: z.string().uuid() });
