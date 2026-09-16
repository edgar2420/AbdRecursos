import { z } from 'zod';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';

const passwordRules = z
  .string()
  .min(10, 'Minimo 10 caracteres')
  .max(128)
  .regex(/[a-z]/, 'Debe incluir una minuscula')
  .regex(/[A-Z]/, 'Debe incluir una mayuscula')
  .regex(/\d/, 'Debe incluir un numero');

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo invalido'),
  password: z.string().min(1, 'La contrasena es obligatoria').max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordRules,
});

export const createUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: passwordRules,
  role: z.enum(['EMPLOYEE', 'SUPERVISOR', 'HR', 'ADMIN']),
  employeeId: z.string().uuid().optional(),
});

export const updateRoleSchema = z.object({
  role: z.enum(['EMPLOYEE', 'SUPERVISOR', 'HR', 'ADMIN']),
});

export const setActiveSchema = z.object({ isActive: z.boolean() });

export const resetPasswordSchema = z.object({ newPassword: passwordRules });

export const listUsersSchema = pageQuerySchema.extend({
  role: z.enum(['EMPLOYEE', 'SUPERVISOR', 'HR', 'ADMIN']).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});

export const userIdParamSchema = z.object({ id: z.string().uuid() });
