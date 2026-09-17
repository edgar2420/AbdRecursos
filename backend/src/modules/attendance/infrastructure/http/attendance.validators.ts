import { z } from 'zod';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';

export const listAttendanceSchema = pageQuerySchema.extend({
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  type: z.enum(['CHECK_IN', 'CHECK_OUT']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const punchSchema = z.object({
  employeeId: z.string().uuid().optional(),
  timestamp: z.coerce.date().optional(),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  notes: z.string().trim().max(200).optional(),
});

export const reportQuerySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  includeDays: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  format: z.enum(['json', 'excel', 'pdf']).default('json'),
});

export const createJustificationSchema = z.object({
  employeeId: z.string().uuid().optional(),
  date: z.coerce.date(),
  reason: z.string().trim().min(5, 'Describa el motivo').max(300),
  attachmentUrl: z.string().url().max(500).optional(),
});

export const listJustificationsSchema = pageQuerySchema.extend({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const reviewJustificationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().trim().max(300).optional(),
});

export const attendanceIdParamSchema = z.object({ id: z.string().uuid() });

export const updateAttendanceSchema = z.object({
  timestamp: z.coerce.date().optional(),
  notes: z.string().trim().max(200).optional(),
  reason: z.string().trim().min(5, 'Describa el motivo de la modificacion').max(300),
});
