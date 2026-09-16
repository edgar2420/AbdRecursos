-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'SUPERVISOR', 'HR', 'ADMIN');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('INDEFINIDO', 'PLAZO_FIJO', 'EVENTUAL', 'CONSULTORIA');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "VacationStatus" AS ENUM ('PENDING_SUPERVISOR', 'PENDING_HR', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'ISSUED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayslipLineType" AS ENUM ('EARNING', 'DEDUCTION');

-- CreateEnum
CREATE TYPE "AttendanceType" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('WEB', 'MOBILE', 'BIOMETRIC', 'IMPORT', 'MANUAL_HR');

-- CreateEnum
CREATE TYPE "JustificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('EMPLOYEES', 'ATTENDANCE', 'SCHEDULES');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'VALIDATED', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE "EmployeeChangeType" AS ENUM ('HIRE', 'PROMOTION', 'SALARY_CHANGE', 'DEPARTMENT_CHANGE', 'POSITION_CHANGE', 'CONTRACT_CHANGE', 'TERMINATION', 'REACTIVATION');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "employee_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" TEXT,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "employee_code" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "ci" TEXT NOT NULL,
    "ci_extension" TEXT,
    "birth_date" TIMESTAMP(3),
    "gender" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "photo_url" TEXT,
    "hire_date" TIMESTAMP(3) NOT NULL,
    "termination_date" TIMESTAMP(3),
    "contract_type" "ContractType" NOT NULL DEFAULT 'INDEFINIDO',
    "base_salary" DECIMAL(14,2) NOT NULL,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "afp_name" TEXT,
    "afp_number" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "job_protection" BOOLEAN NOT NULL DEFAULT false,
    "job_protection_until" TIMESTAMP(3),
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "emergency_contact_relation" TEXT,
    "department_id" UUID,
    "position_id" UUID,
    "supervisor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_history" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "change_type" "EmployeeChangeType" NOT NULL,
    "field" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "effective_date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "changed_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_bonuses" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(14,2),
    "percentage" DECIMAL(7,4),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_bonuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacation_balances" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "period_year" INTEGER NOT NULL,
    "entitled_days" DECIMAL(6,2) NOT NULL,
    "taken_days" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vacation_requests" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "working_days" DECIMAL(6,2) NOT NULL,
    "reason" TEXT,
    "status" "VacationStatus" NOT NULL DEFAULT 'PENDING_SUPERVISOR',
    "supervisor_approved_by" UUID,
    "supervisor_approved_at" TIMESTAMP(3),
    "hr_approved_by" UUID,
    "hr_approved_at" TIMESTAMP(3),
    "rejected_by" UUID,
    "rejected_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vacation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslips" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "period_year" INTEGER NOT NULL,
    "period_month" INTEGER NOT NULL,
    "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "worked_days" DECIMAL(6,2) NOT NULL,
    "base_salary" DECIMAL(14,2) NOT NULL,
    "total_earnings" DECIMAL(14,2) NOT NULL,
    "total_deductions" DECIMAL(14,2) NOT NULL,
    "net_pay" DECIMAL(14,2) NOT NULL,
    "parameters_snapshot" JSONB,
    "issued_at" TIMESTAMP(3),
    "issued_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payslips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payslip_details" (
    "id" UUID NOT NULL,
    "payslip_id" UUID NOT NULL,
    "type" "PayslipLineType" NOT NULL,
    "code" TEXT NOT NULL,
    "concept" TEXT NOT NULL,
    "quantity" DECIMAL(10,2),
    "amount" DECIMAL(14,2) NOT NULL,
    "order_index" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "payslip_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lactation_permits" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "birth_date" TIMESTAMP(3) NOT NULL,
    "child_name" TEXT,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "daily_minutes" INTEGER NOT NULL DEFAULT 60,
    "slot1_start" TEXT,
    "slot1_end" TEXT,
    "slot2_start" TEXT,
    "slot2_end" TEXT,
    "document_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lactation_permits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "type" "AttendanceType" NOT NULL,
    "source" "AttendanceSource" NOT NULL DEFAULT 'WEB',
    "device_id" TEXT,
    "latitude" DECIMAL(10,6),
    "longitude" DECIMAL(10,6),
    "notes" TEXT,
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_justifications" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "attachment_url" TEXT,
    "status" "JustificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_justifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "tolerance_minutes" INTEGER NOT NULL DEFAULT 5,
    "week_days" INTEGER[],
    "is_night_shift" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_assignments" (
    "id" UUID NOT NULL,
    "schedule_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_logs" (
    "id" UUID NOT NULL,
    "type" "ImportType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "valid_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "processed_rows" INTEGER NOT NULL DEFAULT 0,
    "uploaded_by" UUID NOT NULL,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_log_rows" (
    "id" UUID NOT NULL,
    "import_log_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "is_valid" BOOLEAN NOT NULL,
    "errors" TEXT[],
    "data" JSONB NOT NULL,

    CONSTRAINT "import_log_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "changes" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legal_parameters" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "value_type" TEXT NOT NULL DEFAULT 'number',
    "description" TEXT,
    "unit" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legal_parameters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "is_national" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "positions_name_key" ON "positions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_ci_key" ON "employees"("ci");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- CreateIndex
CREATE INDEX "employees_supervisor_id_idx" ON "employees"("supervisor_id");

-- CreateIndex
CREATE INDEX "employees_last_name_first_name_idx" ON "employees"("last_name", "first_name");

-- CreateIndex
CREATE INDEX "employee_history_employee_id_idx" ON "employee_history"("employee_id");

-- CreateIndex
CREATE INDEX "employee_bonuses_employee_id_idx" ON "employee_bonuses"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "vacation_balances_employee_id_period_year_key" ON "vacation_balances"("employee_id", "period_year");

-- CreateIndex
CREATE INDEX "vacation_requests_employee_id_idx" ON "vacation_requests"("employee_id");

-- CreateIndex
CREATE INDEX "vacation_requests_status_idx" ON "vacation_requests"("status");

-- CreateIndex
CREATE INDEX "vacation_requests_start_date_end_date_idx" ON "vacation_requests"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "payslips_period_year_period_month_idx" ON "payslips"("period_year", "period_month");

-- CreateIndex
CREATE UNIQUE INDEX "payslips_employee_id_period_year_period_month_key" ON "payslips"("employee_id", "period_year", "period_month");

-- CreateIndex
CREATE INDEX "payslip_details_payslip_id_idx" ON "payslip_details"("payslip_id");

-- CreateIndex
CREATE INDEX "lactation_permits_employee_id_idx" ON "lactation_permits"("employee_id");

-- CreateIndex
CREATE INDEX "lactation_permits_end_date_idx" ON "lactation_permits"("end_date");

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_timestamp_idx" ON "attendance_records"("employee_id", "timestamp");

-- CreateIndex
CREATE INDEX "attendance_justifications_employee_id_date_idx" ON "attendance_justifications"("employee_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_name_key" ON "schedules"("name");

-- CreateIndex
CREATE INDEX "schedule_assignments_employee_id_valid_from_idx" ON "schedule_assignments"("employee_id", "valid_from");

-- CreateIndex
CREATE INDEX "import_log_rows_import_log_id_idx" ON "import_log_rows"("import_log_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "legal_parameters_key_idx" ON "legal_parameters"("key");

-- CreateIndex
CREATE UNIQUE INDEX "legal_parameters_key_valid_from_key" ON "legal_parameters"("key", "valid_from");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_supervisor_id_fkey" FOREIGN KEY ("supervisor_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_history" ADD CONSTRAINT "employee_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_bonuses" ADD CONSTRAINT "employee_bonuses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_balances" ADD CONSTRAINT "vacation_balances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vacation_requests" ADD CONSTRAINT "vacation_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payslip_details" ADD CONSTRAINT "payslip_details_payslip_id_fkey" FOREIGN KEY ("payslip_id") REFERENCES "payslips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lactation_permits" ADD CONSTRAINT "lactation_permits_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_justifications" ADD CONSTRAINT "attendance_justifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_assignments" ADD CONSTRAINT "schedule_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "import_log_rows" ADD CONSTRAINT "import_log_rows_import_log_id_fkey" FOREIGN KEY ("import_log_id") REFERENCES "import_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
