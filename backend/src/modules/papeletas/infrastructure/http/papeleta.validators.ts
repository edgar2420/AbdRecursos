import { z } from 'zod';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';

const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Formato de hora invalido (HH:mm)');

export const listPapeletasSchema = pageQuerySchema.extend({
  tipo: z.enum(['HORAS_EXTRAS', 'SALIDA']).optional(),
  estado: z
    .enum(['PENDIENTE_JEFE_AREA', 'PENDIENTE_RRHH', 'APROBADA', 'RECHAZADA', 'ANULADA'])
    .optional(),
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

export const crearHorasExtrasSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    fecha: z.coerce.date(),
    trabajoRealizado: z.string().trim().min(5, 'Describa el trabajo realizado').max(300),
    desde: z.coerce.date(),
    hasta: z.coerce.date(),
    recargo: z.enum(['DIURNA', 'NOCTURNA', 'FERIADO']).default('DIURNA'),
  })
  .refine((v) => v.hasta > v.desde, {
    message: 'La hora final debe ser posterior a la inicial',
    path: ['hasta'],
  });

export const crearSalidaSchema = z.object({
  employeeId: z.string().uuid().optional(),
  fecha: z.coerce.date(),
  salidaMotivo: z.enum(['PARTICULAR', 'OFICIAL', 'MEDICA']),
  motivo: z.string().trim().min(4, 'Indique el motivo').max(300),
  tiempoSolicitado: z.string().trim().min(1).max(60),
  horaSalida: hora,
  horaRetorno: hora.optional(),
  // Ruta relativa que devuelve /api/v1/uploads: nunca una URL externa arbitraria.
  attachmentUrl: z.string().trim().regex(/^\/uploads\/[a-f0-9-]+\.\w+$/).max(300).optional(),
});

export const rechazarSchema = z.object({
  motivo: z.string().trim().min(5, 'Indique el motivo del rechazo').max(300),
});

export const papeletaIdParamSchema = z.object({ id: z.string().uuid() });
