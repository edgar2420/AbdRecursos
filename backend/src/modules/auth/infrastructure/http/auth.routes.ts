import { Router, RequestHandler } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { loginRateLimit } from '../../../../shared/infrastructure/http/middlewares/rate-limit';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { AuthController } from './auth.controller';
import {
  changePasswordSchema,
  createUserSchema,
  listUsersSchema,
  loginSchema,
  resetPasswordSchema,
  setActiveSchema,
  updateRoleSchema,
  userIdParamSchema,
} from './auth.validators';

export function authRoutes(controller: AuthController, authenticate: RequestHandler): Router {
  const router = Router();

  // --- publicas ---
  router.post('/login', loginRateLimit, validate(loginSchema), asyncHandler(controller.login));
  router.post('/refresh', loginRateLimit, asyncHandler(controller.refresh));
  router.post('/logout', asyncHandler(controller.logout));

  // --- autenticadas ---
  router.get('/me', authenticate, asyncHandler(controller.me));
  router.post(
    '/change-password',
    authenticate,
    validate(changePasswordSchema),
    asyncHandler(controller.changePassword),
  );

  // --- gestion de usuarios y roles: solo ADMIN (seccion 3) ---
  router.get(
    '/users',
    authenticate,
    requireRole('ADMIN'),
    validate(listUsersSchema, 'query'),
    asyncHandler(controller.listUsers),
  );
  router.post(
    '/users',
    authenticate,
    requireRole('ADMIN'),
    validate(createUserSchema),
    asyncHandler(controller.createUser),
  );
  router.patch(
    '/users/:id/role',
    authenticate,
    requireRole('ADMIN'),
    validate(userIdParamSchema, 'params'),
    validate(updateRoleSchema),
    asyncHandler(controller.updateRole),
  );
  router.patch(
    '/users/:id/active',
    authenticate,
    requireRole('ADMIN'),
    validate(userIdParamSchema, 'params'),
    validate(setActiveSchema),
    asyncHandler(controller.setActive),
  );
  router.post(
    '/users/:id/reset-password',
    authenticate,
    requireRole('ADMIN'),
    validate(userIdParamSchema, 'params'),
    validate(resetPasswordSchema),
    asyncHandler(controller.resetPassword),
  );

  return router;
}
