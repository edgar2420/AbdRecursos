import { Router } from 'express';
import { asyncHandler } from '../../../../shared/infrastructure/http/middlewares/async-handler';
import { requireRole } from '../../../../shared/infrastructure/http/middlewares/require-role';
import { validate } from '../../../../shared/infrastructure/http/middlewares/validate';
import { pageQuerySchema } from '../../../../shared/infrastructure/http/query';
import { EmployeeController } from './employee.controller';
import {
  catalogSchema,
  createEmployeeSchema,
  deactivateEmployeeSchema,
  employeeIdParamSchema,
  listEmployeesSchema,
  updateEmployeeSchema,
} from './employee.validators';

export function employeeRoutes(controller: EmployeeController): Router {
  const router = Router();

  // --- catalogos (antes de /:id para que no los capture el parametro) ---
  router.get('/departments', validate(pageQuerySchema, 'query'), asyncHandler(controller.listDepartments));
  router.post('/departments', requireRole('HR', 'ADMIN'), validate(catalogSchema), asyncHandler(controller.createDepartment));
  router.patch(
    '/departments/:id',
    requireRole('HR', 'ADMIN'),
    validate(employeeIdParamSchema, 'params'),
    validate(catalogSchema.partial()),
    asyncHandler(controller.updateDepartment),
  );
  router.get('/positions', validate(pageQuerySchema, 'query'), asyncHandler(controller.listPositions));
  router.post('/positions', requireRole('HR', 'ADMIN'), validate(catalogSchema), asyncHandler(controller.createPosition));
  router.patch(
    '/positions/:id',
    requireRole('HR', 'ADMIN'),
    validate(employeeIdParamSchema, 'params'),
    validate(catalogSchema.partial()),
    asyncHandler(controller.updatePosition),
  );

  router.get('/options', requireRole('SUPERVISOR', 'HR', 'ADMIN'), asyncHandler(controller.options));
  router.get('/template', requireRole('HR', 'ADMIN'), asyncHandler(controller.template));
  router.get(
    '/export',
    requireRole('SUPERVISOR', 'HR', 'ADMIN'),
    validate(listEmployeesSchema, 'query'),
    asyncHandler(controller.export),
  );

  // --- CRUD ---
  // El listado completo es de Supervisor en adelante (matriz de la seccion 3); el
  // acceso a la ficha individual sigue abierto y se resuelve por propiedad en el caso de uso.
  router.get(
    '/',
    requireRole('SUPERVISOR', 'HR', 'ADMIN'),
    validate(listEmployeesSchema, 'query'),
    asyncHandler(controller.list),
  );
  router.post('/', requireRole('HR', 'ADMIN'), validate(createEmployeeSchema), asyncHandler(controller.create));
  router.get('/:id', validate(employeeIdParamSchema, 'params'), asyncHandler(controller.get));
  router.get(
    '/:id/history',
    validate(employeeIdParamSchema, 'params'),
    validate(pageQuerySchema, 'query'),
    asyncHandler(controller.history),
  );
  router.patch(
    '/:id',
    validate(employeeIdParamSchema, 'params'),
    validate(updateEmployeeSchema),
    asyncHandler(controller.update),
  );
  router.delete(
    '/:id',
    requireRole('HR', 'ADMIN'),
    validate(employeeIdParamSchema, 'params'),
    validate(deactivateEmployeeSchema),
    asyncHandler(controller.deactivate),
  );
  router.post(
    '/:id/reactivate',
    requireRole('HR', 'ADMIN'),
    validate(employeeIdParamSchema, 'params'),
    asyncHandler(controller.reactivate),
  );

  return router;
}
