-- CreateEnum
CREATE TYPE "PapeletaTipo" AS ENUM ('HORAS_EXTRAS', 'SALIDA');

-- CreateEnum
CREATE TYPE "SalidaMotivo" AS ENUM ('PARTICULAR', 'OFICIAL', 'MEDICA');

-- CreateEnum
CREATE TYPE "PapeletaEstado" AS ENUM ('PENDIENTE_JEFE_AREA', 'PENDIENTE_RRHH', 'APROBADA', 'RECHAZADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "RecargoHoraExtra" AS ENUM ('DIURNA', 'NOCTURNA', 'FERIADO');

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "papeletas" (
    "id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "tipo" "PapeletaTipo" NOT NULL,
    "estado" "PapeletaEstado" NOT NULL DEFAULT 'PENDIENTE_JEFE_AREA',
    "employee_id" UUID NOT NULL,
    "area" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "trabajo_realizado" TEXT,
    "desde" TIMESTAMP(3),
    "hasta" TIMESTAMP(3),
    "total_horas" DECIMAL(6,2),
    "recargo" "RecargoHoraExtra",
    "salida_motivo" "SalidaMotivo",
    "motivo" TEXT,
    "tiempo_solicitado" TEXT,
    "hora_salida" TEXT,
    "hora_retorno" TEXT,
    "firma_area_by" UUID,
    "firma_area_at" TIMESTAMP(3),
    "firma_area_hash" TEXT,
    "firma_rrhh_by" UUID,
    "firma_rrhh_at" TIMESTAMP(3),
    "firma_rrhh_hash" TEXT,
    "rechazada_by" UUID,
    "rechazada_at" TIMESTAMP(3),
    "motivo_rechazo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "papeletas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "papeletas_numero_key" ON "papeletas"("numero");

-- CreateIndex
CREATE INDEX "papeletas_employee_id_idx" ON "papeletas"("employee_id");

-- CreateIndex
CREATE INDEX "papeletas_tipo_estado_idx" ON "papeletas"("tipo", "estado");

-- CreateIndex
CREATE INDEX "papeletas_fecha_idx" ON "papeletas"("fecha");

-- AddForeignKey
ALTER TABLE "papeletas" ADD CONSTRAINT "papeletas_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
