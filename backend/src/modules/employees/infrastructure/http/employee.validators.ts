import { z } from 'zod';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';

export const contractTypes = ['INDEFINIDO', 'PLAZO_FIJO', 'EVENTUAL', 'CONSULTORIA'] as const;
export const employeeStatuses = ['ACTIVE', 'ON_LEAVE', 'TERMINATED'] as const;

export const listEmployeesSchema = pageQuerySchema.extend({
  // Una nomina se lee alfabeticamente: el orden por defecto es ascendente,
  // a diferencia del resto de listados (mas recientes primero).
  order: z.enum(['asc', 'desc']).default('asc'),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  supervisorId: z.string().uuid().optional(),
  status: z.enum(employeeStatuses).optional(),
  contractType: z.enum(contractTypes).optional(),
  isActive: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  hiredFrom: z.coerce.date().optional(),
  hiredTo: z.coerce.date().optional(),
});

export const createEmployeeSchema = z.object({
  employeeCode: z.string().trim().max(20).optional(),
  firstName: z.string().trim().min(2, 'Minimo 2 caracteres').max(60),
  lastName: z.string().trim().min(2, 'Minimo 2 caracteres').max(60),
  ci: z.string().trim().min(5).max(20),
  ciExtension: z.string().trim().max(4).optional(),
  birthDate: z.coerce.date().optional(),
  gender: z.enum(['M', 'F', 'OTRO']).optional(),
  email: z.string().trim().toLowerCase().email('Correo invalido').optional(),
  phone: z.string().trim().max(25).optional(),
  address: z.string().trim().max(200).optional(),
  photoUrl: z.string().trim().url().max(500).optional(),
  hireDate: z.coerce.date(),
  contractType: z.enum(contractTypes).default('INDEFINIDO'),
  baseSalary: z.coerce.number().min(0, 'El salario no puede ser negativo'),
  bankName: z.string().trim().max(60).optional(),
  bankAccount: z.string().trim().max(40).optional(),
  afpName: z.string().trim().max(40).optional(),
  afpNumber: z.string().trim().max(40).optional(),
  emergencyContactName: z.string().trim().max(80).optional(),
  emergencyContactPhone: z.string().trim().max(25).optional(),
  emergencyContactRelation: z.string().trim().max(40).optional(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  supervisorId: z.string().uuid().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  status: z.enum(employeeStatuses).optional(),
  jobProtection: z.boolean().optional(),
  jobProtectionUntil: z.coerce.date().nullable().optional(),
  terminationDate: z.coerce.date().nullable().optional(),
});

export const deactivateEmployeeSchema = z.object({
  terminationDate: z.coerce.date().optional(),
  notes: z.string().trim().max(300).optional(),
});

export const employeeIdParamSchema = z.object({ id: z.string().uuid('Identificador invalido') });

export const catalogSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(200).optional(),
  isActive: z.boolean().optional(),
});
