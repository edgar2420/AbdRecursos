-- Trigramas para buscar empleados por nombre con ILIKE (requiere permiso para crear extensiones)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- DropIndex
DROP INDEX "attendance_records_employee_id_timestamp_idx";

-- CreateTable
CREATE TABLE "candados_tareas" (
    "nombre" TEXT NOT NULL,
    "duenio" TEXT NOT NULL,
    "hasta" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candados_tareas_pkey" PRIMARY KEY ("nombre")
);

-- CreateTable
CREATE TABLE "limites_acceso" (
    "clave" TEXT NOT NULL,
    "intentos" INTEGER NOT NULL,
    "reinicio" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "limites_acceso_pkey" PRIMARY KEY ("clave")
);

-- CreateIndex
CREATE INDEX "limites_acceso_reinicio_idx" ON "limites_acceso"("reinicio");

-- CreateIndex
CREATE INDEX "attendance_records_timestamp_idx" ON "attendance_records"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_employee_timestamp_key" ON "attendance_records"("employee_id", "timestamp");

-- CreateIndex
CREATE INDEX "employees_first_name_trgm_idx" ON "employees" USING GIN ("first_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "employees_last_name_trgm_idx" ON "employees" USING GIN ("last_name" gin_trgm_ops);

