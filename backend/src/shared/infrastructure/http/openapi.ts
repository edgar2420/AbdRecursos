import { env } from '../config/env';

/**
 * Documentacion de la API mantenida junto a las rutas (seccion 11).
 * Se sirve en /docs (Swagger UI) y /openapi.json.
 */
const pageParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
  { name: 'limit', in: 'query', schema: { type: 'integer', default: 10, maximum: 100 } },
  { name: 'search', in: 'query', schema: { type: 'string' } },
  { name: 'sort', in: 'query', schema: { type: 'string' } },
  { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
];

const paginated = (item: string) => ({
  type: 'object',
  properties: {
    data: { type: 'array', items: { $ref: `#/components/schemas/${item}` } },
    meta: { $ref: '#/components/schemas/PageMeta' },
  },
});

function crud(tag: string, name: string, schema: string) {
  return {
    get: {
      tags: [tag],
      summary: `Listar ${name} (paginado, busqueda y filtros)`,
      parameters: pageParams,
      responses: { '200': { description: 'OK', content: { 'application/json': { schema: paginated(schema) } } } },
    },
    post: {
      tags: [tag],
      summary: `Crear ${name}`,
      responses: { '201': { description: 'Creado' }, '403': { description: 'Sin permisos' } },
    },
  };
}

