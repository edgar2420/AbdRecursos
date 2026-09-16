# API del SGRH

Base: `http://localhost:3000/api/v1` · Documentación interactiva: `http://localhost:3000/docs`

## Convenciones

**Autenticación.** `POST /auth/login` devuelve el *access token* (15 min) en el cuerpo y el *refresh
token* en una cookie `httpOnly`. Las peticiones autenticadas envían:

```
Authorization: Bearer <access_token>
```

Cuando el access token expira, el cliente llama a `POST /auth/refresh` (con la cookie) y obtiene uno
nuevo; el refresh token se rota en cada uso.

**Listados.** Todo `GET` de colección acepta `page`, `limit` (máx. 100), `search`, `sort`, `order`
y filtros propios del recurso, y responde:

```json
{
  "data": [ ... ],
  "meta": { "total": 128, "page": 1, "limit": 10, "totalPages": 13 }
}
```

**Recurso individual.** `{ "data": { ... } }`.

**Errores.**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos invalidos",
    "requestId": "8f1c...",
    "details": [{ "field": "hireDate", "message": "Fecha invalida" }]
  }
}
```

| Código HTTP | `code` | Cuándo |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Entrada inválida |
| 401 | `UNAUTHORIZED` | Sin token, token expirado o credenciales incorrectas |
| 403 | `FORBIDDEN` | Rol insuficiente **o recurso ajeno** |
| 404 | `NOT_FOUND` | El recurso no existe |
| 409 | `CONFLICT` | Duplicado (C.I., correo, boleta del periodo) |
| 422 | `BUSINESS_RULE` | Regla de negocio (saldo insuficiente, solapamiento, periodo cerrado) |
| 429 | `RATE_LIMITED` | Demasiados intentos |

---

## Autenticación y usuarios

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| POST | `/auth/login` | público | Inicia sesión (rate limit agresivo) |
| POST | `/auth/refresh` | público (cookie) | Rota el refresh token y emite un access token |
| POST | `/auth/logout` | cualquiera | Revoca el refresh token |
| GET | `/auth/me` | autenticado | Perfil de la sesión |
| POST | `/auth/change-password` | autenticado | Cambia la propia contraseña y cierra otras sesiones |
| GET | `/auth/users` | Admin | Lista usuarios (`role`, `isActive`, `search`) |
| POST | `/auth/users` | Admin | Crea usuario y lo vincula a un empleado |
| PATCH | `/auth/users/:id/role` | Admin | Cambia el rol (invalida las sesiones del usuario) |
| PATCH | `/auth/users/:id/active` | Admin | Activa o desactiva |
| POST | `/auth/users/:id/reset-password` | Admin | Restablece la contraseña |

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"rrhh@empresa.bo","password":"Sgrh2026.demo"}'
```

## Empleados

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | `/employees` | Supervisor+ | Listado. Filtros: `departmentId`, `positionId`, `status`, `contractType`, `isActive`, `hiredFrom`, `hiredTo` |
| POST | `/employees` | RRHH | Alta (genera `employeeCode` si no se envía) |
| GET | `/employees/:id` | según alcance | Ficha. Un empleado solo accede a la suya; un supervisor, a su equipo |
| PATCH | `/employees/:id` | RRHH / propio | El empleado solo puede tocar sus datos de contacto |
| DELETE | `/employees/:id` | RRHH | Baja lógica con fecha y motivo |
| POST | `/employees/:id/reactivate` | RRHH | Reactiva |
| GET | `/employees/:id/history` | según alcance | Historial de cambios |
| GET | `/employees/export?format=excel\|pdf` | Supervisor+ | Exporta el listado filtrado |
| GET | `/employees/template` | RRHH | Plantilla Excel de carga masiva |
| GET | `/employees/options` | Supervisor+ | Lista compacta para selects |
| GET/POST/PATCH | `/employees/departments`, `/employees/positions` | lectura: autenticado · escritura: RRHH | Catálogos |

## Vacaciones

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | `/vacations/requests` | según alcance | Filtros: `status`, `employeeId`, `departmentId`, `dateFrom`, `dateTo` |
| POST | `/vacations/requests` | autenticado | Solicita (RRHH puede registrar por un tercero) |
| GET | `/vacations/requests/:id` | dueño, supervisor o RRHH | Detalle |
| POST | `/vacations/requests/:id/approve` | Supervisor / RRHH | Avanza el flujo según la configuración |
| POST | `/vacations/requests/:id/reject` | Supervisor / RRHH | Requiere `reason` |
| POST | `/vacations/requests/:id/cancel` | dueño o RRHH | Cancela mientras esté en trámite |
| GET | `/vacations/balance/me` | autenticado | Saldo propio |
| GET | `/vacations/balance/:employeeId` | según alcance | Saldo de un empleado |
| GET | `/vacations/calendar?from&to` | Supervisor+ | Calendario del equipo |

