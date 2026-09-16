# Modelo de datos

Motor: PostgreSQL. Todos los identificadores públicos son **UUID** (nunca correlativos expuestos en
la URL). Las bajas son **lógicas** (`is_active`) para conservar historial y boletas.

## Diagrama de relaciones

```
                        ┌───────────────┐
                        │     User      │  autenticación y rol (RBAC)
                        │  email, role  │
                        └───────┬───────┘
                                │ 1:1 opcional
                        ┌───────▼───────────────────────────┐
        ┌───────────────┤            Employee               ├───────────────┐
        │               │ ci, hire_date, base_salary, ...   │               │
        │               └──┬────────┬──────────┬────────┬───┘               │
        │                  │        │          │        │                   │
┌───────▼──────┐  ┌────────▼──┐  ┌──▼───────┐ ┌▼────────────┐  ┌────────────▼────┐
│ Department   │  │ Position  │  │ Payslip  │ │ Vacation-   │  │ Attendance-     │
│              │  │           │  │          │ │ Request     │  │ Record          │
└──────────────┘  └───────────┘  └────┬─────┘ └─────────────┘  └─────────────────┘
                                      │ 1:N
                                ┌─────▼────────┐
                                │PayslipDetail │  una línea por haber/descuento
                                └──────────────┘

Employee ──1:N──> EmployeeHistory        (ascensos, cambios de salario/departamento)
Employee ──1:N──> EmployeeBonus          (bonos configurables, monto o porcentaje)
Employee ──1:N──> VacationBalance        (saldo por gestión)
Employee ──1:N──> LactationPermit        (Ley 3460)
Employee ──1:N──> AttendanceJustification
Employee ──1:N──> ScheduleAssignment ──N:1──> Schedule

Transversales:  LegalParameter · AuditLog · ImportLog ──1:N──> ImportLogRow · Holiday · RefreshToken
```

## Entidades

### Autenticación

| Tabla | Campos relevantes | Notas |
| --- | --- | --- |
| `users` | `email`, `password_hash`, `role`, `is_active`, `employee_id` | Un usuario puede existir sin empleado vinculado; sin vínculo no ve boletas ni vacaciones propias |
| `refresh_tokens` | `token_hash`, `expires_at`, `revoked_at`, `replaced_by` | Solo se guarda el **hash**; `replaced_by` permite detectar reúso de un token rotado |

### Organización y personal

| Tabla | Campos relevantes | Notas |
| --- | --- | --- |
| `departments`, `positions` | `name`, `is_active` | Catálogos usados por la carga masiva (se validan por nombre) |
| `employees` | `employee_code`, `ci`, `hire_date`, `contract_type`, `base_salary`, `afp_name`, `bank_account`, `supervisor_id`, `job_protection` | `supervisor_id` es autorreferencia y define el equipo del supervisor. `job_protection` (inamovilidad) es **informativo**: no bloquea acciones |
| `employee_history` | `change_type`, `field`, `old_value`, `new_value`, `effective_date` | Se escribe automáticamente al cambiar salario, cargo, departamento o contrato |
| `employee_bonuses` | `concept`, `amount`, `percentage`, `valid_from/until` | Monto fijo **o** porcentaje del haber básico; los toma el cálculo de la boleta |

### Vacaciones

| Tabla | Campos relevantes | Notas |
| --- | --- | --- |
| `vacation_requests` | `start_date`, `end_date`, `working_days`, `status`, aprobaciones | `working_days` lo calcula el dominio excluyendo domingos y feriados |
| `vacation_balances` | `period_year`, `entitled_days`, `taken_days` | Saldo materializado por gestión; el saldo en vivo se recalcula desde las solicitudes |
| `holidays` | `date`, `name` | Feriados nacionales; el seed carga los de fecha fija |

Estados: `PENDING_SUPERVISOR` → `PENDING_HR` → `APPROVED`, con `REJECTED` y `CANCELLED` como
terminales. Si `VACATION_REQUIRE_HR_APPROVAL` es `false`, la aprobación del supervisor cierra el flujo.

### Boletas de pago

| Tabla | Campos relevantes | Notas |
| --- | --- | --- |
| `payslips` | `period_year`, `period_month`, `worked_days`, `total_earnings`, `total_deductions`, `net_pay`, `parameters_snapshot`, `status` | Única por empleado y periodo. `parameters_snapshot` guarda los parámetros legales usados, para reconstruir el cálculo |
| `payslip_details` | `type` (EARNING/DEDUCTION), `code`, `concept`, `quantity`, `amount` | Una fila por línea de la boleta |

Estados: `DRAFT` (regenerable) → `ISSUED` (cerrada) → `CANCELLED` (anulada, nunca borrada).

### Lactancia

| Tabla | Campos relevantes | Notas |
| --- | --- | --- |
| `lactation_permits` | `birth_date`, `start_date`, `end_date`, `daily_minutes`, `slot1_*`, `slot2_*` | `end_date` = fecha de parto + `LACTATION_MONTHS`. Los tramos no pueden sumar más que el permiso diario |

### Asistencia y horarios

| Tabla | Campos relevantes | Notas |
| --- | --- | --- |
| `attendance_records` | `timestamp`, `type`, `source`, `late_minutes`, coordenadas | `source` distingue web, móvil, biométrico o importación |
| `attendance_justifications` | `date`, `reason`, `attachment_url`, `status` | Una justificación aprobada convierte la falta en justificada en el reporte |
| `schedules` | `start_time`, `end_time`, `tolerance_minutes`, `break_minutes`, `week_days[]` | `week_days` en formato ISO (1 = lunes … 7 = domingo) |
| `schedule_assignments` | `valid_from`, `valid_until`, `is_active` | Un empleado no puede tener dos horarios vigentes solapados |

### Transversales

| Tabla | Campos relevantes | Notas |
| --- | --- | --- |
| `legal_parameters` | `key`, `value`, `value_type`, `valid_from`, `valid_until` | Versionado por vigencia; único por (`key`, `valid_from`) |
| `audit_logs` | `user_id`, `action`, `entity`, `entity_id`, `changes` | Toda acción sensible |
| `import_logs` / `import_log_rows` | totales, `status`, y por fila `is_valid`, `errors[]`, `data` | Sostiene el flujo previsualizar → confirmar y el log descargable |

## Índices y restricciones destacadas

- `employees.ci`, `employees.employee_code`, `users.email`, `schedules.name` — únicos.
- `payslips (employee_id, period_year, period_month)` — único: evita boletas duplicadas del periodo.
- `legal_parameters (key, valid_from)` — único: una sola versión por fecha de vigencia.
- Índices de consulta: `attendance_records (employee_id, timestamp)`,
  `vacation_requests (start_date, end_date)` y `(status)`, `employees (department_id)` y
  `(supervisor_id)`, `lactation_permits (end_date)` para las alertas de vencimiento.