function crudItem(tag: string, name: string, schema: string) {
  return {
    parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
    get: {
      tags: [tag],
      summary: `Obtener ${name} por id (verifica propiedad del recurso)`,
      responses: {
        '200': { description: 'OK', content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } } },
        '403': { description: 'Recurso ajeno' },
        '404': { description: 'No encontrado' },
      },
    },
    patch: { tags: [tag], summary: `Actualizar ${name}`, responses: { '200': { description: 'OK' } } },
    delete: { tags: [tag], summary: `Desactivar ${name} (borrado logico)`, responses: { '204': { description: 'Sin contenido' } } },
  };
}

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'SGRH API - Sistema de Gestion de Recursos Humanos (Bolivia)',
    version: '1.0.0',
    description:
      'API del SGRH. Autenticacion JWT (access token en header Authorization, refresh token en cookie httpOnly). ' +
      'Todos los listados soportan page, limit, search, sort y order.',
  },
  servers: [{ url: `${env.HTTPS_ENABLED ? 'https' : 'http'}://localhost:${env.PORT}${env.API_PREFIX}` }],
  tags: [
    { name: 'Auth', description: 'Autenticacion, refresco de token y gestion de usuarios' },
    { name: 'Empleados', description: 'CRUD de empleados, historial y carga masiva' },
    { name: 'Vacaciones', description: 'Solicitudes, aprobaciones y saldos' },
    { name: 'Boletas', description: 'Generacion, consulta y descarga de boletas de pago' },
    { name: 'Lactancia', description: 'Permisos de lactancia (Ley 3460)' },
    { name: 'Asistencia', description: 'Marcaciones, tardanzas y justificaciones' },
    { name: 'Horarios', description: 'Horarios y asignacion de turnos' },
    { name: 'Reportes', description: 'Dashboard, KPIs y exportaciones' },
    { name: 'Importaciones', description: 'Carga masiva de Excel con vista previa' },
    { name: 'Parametros legales', description: 'Valores parametrizables de la normativa boliviana' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      PageMeta: {
        type: 'object',
        properties: {
          total: { type: 'integer' },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          totalPages: { type: 'integer' },
        },
      },
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              requestId: { type: 'string' },
            },
          },
        },
      },
      Employee: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          employeeCode: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          ci: { type: 'string' },
          hireDate: { type: 'string', format: 'date' },
          contractType: { type: 'string' },
          baseSalary: { type: 'number' },
          department: { type: 'string', nullable: true },
          position: { type: 'string', nullable: true },
          status: { type: 'string' },
          isActive: { type: 'boolean' },
        },
      },
      VacationRequest: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          employeeId: { type: 'string', format: 'uuid' },
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' },
          workingDays: { type: 'number' },
          status: {
            type: 'string',
            enum: ['PENDING_SUPERVISOR', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED'],
          },
        },
      },
      Payslip: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          periodYear: { type: 'integer' },
          periodMonth: { type: 'integer' },
          totalEarnings: { type: 'number' },
          totalDeductions: { type: 'number' },
          netPay: { type: 'number' },
          status: { type: 'string' },
        },
      },
      LactationPermit: { type: 'object' },
      AttendanceRecord: { type: 'object' },
      Schedule: { type: 'object' },
      LegalParameter: {
        type: 'object',
        properties: {
          key: { type: 'string' },
          value: { type: 'string' },
          valueType: { type: 'string' },
          validFrom: { type: 'string', format: 'date' },
          validUntil: { type: 'string', format: 'date', nullable: true },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        security: [],
        summary: 'Iniciar sesion (rate limit agresivo)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: { email: { type: 'string' }, password: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Access token + refresh en cookie httpOnly' },
          '401': { description: 'Credenciales invalidas' },
          '429': { description: 'Demasiados intentos' },
        },
      },
    },
    '/auth/refresh': {
      post: { tags: ['Auth'], security: [], summary: 'Rotar refresh token', responses: { '200': { description: 'OK' } } },
    },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Cerrar sesion', responses: { '204': { description: 'OK' } } } },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Perfil del usuario autenticado', responses: { '200': { description: 'OK' } } } },
    '/auth/change-password': {
      post: { tags: ['Auth'], summary: 'Cambiar contrasena propia', responses: { '204': { description: 'OK' } } },
    },
    '/auth/users': crud('Auth', 'usuarios del sistema (solo ADMIN)', 'Error'),
    '/employees': crud('Empleados', 'empleados', 'Employee'),
    '/employees/{id}': crudItem('Empleados', 'empleado', 'Employee'),
    '/employees/{id}/history': {
      get: { tags: ['Empleados'], summary: 'Historial de cambios del empleado', responses: { '200': { description: 'OK' } } },
    },
    '/employees/template': {
      get: { tags: ['Empleados'], summary: 'Descargar plantilla Excel de carga masiva', responses: { '200': { description: 'Archivo xlsx' } } },
    },
    '/vacations/requests': crud('Vacaciones', 'solicitudes de vacaciones', 'VacationRequest'),
    '/vacations/requests/{id}': crudItem('Vacaciones', 'solicitud', 'VacationRequest'),
    '/vacations/requests/{id}/approve': {
      post: { tags: ['Vacaciones'], summary: 'Aprobar (supervisor o RRHH segun el flujo configurado)', responses: { '200': { description: 'OK' } } },
    },
    '/vacations/requests/{id}/reject': {
      post: { tags: ['Vacaciones'], summary: 'Rechazar solicitud', responses: { '200': { description: 'OK' } } },
    },
    '/vacations/balance/{employeeId}': {
      get: { tags: ['Vacaciones'], summary: 'Saldo de dias segun antiguedad', responses: { '200': { description: 'OK' } } },
    },
    '/vacations/calendar': {
      get: { tags: ['Vacaciones'], summary: 'Calendario de equipo (evitar solapamientos)', responses: { '200': { description: 'OK' } } },
    },
    '/payslips': crud('Boletas', 'boletas', 'Payslip'),
    '/payslips/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: {
        tags: ['Boletas'],
        summary: 'Obtener boleta (el empleado solo puede ver la propia)',
        responses: { '200': { description: 'OK' }, '403': { description: 'Boleta ajena' } },
      },
    },
    '/payslips/{id}/pdf': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
      get: { tags: ['Boletas'], summary: 'Descargar boleta en PDF', responses: { '200': { description: 'application/pdf' } } },
    },
    '/payslips/generate': {
      post: { tags: ['Boletas'], summary: 'Generar boletas de un periodo (RRHH/Admin)', responses: { '201': { description: 'Generadas' } } },
    },
    '/payslips/bulk-pdf': {
      get: { tags: ['Boletas'], summary: 'Descargar ZIP de boletas de un periodo', responses: { '200': { description: 'application/zip' } } },
    },
    '/lactation': crud('Lactancia', 'permisos de lactancia', 'LactationPermit'),
    '/lactation/{id}': crudItem('Lactancia', 'permiso', 'LactationPermit'),
    '/lactation/expiring': {
      get: { tags: ['Lactancia'], summary: 'Permisos proximos a vencer', responses: { '200': { description: 'OK' } } },
    },
    '/attendance': crud('Asistencia', 'marcaciones', 'AttendanceRecord'),
    '/attendance/check-in': { post: { tags: ['Asistencia'], summary: 'Marcar entrada', responses: { '201': { description: 'OK' } } } },
    '/attendance/check-out': { post: { tags: ['Asistencia'], summary: 'Marcar salida', responses: { '201': { description: 'OK' } } } },
    '/attendance/report': {
      get: { tags: ['Asistencia'], summary: 'Reporte de asistencia por empleado/equipo/departamento', responses: { '200': { description: 'OK' } } },
    },
    '/attendance/justifications': crud('Asistencia', 'justificaciones', 'Error'),
    '/schedules': crud('Horarios', 'horarios', 'Schedule'),
    '/schedules/{id}': crudItem('Horarios', 'horario', 'Schedule'),
    '/schedules/assignments': crud('Horarios', 'asignaciones de horario', 'Error'),
    '/reports/dashboard': {
      get: { tags: ['Reportes'], summary: 'KPIs del dashboard', responses: { '200': { description: 'OK' } } },
    },
    '/reports/headcount': {
      get: { tags: ['Reportes'], summary: 'Reporte de headcount por departamento', responses: { '200': { description: 'OK' } } },
    },
    '/imports': {
      get: { tags: ['Importaciones'], summary: 'Historial de importaciones', parameters: pageParams, responses: { '200': { description: 'OK' } } },
      post: { tags: ['Importaciones'], summary: 'Subir Excel y previsualizar filas validas/erroneas', responses: { '201': { description: 'Vista previa' } } },
    },
    '/imports/{id}/confirm': {
      post: { tags: ['Importaciones'], summary: 'Confirmar y procesar las filas validas', responses: { '200': { description: 'Procesado' } } },
    },
    '/imports/{id}/log': {
      get: { tags: ['Importaciones'], summary: 'Descargar log de resultado en Excel', responses: { '200': { description: 'Archivo xlsx' } } },
    },
    '/legal-parameters': crud('Parametros legales', 'parametros', 'LegalParameter'),
    '/legal-parameters/{id}': crudItem('Parametros legales', 'parametro', 'LegalParameter'),
  },
};