El saldo se calcula en el momento: días por antigüedad menos aprobados menos en trámite. Los días
solicitados excluyen domingos y feriados (y sábados salvo que `VACATION_COUNT_SATURDAY` sea `true`).

## Boletas de pago

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | `/payslips` | autenticado | El empleado ve **solo las suyas**, sin importar los filtros que envíe |
| GET | `/payslips/:id` | dueño o RRHH | Detalle con líneas de haberes y descuentos |
| GET | `/payslips/:id/pdf` | dueño o RRHH | PDF imprimible (queda auditado) |
| POST | `/payslips/generate` | RRHH | Genera el periodo en borrador |
| POST | `/payslips/issue` | RRHH | Emite las boletas indicadas |
| POST | `/payslips/:id/cancel` | RRHH | Anula (no borra) |
| GET | `/payslips/bulk-pdf?periodYear&periodMonth` | RRHH | ZIP con las boletas del periodo |
| GET | `/payslips/aguinaldo?year` | RRHH | Vista previa del aguinaldo por empleado |

```bash
curl -X POST http://localhost:3000/api/v1/payslips/generate \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{
        "periodYear": 2026, "periodMonth": 3, "includeAguinaldo": false,
        "overrides": [
          { "employeeId": "…", "overtimeDayHours": 4, "fiscalCredit": 1500,
            "otherDeductions": [{ "concept": "Anticipo", "amount": 500 }] }
        ]
      }'
```

**Cómo se calcula la boleta** (todo parametrizable):

```
Haber básico  = sueldo × días trabajados / WORK_DAYS_PER_MONTH   (mes completo = sueldo exacto)
+ Bonos       = monto fijo o porcentaje del haber básico
+ Horas extra = hora × (1 + recargo/100), con recargo diurno/nocturno/feriado
+ Aguinaldo   (si corresponde al periodo)
= TOTAL GANADO
− AFP         = total ganado × AFP_EMPLOYEE_RATE
− RC-IVA      = (total ganado − AFP − MINIMUM_WAGE × RCIVA_EXEMPT_MINIMUM_WAGES) × RCIVA_RATE
                menos el crédito fiscal de facturas; nunca negativo
− Otros descuentos (anticipos, préstamos, faltas)
= LÍQUIDO PAGABLE
```

## Lactancia

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | `/lactation` | RRHH (o el propio permiso) | Listado |
| POST | `/lactation` | RRHH | Registra el permiso y marca la inamovilidad informativa |
| PATCH | `/lactation/:id` | RRHH | Ajusta tramos horarios y notas |
| GET | `/lactation/expiring?days` | RRHH | Permisos por vencer |

## Asistencia

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| POST | `/attendance/check-in` · `/check-out` | autenticado | Marca la propia (RRHH puede marcar por un tercero) |
| GET | `/attendance` | según alcance | Marcaciones con filtros de fecha y departamento |
| GET | `/attendance/report?from&to&format` | según alcance | Resumen por empleado; `format=excel\|pdf` descarga |
| GET/POST | `/attendance/justifications` | autenticado | Justificaciones con adjunto |
| PATCH | `/attendance/justifications/:id/review` | Supervisor+ | Aprueba o rechaza |

## Horarios y turnos

| Método | Ruta | Rol |
| --- | --- | --- |
| GET/POST/PATCH | `/schedules`, `/schedules/:id` | lectura: autenticado · escritura: RRHH |
| GET/POST | `/schedules/assignments` | lectura: según alcance · escritura: RRHH |
| PATCH | `/schedules/assignments/:id/end` | RRHH |

## Reportes

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | `/reports/dashboard?from&to&departmentId` | autenticado | KPIs; el alcance depende del rol |
| GET | `/reports/headcount` | Supervisor+ | Distribución por departamento y tipo de contrato |
| GET | `/reports/payroll?year` | RRHH | Costo mensual de la nómina y rotación |

## Importaciones

| Método | Ruta | Descripción |
| --- | --- | --- |
| GET | `/imports/template?type=EMPLOYEES\|ATTENDANCE\|SCHEDULES` | Plantilla Excel con hoja de instrucciones |
| POST | `/imports` (multipart: `file`, `type`) | Sube y **valida sin persistir**; devuelve la vista previa fila por fila |
| GET | `/imports/:id` | Recupera una vista previa |
| POST | `/imports/:id/confirm` | Procesa solo las filas válidas |
| GET | `/imports/:id/log` | Log de resultado en Excel |
| GET | `/imports` | Historial |

Todas requieren rol RRHH o Admin.

## Parámetros legales

| Método | Ruta | Rol | Descripción |
| --- | --- | --- | --- |
| GET | `/legal-parameters/effective` | autenticado | Valores vigentes hoy (clave → valor) |
| GET | `/legal-parameters` | RRHH | Histórico completo con vigencias |
| POST | `/legal-parameters` | RRHH | Crea una nueva versión y cierra la anterior |
| PATCH | `/legal-parameters/:id` | RRHH | Corrige una versión existente |
